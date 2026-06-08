import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { serializeFee, serializePayment } from "@/lib/server/fee-records"
import { parseIsoDate, startOfUtcDay } from "@/lib/server/utc-date"
import type { ApiResponse, PaymentMutationData } from "@/lib/types"

type PaymentInput = {
  studentId: string
  amount: Prisma.Decimal
  paymentDate: Date
  referenceNumber: string
}

const MAX_TRANSACTION_RETRIES = 3

class PaymentRequestError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404
  ) {
    super(message)
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<PaymentMutationData>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validatePaymentInput(body)

  if (validation.error !== null) {
    return validationError<PaymentMutationData>(validation.error)
  }

  try {
    const result = await recordPayment(validation.data)
    const response: ApiResponse<PaymentMutationData> = {
      data: {
        payment: serializePayment(result.payment),
        updatedFee: serializeFee(result.updatedFee),
      },
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof PaymentRequestError) {
      const response: ApiResponse<PaymentMutationData> = {
        data: null,
        error: error.message,
      }
      return Response.json(response, { status: error.status })
    }

    return internalServerError<PaymentMutationData>()
  }
}

async function recordPayment(input: PaymentInput) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const student = await tx.student.findUnique({
            where: { id: input.studentId },
            select: { id: true },
          })

          if (student === null) {
            throw new PaymentRequestError("Student not found", 404)
          }

          const fee = await tx.fee.findUnique({
            where: { studentId: input.studentId },
          })

          if (fee === null) {
            throw new PaymentRequestError("Fee record not found", 404)
          }

          if (fee.isWaived) {
            throw new PaymentRequestError(
              "This student's fee has been waived. No payments can be recorded.",
              400
            )
          }

          if (input.amount.greaterThan(fee.outstanding)) {
            throw new PaymentRequestError(
              "Payment amount exceeds outstanding balance",
              400
            )
          }

          const outstanding = fee.outstanding.minus(input.amount)
          const payment = await tx.payment.create({
            data: {
              feeId: fee.id,
              amount: input.amount,
              paymentDate: input.paymentDate,
              referenceNumber: input.referenceNumber,
            },
          })
          const updatedFee = await tx.fee.update({
            where: { id: fee.id },
            data: {
              amountPaid: fee.amountPaid.plus(input.amount),
              outstanding,
              isOverdue:
                fee.dueDate < startOfUtcDay() && outstanding.isPositive(),
            },
          })

          return { payment, updatedFee }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        }
      )
    } catch (error) {
      const canRetry =
        attempt < MAX_TRANSACTION_RETRIES &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"

      if (!canRetry) {
        throw error
      }
    }
  }

  throw new Error("Unable to record payment")
}

function validatePaymentInput(body: unknown): ApiResponse<PaymentInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const studentId =
    typeof body.studentId === "string" ? body.studentId.trim() : ""
  const referenceNumber =
    typeof body.referenceNumber === "string" ? body.referenceNumber.trim() : ""
  const paymentDateValue =
    typeof body.paymentDate === "string" ? body.paymentDate.trim() : ""
  const paymentDate = parseIsoDate(paymentDateValue)
  const amount = body.amount

  if (studentId === "") {
    errors.push("studentId: Student is required")
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    errors.push("amount: Payment amount must be greater than 0")
  }

  if (paymentDate === null) {
    errors.push("paymentDate: Enter a valid payment date")
  } else if (paymentDate > startOfUtcDay()) {
    errors.push("paymentDate: Payment date cannot be in the future")
  }

  if (referenceNumber === "") {
    errors.push("referenceNumber: Reference number is required")
  }

  if (errors.length > 0 || paymentDate === null) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: {
      studentId,
      amount: new Prisma.Decimal(String(amount)),
      paymentDate,
      referenceNumber,
    },
    error: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function internalServerError<T>() {
  const response: ApiResponse<T> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

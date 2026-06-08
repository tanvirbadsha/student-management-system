import { Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { serializeFee, serializeFeeAdjustment } from "@/lib/server/fee-records"
import { startOfUtcDay } from "@/lib/server/utc-date"
import type { ApiResponse, FeeAdjustmentRecord, FeeRecord } from "@/lib/types"

type RouteContext = {
  params: Promise<{ studentId: string }>
}

type FeeAdjustmentType = "DISCOUNT" | "WAIVER" | "CORRECTION"

type FeeAdjustmentInput = {
  adjustmentType: FeeAdjustmentType
  amount: Prisma.Decimal | null
  reason: string
}

type FeeAdjustmentResponse = {
  fee: FeeRecord
  adjustment: FeeAdjustmentRecord
}

export async function POST(request: Request, context: RouteContext) {
  const { studentId } = await context.params
  const role = request.headers.get("x-user-role")?.trim()
  const appliedById = request.headers.get("x-user-id")?.trim() ?? ""

  if (role !== Role.STAFF) {
    return forbiddenError("Staff access required")
  }

  if (appliedById === "") {
    return forbiddenError("x-user-id header is required")
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError("body: Request body must be valid JSON")
  }

  const validation = validateAdjustmentInput(body)

  if (validation.error !== null) {
    return validationError(validation.error)
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const fee = await tx.fee.findUnique({
        where: { studentId },
      })

      if (fee === null) {
        return null
      }

      const nextFee = calculateAdjustedFee(fee, validation.data)

      const updatedFee = await tx.fee.update({
        where: { id: fee.id },
        data: nextFee,
      })
      const adjustment = await tx.feeAdjustment.create({
        data: {
          feeId: fee.id,
          adjustmentType: validation.data.adjustmentType,
          amount: validation.data.amount,
          reason: validation.data.reason,
          appliedById,
        },
        include: {
          appliedBy: {
            select: {
              fullName: true,
            },
          },
        },
      })

      return { updatedFee, adjustment }
    })

    if (result === null) {
      return notFoundError("Fee record not found")
    }

    const response: ApiResponse<FeeAdjustmentResponse> = {
      data: {
        fee: serializeFee(result.updatedFee),
        adjustment: serializeFeeAdjustment(result.adjustment),
      },
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (error instanceof FeeAdjustmentRequestError) {
      return validationError(error.message)
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return notFoundError("Fee record or staff user not found")
    }

    return internalServerError()
  }
}

function calculateAdjustedFee(
  fee: {
    totalAmount: Prisma.Decimal
    amountPaid: Prisma.Decimal
    outstanding: Prisma.Decimal
    dueDate: Date
  },
  input: FeeAdjustmentInput
) {
  if (input.adjustmentType === "WAIVER") {
    return {
      outstanding: new Prisma.Decimal(0),
      isOverdue: false,
      isWaived: true,
    }
  }

  if (input.amount === null) {
    throw new FeeAdjustmentRequestError("amount: Amount is required")
  }

  if (input.adjustmentType === "DISCOUNT") {
    if (input.amount.greaterThanOrEqualTo(fee.totalAmount)) {
      throw new FeeAdjustmentRequestError(
        "amount: Discount must be less than the current total fee"
      )
    }

    const totalAmount = fee.totalAmount.minus(input.amount)
    return recalculatedFee(totalAmount, fee.amountPaid, fee.dueDate)
  }

  return recalculatedFee(input.amount, fee.amountPaid, fee.dueDate)
}

function recalculatedFee(
  totalAmount: Prisma.Decimal,
  currentAmountPaid: Prisma.Decimal,
  dueDate: Date
) {
  const amountPaid = currentAmountPaid.greaterThan(totalAmount)
    ? totalAmount
    : currentAmountPaid
  const outstanding = Prisma.Decimal.max(totalAmount.minus(amountPaid), 0)

  return {
    totalAmount,
    amountPaid,
    outstanding,
    isOverdue: dueDate < startOfUtcDay() && outstanding.isPositive(),
    isWaived: false,
  }
}

function validateAdjustmentInput(
  body: unknown
): ApiResponse<FeeAdjustmentInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const adjustmentType =
    typeof body.adjustmentType === "string" ? body.adjustmentType.trim() : ""
  const amount = body.amount
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const errors: string[] = []

  if (
    adjustmentType !== "DISCOUNT" &&
    adjustmentType !== "WAIVER" &&
    adjustmentType !== "CORRECTION"
  ) {
    errors.push("adjustmentType: Invalid adjustment type")
  }

  let parsedAmount: Prisma.Decimal | null = null
  if (adjustmentType !== "WAIVER") {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      errors.push("amount: Amount must be greater than 0")
    } else {
      parsedAmount = new Prisma.Decimal(String(amount))
    }
  }

  if (reason === "") {
    errors.push("reason: Reason is required")
  }

  if (errors.length > 0) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: {
      adjustmentType: adjustmentType as FeeAdjustmentType,
      amount: parsedAmount,
      reason,
    },
    error: null,
  }
}

class FeeAdjustmentRequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError(error: string) {
  const response: ApiResponse<FeeAdjustmentResponse> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function forbiddenError(error: string) {
  const response: ApiResponse<FeeAdjustmentResponse> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function notFoundError(error: string) {
  const response: ApiResponse<FeeAdjustmentResponse> = { data: null, error }
  return Response.json(response, { status: 404 })
}

function internalServerError() {
  const response: ApiResponse<FeeAdjustmentResponse> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

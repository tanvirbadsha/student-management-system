import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  feeWithPaymentsInclude,
  serializeFee,
  serializeFeeWithPayments,
} from "@/lib/server/fee-records"
import { parseIsoDate, startOfUtcDay } from "@/lib/server/utc-date"
import type { ApiResponse, FeeDetailsData, FeeRecord } from "@/lib/types"

type RouteContext = {
  params: Promise<{ studentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { studentId } = await context.params

  try {
    const fee = await prisma.fee.findUnique({
      where: { studentId },
      include: feeWithPaymentsInclude,
    })

    if (fee === null) {
      return notFoundError<FeeDetailsData>("Fee record not found")
    }

    const response: ApiResponse<FeeDetailsData> = {
      data: { fee: serializeFeeWithPayments(fee) },
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<FeeDetailsData>()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { studentId } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<FeeRecord>("body: Request body must be valid JSON")
  }

  if (!isRecord(body) || typeof body.dueDate !== "string") {
    return validationError<FeeRecord>("dueDate: Enter a valid due date")
  }

  const dueDate = parseIsoDate(body.dueDate.trim())

  if (dueDate === null) {
    return validationError<FeeRecord>("dueDate: Enter a valid due date")
  }

  try {
    const updatedFee = await prisma.$transaction(async (tx) => {
      const fee = await tx.fee.findUnique({
        where: { studentId },
      })

      if (fee === null) {
        return null
      }

      return tx.fee.update({
        where: { id: fee.id },
        data: {
          dueDate,
          isOverdue: dueDate < startOfUtcDay() && fee.outstanding.isPositive(),
        },
      })
    })

    if (updatedFee === null) {
      return notFoundError<FeeRecord>("Fee record not found")
    }

    const response: ApiResponse<FeeRecord> = {
      data: serializeFee(updatedFee),
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError<FeeRecord>("Fee record not found")
    }

    return internalServerError<FeeRecord>()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function notFoundError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 404 })
}

function internalServerError<T>() {
  const response: ApiResponse<T> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

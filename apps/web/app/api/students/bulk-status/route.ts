import { EnrolmentStatus, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type BulkStatusInput = {
  studentIds: string[]
  status: EnrolmentStatus
}

type BulkStatusResponse = {
  updated: number
}

export async function POST(request: Request) {
  const role = request.headers.get("x-user-role")?.trim()

  if (role !== Role.STAFF) {
    return forbiddenError("Staff access required")
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError("body: Request body must be valid JSON")
  }

  const validation = validateBulkStatusInput(body)

  if (validation.error !== null) {
    return validationError(validation.error)
  }

  try {
    const result = await prisma.student.updateMany({
      where: {
        id: {
          in: validation.data.studentIds,
        },
      },
      data: {
        status: validation.data.status,
      },
    })
    const response: ApiResponse<BulkStatusResponse> = {
      data: { updated: result.count },
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError()
  }
}

function validateBulkStatusInput(body: unknown): ApiResponse<BulkStatusInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds : []
  const status = typeof body.status === "string" ? body.status.trim() : ""

  if (
    studentIds.length === 0 ||
    !studentIds.every(
      (studentId) => typeof studentId === "string" && studentId.trim() !== ""
    )
  ) {
    errors.push("studentIds: Select at least one student")
  } else if (studentIds.length > 50) {
    errors.push("studentIds: Cannot update more than 50 students at once")
  }

  if (!Object.values(EnrolmentStatus).includes(status as EnrolmentStatus)) {
    errors.push("status: Invalid enrolment status")
  } else if (status === EnrolmentStatus.WITHDRAWN) {
    errors.push("status: Withdraw students individually so fee checks run")
  }

  if (errors.length > 0) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: {
      studentIds: studentIds.map((studentId) => studentId.trim()),
      status: status as EnrolmentStatus,
    },
    error: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError(error: string) {
  const response: ApiResponse<BulkStatusResponse> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function forbiddenError(error: string) {
  const response: ApiResponse<BulkStatusResponse> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function internalServerError() {
  const response: ApiResponse<BulkStatusResponse> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

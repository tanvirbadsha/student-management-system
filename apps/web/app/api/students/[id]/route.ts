import { EnrolmentStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  serializeStudent,
  serializeStudentDetail,
  studentDetailSelect,
  studentListSelect,
} from "@/lib/server/student-records"
import type {
  ApiResponse,
  StudentDetail,
  StudentMutationResponse,
  StudentWithRelations,
} from "@/lib/types"

type StudentUpdateInput = {
  status?: EnrolmentStatus
  academicYear?: number
  programmeId?: string
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: studentDetailSelect,
    })

    if (student === null) {
      return notFoundError<StudentDetail>("Student not found")
    }

    const response: ApiResponse<StudentDetail> = {
      data: serializeStudentDetail(student),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<StudentDetail>()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<StudentWithRelations>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateStudentUpdateInput(body)

  if (validation.error !== null) {
    return validationError<StudentWithRelations>(validation.error)
  }

  try {
    const currentStudent = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        programmeId: true,
        fee: {
          select: {
            id: true,
            amountPaid: true,
            dueDate: true,
          },
        },
      },
    })

    if (currentStudent === null) {
      return notFoundError<StudentWithRelations>("Student not found")
    }

    const targetProgrammeId =
      validation.data.programmeId ?? currentStudent.programmeId
    const targetProgramme = await prisma.programme.findUnique({
      where: { id: targetProgrammeId },
      select: {
        id: true,
        durationYears: true,
        feeAmount: true,
      },
    })

    if (targetProgramme === null) {
      return validationError<StudentWithRelations>(
        "programmeId: Programme not found"
      )
    }

    if (
      validation.data.academicYear !== undefined &&
      validation.data.academicYear > targetProgramme.durationYears
    ) {
      return validationError<StudentWithRelations>(
        `academicYear: Academic year cannot exceed ${targetProgramme.durationYears}`
      )
    }

    const programmeChanged =
      validation.data.programmeId !== undefined &&
      validation.data.programmeId !== currentStudent.programmeId

    const updatedStudent = await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...(validation.data.status !== undefined
            ? { status: validation.data.status }
            : {}),
          ...(validation.data.academicYear !== undefined
            ? { academicYear: validation.data.academicYear }
            : {}),
          ...(programmeChanged ? { programmeId: targetProgramme.id } : {}),
        },
      })

      if (programmeChanged && currentStudent.fee !== null) {
        const outstanding = targetProgramme.feeAmount.minus(
          currentStudent.fee.amountPaid
        )
        const today = startOfUtcDay(new Date())

        await tx.fee.update({
          where: { id: currentStudent.fee.id },
          data: {
            totalAmount: targetProgramme.feeAmount,
            outstanding,
            isOverdue:
              currentStudent.fee.dueDate < today && outstanding.isPositive(),
          },
        })
      }

      return tx.student.findUniqueOrThrow({
        where: { id },
        select: studentListSelect,
      })
    })

    const terminalStatus =
      validation.data.status === EnrolmentStatus.WITHDRAWN ||
      validation.data.status === EnrolmentStatus.COMPLETED
    const response: StudentMutationResponse = {
      data: serializeStudent(updatedStudent),
      error: null,
      ...(terminalStatus
        ? {
            note: "Downstream actions such as freezing submissions should be handled by the UI.",
          }
        : {}),
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError<StudentWithRelations>("Student not found")
    }

    return internalServerError<StudentWithRelations>()
  }
}

function validateStudentUpdateInput(
  body: unknown
): ApiResponse<StudentUpdateInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const data: StudentUpdateInput = {}

  if ("status" in body) {
    if (
      typeof body.status !== "string" ||
      !Object.values(EnrolmentStatus).includes(body.status as EnrolmentStatus)
    ) {
      errors.push("status: Invalid enrolment status")
    } else {
      data.status = body.status as EnrolmentStatus
    }
  }

  if ("academicYear" in body) {
    if (
      typeof body.academicYear !== "number" ||
      !Number.isInteger(body.academicYear) ||
      body.academicYear < 1
    ) {
      errors.push("academicYear: Academic year must be at least 1")
    } else {
      data.academicYear = body.academicYear
    }
  }

  if ("programmeId" in body) {
    if (
      typeof body.programmeId !== "string" ||
      body.programmeId.trim() === ""
    ) {
      errors.push("programmeId: Programme is required")
    } else {
      data.programmeId = body.programmeId.trim()
    }
  }

  if (Object.keys(data).length === 0 && errors.length === 0) {
    errors.push(
      "body: Provide at least one of status, academicYear, or programmeId"
    )
  }

  if (errors.length > 0) {
    return { data: null, error: errors.join("; ") }
  }

  return { data, error: null }
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
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

import { EnrolmentStatus, Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  serializeStudent,
  studentListSelect,
} from "@/lib/server/student-records"
import type {
  ApiResponse,
  StudentMutationResponse,
  StudentWithRelations,
} from "@/lib/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const role = request.headers.get("x-user-role")?.trim()

  if (role !== Role.STAFF) {
    return forbiddenError<StudentWithRelations>("Staff access required")
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fee: {
          select: {
            outstanding: true,
          },
        },
      },
    })

    if (student === null) {
      return notFoundError<StudentWithRelations>("Student not found")
    }

    if (
      student.status === EnrolmentStatus.WITHDRAWN ||
      student.status === EnrolmentStatus.COMPLETED
    ) {
      return validationError<StudentWithRelations>(
        "Cannot withdraw a student who is already withdrawn or completed."
      )
    }

    if (student.fee !== null && student.fee.outstanding.greaterThan(0)) {
      return validationError<StudentWithRelations>(
        "Cannot withdraw student with an outstanding fee balance. Clear or waive the balance first."
      )
    }

    const updatedStudent = await prisma.student.update({
      where: { id },
      data: {
        status: EnrolmentStatus.WITHDRAWN,
        withdrawalDate: new Date(),
      },
      select: studentListSelect,
    })
    const response: StudentMutationResponse = {
      data: serializeStudent(updatedStudent),
      error: null,
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

function validationError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function forbiddenError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 403 })
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

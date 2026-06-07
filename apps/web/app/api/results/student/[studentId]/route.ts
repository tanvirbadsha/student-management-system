import { Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  resultRelationsSelect,
  serializeResult,
} from "@/lib/server/result-records"
import type { ApiResponse, ResultWithRelations } from "@/lib/types"

type RouteContext = {
  params: Promise<{ studentId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { studentId } = await context.params
  const role = request.headers.get("x-user-role")?.trim()
  const userId = request.headers.get("x-user-id")?.trim() ?? ""

  if (role !== Role.STAFF && role !== Role.STUDENT) {
    return forbiddenError("A valid x-user-role header is required")
  }

  try {
    if (role === Role.STUDENT) {
      if (userId === "") {
        return forbiddenError("x-user-id header is required")
      }

      const currentStudent = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (currentStudent === null || currentStudent.id !== studentId) {
        const response: ApiResponse<ResultWithRelations[]> = {
          data: [],
          error: null,
        }
        return Response.json(response)
      }
    }

    const records = await prisma.result.findMany({
      where: {
        studentId,
        ...(role === Role.STUDENT ? { isPublished: true } : {}),
      },
      select: resultRelationsSelect,
      orderBy: {
        gradedAt: "desc",
      },
    })
    const response: ApiResponse<ResultWithRelations[]> = {
      data: records.map(serializeResult),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError()
  }
}

function forbiddenError(error: string) {
  const response: ApiResponse<ResultWithRelations[]> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function internalServerError() {
  const response: ApiResponse<ResultWithRelations[]> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

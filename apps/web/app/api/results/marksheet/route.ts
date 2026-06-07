import { Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  marksheetAssessmentSelect,
  resultRelationsSelect,
  serializeMarksheetAssessment,
  serializeResult,
  summarizeResults,
} from "@/lib/server/result-records"
import type { ApiResponse, MarksheetData } from "@/lib/types"

export async function GET(request: Request) {
  const assessmentId =
    new URL(request.url).searchParams.get("assessmentId")?.trim() ?? ""

  if (assessmentId === "") {
    return validationError("assessmentId is required")
  }

  const role = request.headers.get("x-user-role")?.trim()
  const userId = request.headers.get("x-user-id")?.trim() ?? ""

  if (role !== Role.STAFF && role !== Role.STUDENT) {
    return forbiddenError("A valid x-user-role header is required")
  }

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: marksheetAssessmentSelect,
    })

    if (assessment === null) {
      return notFoundError("Assessment not found")
    }

    let studentId: string | undefined

    if (role === Role.STUDENT) {
      if (userId === "") {
        return forbiddenError("x-user-id header is required")
      }

      const student = await prisma.student.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (student === null) {
        return forbiddenError("Student profile not found")
      }

      studentId = student.id
    }

    const records = await prisma.result.findMany({
      where: {
        assessmentId,
        ...(role === Role.STUDENT
          ? {
              studentId,
              isPublished: true,
            }
          : {}),
      },
      select: resultRelationsSelect,
      orderBy: {
        student: {
          studentId: "asc",
        },
      },
    })
    const results = records.map(serializeResult)
    const data: MarksheetData = {
      assessment: serializeMarksheetAssessment(assessment),
      results,
      ...(role === Role.STAFF ? { summary: summarizeResults(results) } : {}),
    }
    const response: ApiResponse<MarksheetData> = {
      data,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError()
  }
}

function validationError(error: string) {
  const response: ApiResponse<MarksheetData> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function forbiddenError(error: string) {
  const response: ApiResponse<MarksheetData> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function notFoundError(error: string) {
  const response: ApiResponse<MarksheetData> = { data: null, error }
  return Response.json(response, { status: 404 })
}

function internalServerError() {
  const response: ApiResponse<MarksheetData> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

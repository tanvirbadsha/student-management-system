import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  resultRelationsSelect,
  serializeResult,
} from "@/lib/server/result-records"
import type { ApiResponse, ResultWithRelations } from "@/lib/types"
import { deriveClassification } from "@/lib/utils"

type ResultCreateInput = {
  submissionId: string
  grade: number
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<ResultWithRelations>(
      "Request body must be valid JSON"
    )
  }

  const validation = validateCreateInput(body)

  if (validation.error !== null) {
    return validationError<ResultWithRelations>(validation.error)
  }

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: validation.data.submissionId },
      select: {
        id: true,
        studentId: true,
        assessmentId: true,
        result: {
          select: { id: true },
        },
      },
    })

    if (submission === null) {
      return notFoundError<ResultWithRelations>("Submission not found")
    }

    if (submission.result !== null) {
      return conflictError<ResultWithRelations>(
        "A result already exists for this submission. Use PATCH to update it."
      )
    }

    const result = await prisma.result.create({
      data: {
        submissionId: submission.id,
        studentId: submission.studentId,
        assessmentId: submission.assessmentId,
        grade: validation.data.grade,
        classification: deriveClassification(validation.data.grade),
        isPublished: false,
      },
      select: resultRelationsSelect,
    })
    const response: ApiResponse<ResultWithRelations> = {
      data: serializeResult(result),
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError<ResultWithRelations>(
        "A result already exists for this submission. Use PATCH to update it."
      )
    }

    return internalServerError<ResultWithRelations>()
  }
}

function validateCreateInput(body: unknown): ApiResponse<ResultCreateInput> {
  if (!isRecord(body)) {
    return { data: null, error: "Request body must be a JSON object" }
  }

  const submissionId =
    typeof body.submissionId === "string" ? body.submissionId.trim() : ""

  if (submissionId === "") {
    return { data: null, error: "submissionId is required" }
  }

  if (!isValidGrade(body.grade)) {
    return {
      data: null,
      error: "Grade must be a whole number between 0 and 100",
    }
  }

  return {
    data: {
      submissionId,
      grade: body.grade,
    },
    error: null,
  }
}

function isValidGrade(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
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

function conflictError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 409 })
}

function internalServerError<T>() {
  const response: ApiResponse<T> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

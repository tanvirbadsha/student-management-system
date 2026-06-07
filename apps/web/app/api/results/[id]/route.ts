import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  resultRelationsSelect,
  serializeResult,
} from "@/lib/server/result-records"
import type { ApiResponse, ResultMutationResponse } from "@/lib/types"
import { deriveClassification } from "@/lib/utils"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ResultUpdateInput = {
  grade?: number
  isPublished?: boolean
}

const UNPUBLISHED_WARNING =
  "Grade changed — result has been unpublished. Re-publish when ready."

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError("Request body must be valid JSON")
  }

  const validation = validateUpdateInput(body)

  if (validation.error !== null) {
    return validationError(validation.error)
  }

  try {
    const existing = await prisma.result.findUnique({
      where: { id },
      select: {
        id: true,
        grade: true,
        isPublished: true,
      },
    })

    if (existing === null) {
      return notFoundError("Result not found")
    }

    const gradeChanged =
      validation.data.grade !== undefined &&
      validation.data.grade !== existing.grade
    const unpublishChangedGrade = existing.isPublished && gradeChanged
    const result = await prisma.result.update({
      where: { id },
      data: {
        ...(validation.data.grade !== undefined
          ? {
              grade: validation.data.grade,
              classification: deriveClassification(validation.data.grade),
            }
          : {}),
        ...(validation.data.isPublished !== undefined
          ? { isPublished: validation.data.isPublished }
          : {}),
        ...(unpublishChangedGrade ? { isPublished: false } : {}),
      },
      select: resultRelationsSelect,
    })
    const response: ResultMutationResponse = {
      data: serializeResult(result),
      error: null,
      ...(unpublishChangedGrade ? { warning: UNPUBLISHED_WARNING } : {}),
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError("Result not found")
    }

    return internalServerError()
  }
}

function validateUpdateInput(body: unknown): ApiResponse<ResultUpdateInput> {
  if (!isRecord(body)) {
    return { data: null, error: "Request body must be a JSON object" }
  }

  const data: ResultUpdateInput = {}

  if ("grade" in body) {
    if (!isValidGrade(body.grade)) {
      return {
        data: null,
        error: "Grade must be a whole number between 0 and 100",
      }
    }

    data.grade = body.grade
  }

  if ("isPublished" in body) {
    if (typeof body.isPublished !== "boolean") {
      return { data: null, error: "isPublished must be a boolean" }
    }

    data.isPublished = body.isPublished
  }

  if (Object.keys(data).length === 0) {
    return {
      data: null,
      error: "Provide grade or isPublished",
    }
  }

  return { data, error: null }
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

function validationError(error: string) {
  const response: ResultMutationResponse = { data: null, error }
  return Response.json(response, { status: 400 })
}

function notFoundError(error: string) {
  const response: ResultMutationResponse = { data: null, error }
  return Response.json(response, { status: 404 })
}

function internalServerError() {
  const response: ResultMutationResponse = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

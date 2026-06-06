import { Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  assessmentListSelect,
  serializeAssessment,
} from "@/lib/server/assessment-records"
import type { ApiResponse, AssessmentWithRelations } from "@/lib/types"

type AssessmentInput = {
  moduleId: string
  title: string
  deadline: Date
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const moduleId = searchParams.get("moduleId")?.trim() ?? ""
  const programmeId = searchParams.get("programmeId")?.trim() ?? ""
  const status = searchParams.get("status")?.trim() ?? ""

  if (status !== "" && status !== "open" && status !== "closed") {
    return validationError<AssessmentWithRelations[]>(
      "status: Status must be open or closed"
    )
  }

  const now = new Date()
  const where: Prisma.AssessmentWhereInput = {
    ...(moduleId !== "" ? { moduleId } : {}),
    ...(programmeId !== "" ? { module: { programmeId } } : {}),
    ...(status === "open"
      ? { deadline: { gt: now } }
      : status === "closed"
        ? { deadline: { lte: now } }
        : {}),
  }

  try {
    const assessments = await prisma.assessment.findMany({
      where,
      select: assessmentListSelect,
      orderBy: { deadline: "asc" },
    })
    const response: ApiResponse<AssessmentWithRelations[]> = {
      data: assessments.map(serializeAssessment),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<AssessmentWithRelations[]>()
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<AssessmentWithRelations>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateAssessmentInput(body)

  if (validation.error !== null) {
    return validationError<AssessmentWithRelations>(validation.error)
  }

  const createdById = request.headers.get("x-user-id")?.trim() ?? ""

  if (createdById === "") {
    return validationError<AssessmentWithRelations>(
      "createdById: x-user-id header is required"
    )
  }

  try {
    const [module, createdBy] = await Promise.all([
      prisma.module.findUnique({
        where: { id: validation.data.moduleId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: createdById },
        select: { id: true, role: true },
      }),
    ])

    if (module === null) {
      return notFoundError<AssessmentWithRelations>(
        "moduleId: Module not found"
      )
    }

    if (createdBy === null || createdBy.role !== Role.STAFF) {
      return validationError<AssessmentWithRelations>(
        "createdById: Staff user not found"
      )
    }

    const assessment = await prisma.assessment.create({
      data: {
        moduleId: validation.data.moduleId,
        title: validation.data.title,
        deadline: validation.data.deadline,
        createdById,
      },
      select: assessmentListSelect,
    })
    const response: ApiResponse<AssessmentWithRelations> = {
      data: serializeAssessment(assessment),
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch {
    return internalServerError<AssessmentWithRelations>()
  }
}

function validateAssessmentInput(body: unknown): ApiResponse<AssessmentInput> {
  if (!isRecord(body)) {
    return { data: null, error: "body: Request body must be a JSON object" }
  }

  const errors: string[] = []
  const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const deadlineValue =
    typeof body.deadline === "string" ? body.deadline.trim() : ""
  const deadline = parseDateTime(deadlineValue)

  if (moduleId === "") {
    errors.push("moduleId: Module is required")
  }

  if (title === "") {
    errors.push("title: Title is required")
  } else if (title.length > 200) {
    errors.push("title: Title must not exceed 200 characters")
  }

  if (deadline === null) {
    errors.push("deadline: Enter a valid deadline")
  } else if (deadline <= new Date()) {
    errors.push("deadline: Deadline must be in the future")
  }

  if (errors.length > 0 || deadline === null) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: { moduleId, title, deadline },
    error: null,
  }
}

function parseDateTime(value: string): Date | null {
  if (value === "") {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
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

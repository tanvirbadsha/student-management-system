import { prisma } from "@/lib/prisma"
import {
  assessmentDetailSelect,
  assessmentListSelect,
  serializeAssessment,
  serializeAssessmentDetail,
} from "@/lib/server/assessment-records"
import type {
  ApiResponse,
  AssessmentDetail,
  AssessmentMutationResponse,
  AssessmentWithRelations,
} from "@/lib/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

type AssessmentUpdateInput = {
  title?: string
  deadline?: Date
}

const DEADLINE_WARNING =
  "Deadline changed after submissions exist. Existing is_late flags are not recalculated."

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: assessmentDetailSelect,
    })

    if (assessment === null) {
      return notFoundError<AssessmentDetail>("Assessment not found")
    }

    const response: ApiResponse<AssessmentDetail> = {
      data: serializeAssessmentDetail(assessment),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<AssessmentDetail>()
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<AssessmentWithRelations>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateUpdateInput(body)

  if (validation.error !== null) {
    return validationError<AssessmentWithRelations>(validation.error)
  }

  try {
    const existing = await prisma.assessment.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { submissions: true },
        },
      },
    })

    if (existing === null) {
      return notFoundError<AssessmentWithRelations>("Assessment not found")
    }

    if (
      validation.data.deadline !== undefined &&
      existing._count.submissions === 0 &&
      validation.data.deadline <= new Date()
    ) {
      return validationError<AssessmentWithRelations>(
        "deadline: Deadline must be in the future"
      )
    }

    const assessment = await prisma.assessment.update({
      where: { id },
      data: validation.data,
      select: assessmentListSelect,
    })
    const response: AssessmentMutationResponse = {
      data: serializeAssessment(assessment),
      error: null,
      ...(validation.data.deadline !== undefined &&
      existing._count.submissions > 0
        ? { warning: DEADLINE_WARNING }
        : {}),
    }

    return Response.json(response)
  } catch {
    return internalServerError<AssessmentWithRelations>()
  }
}

function validateUpdateInput(
  body: unknown
): ApiResponse<AssessmentUpdateInput> {
  if (!isRecord(body)) {
    return { data: null, error: "body: Request body must be a JSON object" }
  }

  const data: AssessmentUpdateInput = {}
  const errors: string[] = []

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : ""

    if (title === "") {
      errors.push("title: Title is required")
    } else if (title.length > 200) {
      errors.push("title: Title must not exceed 200 characters")
    } else {
      data.title = title
    }
  }

  if ("deadline" in body) {
    const deadline =
      typeof body.deadline === "string" ? new Date(body.deadline) : null

    if (deadline === null || Number.isNaN(deadline.getTime())) {
      errors.push("deadline: Enter a valid deadline")
    } else {
      data.deadline = deadline
    }
  }

  if (Object.keys(data).length === 0 && errors.length === 0) {
    errors.push("body: Provide title or deadline")
  }

  return errors.length > 0
    ? { data: null, error: errors.join("; ") }
    : { data, error: null }
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

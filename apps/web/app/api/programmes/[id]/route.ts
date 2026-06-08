import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ProgrammeWithModules = Prisma.ProgrammeGetPayload<{
  include: { modules: true }
}>

type ProgrammeUpdateInput = {
  name?: string
  feeAmount?: number
  durationYears?: number
}

type ProgrammeMutationResponse =
  | {
      data: ProgrammeWithModules
      error: null
      warning?: string
    }
  | { data: null; error: string }

const FEE_UPDATE_WARNING =
  "Fee amount updated. Existing student fees are not affected."

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<ProgrammeWithModules>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateUpdateInput(body)

  if (validation.error !== null) {
    return validationError<ProgrammeWithModules>(validation.error)
  }

  try {
    const existing = await prisma.programme.findUnique({
      where: { id },
      select: { id: true, feeAmount: true },
    })

    if (existing === null) {
      return notFoundError<ProgrammeWithModules>("Programme not found")
    }

    const feeChanged =
      validation.data.feeAmount !== undefined &&
      !existing.feeAmount.equals(validation.data.feeAmount)

    const programme = await prisma.programme.update({
      where: { id },
      data: validation.data,
      include: {
        modules: {
          orderBy: { title: "asc" },
        },
      },
    })

    const response: ProgrammeMutationResponse = {
      data: programme,
      error: null,
      ...(feeChanged ? { warning: FEE_UPDATE_WARNING } : {}),
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError<ProgrammeWithModules>("Programme not found")
    }

    return internalServerError<ProgrammeWithModules>()
  }
}

function validateUpdateInput(
  body: unknown
): ApiResponse<ProgrammeUpdateInput> {
  if (!isRecord(body)) {
    return { data: null, error: "body: Request body must be a JSON object" }
  }

  const data: ProgrammeUpdateInput = {}
  const errors: string[] = []

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : ""

    if (name === "") {
      errors.push("name: Name is required")
    } else {
      data.name = name
    }
  }

  if ("feeAmount" in body) {
    const feeAmount = body.feeAmount

    if (
      typeof feeAmount !== "number" ||
      !Number.isFinite(feeAmount) ||
      feeAmount <= 0
    ) {
      errors.push("feeAmount: Fee amount must be greater than 0")
    } else {
      data.feeAmount = feeAmount
    }
  }

  if ("durationYears" in body) {
    const durationYears = body.durationYears

    if (
      typeof durationYears !== "number" ||
      !Number.isInteger(durationYears) ||
      durationYears < 1
    ) {
      errors.push(
        "durationYears: Duration years must be an integer of at least 1"
      )
    } else {
      data.durationYears = durationYears
    }
  }

  if (Object.keys(data).length === 0 && errors.length === 0) {
    errors.push("body: Provide name, feeAmount, or durationYears")
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

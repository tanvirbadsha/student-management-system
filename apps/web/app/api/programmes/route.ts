import { Prisma, type Programme } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type ProgrammeWithModules = Prisma.ProgrammeGetPayload<{
  include: { modules: true }
}>

type ProgrammeInput = {
  name: string
  code: string
  feeAmount: number
  durationYears: number
}

const PROGRAMME_CODE_PATTERN = /^[A-Z0-9-]+$/

export async function GET() {
  try {
    const programmes = await prisma.programme.findMany({
      include: {
        modules: {
          orderBy: { title: "asc" },
        },
      },
      orderBy: { name: "asc" },
    })

    const response: ApiResponse<ProgrammeWithModules[]> = {
      data: programmes,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<ProgrammeWithModules[]>()
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<Programme>("body: Request body must be valid JSON")
  }

  const validation = validateProgrammeInput(body)

  if (validation.error !== null) {
    return validationError<Programme>(validation.error)
  }

  try {
    const existingProgramme = await prisma.programme.findUnique({
      where: { code: validation.data.code },
      select: { id: true },
    })

    if (existingProgramme !== null) {
      return conflictError<Programme>("code: Programme code already exists")
    }

    const programme = await prisma.programme.create({
      data: validation.data,
    })

    const response: ApiResponse<Programme> = {
      data: programme,
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError<Programme>("code: Programme code already exists")
    }

    return internalServerError<Programme>()
  }
}

function validateProgrammeInput(body: unknown): ApiResponse<ProgrammeInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""
  const feeAmount = body.feeAmount
  const durationYears = body.durationYears

  if (name === "") {
    errors.push("name: Name is required")
  }

  if (code === "") {
    errors.push("code: Code is required")
  } else if (!PROGRAMME_CODE_PATTERN.test(code)) {
    errors.push(
      "code: Code must contain uppercase letters, numbers, and hyphens only"
    )
  }

  if (
    typeof feeAmount !== "number" ||
    !Number.isFinite(feeAmount) ||
    feeAmount <= 0
  ) {
    errors.push("feeAmount: Fee amount must be greater than 0")
  }

  if (
    typeof durationYears !== "number" ||
    !Number.isInteger(durationYears) ||
    durationYears < 1
  ) {
    errors.push(
      "durationYears: Duration years must be an integer of at least 1"
    )
  }

  if (errors.length > 0) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: {
      name,
      code,
      feeAmount: feeAmount as number,
      durationYears: durationYears as number,
    },
    error: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 400 })
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

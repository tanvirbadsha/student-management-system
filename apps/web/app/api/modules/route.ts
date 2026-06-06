import { Prisma, type Module } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type ModuleInput = {
  programmeId: string
  title: string
  code: string
}

export async function GET(request: Request) {
  const programmeId = new URL(request.url).searchParams
    .get("programmeId")
    ?.trim()

  if (!programmeId) {
    return validationError<Module[]>("programmeId: Programme ID is required")
  }

  try {
    const modules = await prisma.module.findMany({
      where: { programmeId },
      orderBy: { title: "asc" },
    })

    const response: ApiResponse<Module[]> = {
      data: modules,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<Module[]>()
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<Module>("body: Request body must be valid JSON")
  }

  const validation = validateModuleInput(body)

  if (validation.error !== null) {
    return validationError<Module>(validation.error)
  }

  try {
    const programme = await prisma.programme.findUnique({
      where: { id: validation.data.programmeId },
      select: { id: true },
    })

    if (programme === null) {
      return notFoundError<Module>("programmeId: Programme not found")
    }

    const existingModule = await prisma.module.findUnique({
      where: { code: validation.data.code },
      select: { id: true },
    })

    if (existingModule !== null) {
      return conflictError<Module>("code: Module code already exists")
    }

    const createdModule = await prisma.module.create({
      data: validation.data,
    })

    const response: ApiResponse<Module> = {
      data: createdModule,
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflictError<Module>("code: Module code already exists")
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return notFoundError<Module>("programmeId: Programme not found")
    }

    return internalServerError<Module>()
  }
}

function validateModuleInput(body: unknown): ApiResponse<ModuleInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const programmeId =
    typeof body.programmeId === "string" ? body.programmeId.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const code = typeof body.code === "string" ? body.code.trim() : ""

  if (programmeId === "") {
    errors.push("programmeId: Programme ID is required")
  }

  if (title === "") {
    errors.push("title: Title is required")
  }

  if (code === "") {
    errors.push("code: Code is required")
  }

  if (errors.length > 0) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: { programmeId, title, code },
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

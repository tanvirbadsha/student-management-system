import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ModuleWithAssessmentCount = Prisma.ModuleGetPayload<{
  include: {
    _count: {
      select: { assessments: true }
    }
  }
}>

type DeleteModuleResponse = {
  deleted: true
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const moduleRecord = await prisma.module.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assessments: true },
        },
      },
    })

    if (moduleRecord === null) {
      return notFoundError<ModuleWithAssessmentCount>("Module not found")
    }

    const response: ApiResponse<ModuleWithAssessmentCount> = {
      data: moduleRecord,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<ModuleWithAssessmentCount>()
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const moduleRecord = await prisma.module.findUnique({
      where: { id },
      select: {
        id: true,
        _count: {
          select: { assessments: true },
        },
      },
    })

    if (moduleRecord === null) {
      return notFoundError<DeleteModuleResponse>("Module not found")
    }

    if (moduleRecord._count.assessments > 0) {
      return validationError<DeleteModuleResponse>(
        `This module has ${moduleRecord._count.assessments} assessments and cannot be deleted. Archive the assessments first.`
      )
    }

    await prisma.module.delete({ where: { id } })

    const response: ApiResponse<DeleteModuleResponse> = {
      data: { deleted: true },
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError<DeleteModuleResponse>("Module not found")
    }

    return internalServerError<DeleteModuleResponse>()
  }
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

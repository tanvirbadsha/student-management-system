import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"
import { deleteUploadedFile } from "@/lib/upload"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        fileUrl: true,
        assessment: {
          select: { deadline: true },
        },
      },
    })

    if (submission === null) {
      return notFoundError<{ deleted: true }>("Submission not found")
    }

    if (new Date() > submission.assessment.deadline) {
      return forbiddenError<{ deleted: true }>(
        "Cannot delete a submission after the deadline"
      )
    }

    await deleteUploadedFile(submission.fileUrl)
    await prisma.submission.delete({ where: { id } })

    const response: ApiResponse<{ deleted: true }> = {
      data: { deleted: true },
      error: null,
    }
    return Response.json(response)
  } catch {
    return internalServerError<{ deleted: true }>()
  }
}

function notFoundError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 404 })
}

function forbiddenError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function internalServerError<T>() {
  const response: ApiResponse<T> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

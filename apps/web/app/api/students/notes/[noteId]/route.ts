import { Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/lib/types"

type RouteContext = {
  params: Promise<{ noteId: string }>
}

type DeleteNoteResponse = {
  deleted: true
}

export async function DELETE(request: Request, context: RouteContext) {
  const { noteId } = await context.params
  const role = request.headers.get("x-user-role")?.trim()
  const userId = request.headers.get("x-user-id")?.trim() ?? ""

  if (role !== Role.STAFF) {
    return forbiddenError("Staff access required")
  }

  if (userId === "") {
    return forbiddenError("x-user-id header is required")
  }

  try {
    const note = await prisma.studentNote.findUnique({
      where: { id: noteId },
      select: { id: true, authorId: true },
    })

    if (note === null) {
      return notFoundError("Note not found")
    }

    if (note.authorId !== userId) {
      return forbiddenError("Only the author of the note can delete it")
    }

    await prisma.studentNote.delete({ where: { id: noteId } })

    const response: ApiResponse<DeleteNoteResponse> = {
      data: { deleted: true },
      error: null,
    }

    return Response.json(response)
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return notFoundError("Note not found")
    }

    return internalServerError()
  }
}

function forbiddenError(error: string) {
  const response: ApiResponse<DeleteNoteResponse> = { data: null, error }
  return Response.json(response, { status: 403 })
}

function notFoundError(error: string) {
  const response: ApiResponse<DeleteNoteResponse> = { data: null, error }
  return Response.json(response, { status: 404 })
}

function internalServerError() {
  const response: ApiResponse<DeleteNoteResponse> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

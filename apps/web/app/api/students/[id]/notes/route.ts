import { Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse, StudentNoteRecord } from "@/lib/types"

type RouteContext = {
  params: Promise<{ id: string }>
}

type NoteInput = {
  content: string
}

const noteSelect = {
  id: true,
  authorId: true,
  content: true,
  createdAt: true,
  author: {
    select: {
      fullName: true,
    },
  },
} satisfies Prisma.StudentNoteSelect

type NotePayload = Prisma.StudentNoteGetPayload<{
  select: typeof noteSelect
}>

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const role = request.headers.get("x-user-role")?.trim()

  if (role !== Role.STAFF) {
    return forbiddenError<StudentNoteRecord[]>("Staff access required")
  }

  try {
    const notes = await prisma.studentNote.findMany({
      where: { studentId: id },
      select: noteSelect,
      orderBy: { createdAt: "desc" },
    })
    const response: ApiResponse<StudentNoteRecord[]> = {
      data: notes.map(serializeNote),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<StudentNoteRecord[]>()
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const role = request.headers.get("x-user-role")?.trim()
  const authorId = request.headers.get("x-user-id")?.trim() ?? ""

  if (role !== Role.STAFF) {
    return forbiddenError<StudentNoteRecord>("Staff access required")
  }

  if (authorId === "") {
    return forbiddenError<StudentNoteRecord>("x-user-id header is required")
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<StudentNoteRecord>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateNoteInput(body)

  if (validation.error !== null) {
    return validationError<StudentNoteRecord>(validation.error)
  }

  try {
    const note = await prisma.studentNote.create({
      data: {
        studentId: id,
        authorId,
        content: validation.data.content,
      },
      select: noteSelect,
    })
    const response: ApiResponse<StudentNoteRecord> = {
      data: serializeNote(note),
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return notFoundError<StudentNoteRecord>("Student or author not found")
    }

    return internalServerError<StudentNoteRecord>()
  }
}

function validateNoteInput(body: unknown): ApiResponse<NoteInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const content = typeof body.content === "string" ? body.content.trim() : ""

  if (content === "") {
    return { data: null, error: "content: Note content is required" }
  }

  if (content.length > 1000) {
    return {
      data: null,
      error: "content: Note content must be 1000 characters or fewer",
    }
  }

  return { data: { content }, error: null }
}

function serializeNote(note: NotePayload): StudentNoteRecord {
  return {
    ...note,
    createdAt: note.createdAt.toISOString(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validationError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 400 })
}

function forbiddenError<T>(error: string) {
  const response: ApiResponse<T> = { data: null, error }
  return Response.json(response, { status: 403 })
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

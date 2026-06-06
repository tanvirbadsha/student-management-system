import bcrypt from "bcryptjs"
import { EnrolmentStatus, Prisma, Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  serializeStudent,
  studentListSelect,
} from "@/lib/server/student-records"
import type {
  ApiResponse,
  PaginatedApiResponse,
  StudentMutationResponse,
  StudentWithRelations,
} from "@/lib/types"
import { generateStudentId } from "@/lib/utils"

type StudentCreateInput = {
  fullName: string
  email: string
  dateOfBirth: Date
  programmeId: string
  academicYear: number
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ENROLMENT_RETRIES = 3

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const status = searchParams.get("status")?.trim() ?? ""
  const pageResult = parsePositiveInteger(searchParams.get("page"), 1, "page")
  const limitResult = parsePositiveInteger(
    searchParams.get("limit"),
    20,
    "limit",
    100
  )

  if (pageResult.error !== null) {
    return validationError<StudentWithRelations[]>(pageResult.error)
  }

  if (limitResult.error !== null) {
    return validationError<StudentWithRelations[]>(limitResult.error)
  }

  if (
    status !== "" &&
    !Object.values(EnrolmentStatus).includes(status as EnrolmentStatus)
  ) {
    return validationError<StudentWithRelations[]>(
      "status: Invalid enrolment status"
    )
  }

  const search = searchParams.get("search")?.trim() ?? ""
  const programmeId = searchParams.get("programme")?.trim() ?? ""
  const page = pageResult.data
  const limit = limitResult.data

  const where: Prisma.StudentWhereInput = {
    ...(programmeId !== "" ? { programmeId } : {}),
    ...(status !== "" ? { status: status as EnrolmentStatus } : {}),
    ...(search !== ""
      ? {
          OR: [
            {
              studentId: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              user: {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  }

  try {
    const [students, total] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        select: studentListSelect,
        orderBy: { enrolledAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student.count({ where }),
    ])

    const response: PaginatedApiResponse<StudentWithRelations[]> = {
      data: students.map(serializeStudent),
      error: null,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }

    return Response.json(response)
  } catch {
    return internalServerError<StudentWithRelations[]>()
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return validationError<StudentWithRelations>(
      "body: Request body must be valid JSON"
    )
  }

  const validation = validateStudentCreateInput(body)

  if (validation.error !== null) {
    return validationError<StudentWithRelations>(validation.error)
  }

  try {
    const programme = await prisma.programme.findUnique({
      where: { id: validation.data.programmeId },
      select: {
        id: true,
        durationYears: true,
      },
    })

    if (programme === null) {
      return validationError<StudentWithRelations>(
        "programmeId: Programme not found"
      )
    }

    if (validation.data.academicYear > programme.durationYears) {
      return validationError<StudentWithRelations>(
        `academicYear: Academic year cannot exceed ${programme.durationYears}`
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: validation.data.email },
      select: { id: true },
    })

    if (existingUser !== null) {
      return conflictError<StudentWithRelations>(
        "email: A user with this email already exists"
      )
    }

    const passwordHash = await bcrypt.hash("password123", 12)
    const student = await enrolStudent(validation.data, passwordHash)
    const response: StudentMutationResponse = {
      data: serializeStudent(student),
      error: null,
    }

    return Response.json(response, { status: 201 })
  } catch (error) {
    if (isUniqueConstraintError(error, "email")) {
      return conflictError<StudentWithRelations>(
        "email: A user with this email already exists"
      )
    }

    return internalServerError<StudentWithRelations>()
  }
}

async function enrolStudent(input: StudentCreateInput, passwordHash: string) {
  for (let attempt = 1; attempt <= MAX_ENROLMENT_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const programme = await tx.programme.findUniqueOrThrow({
            where: { id: input.programmeId },
            select: { feeAmount: true },
          })
          const count = await tx.student.count()
          const dueDate = addUtcMonths(startOfUtcDay(new Date()), 6)

          const user = await tx.user.create({
            data: {
              fullName: input.fullName,
              email: input.email,
              passwordHash,
              role: Role.STUDENT,
            },
          })

          const student = await tx.student.create({
            data: {
              userId: user.id,
              programmeId: input.programmeId,
              studentId: generateStudentId(
                new Date().getUTCFullYear(),
                count + 1
              ),
              academicYear: input.academicYear,
              dateOfBirth: input.dateOfBirth,
              fee: {
                create: {
                  totalAmount: programme.feeAmount,
                  amountPaid: 0,
                  outstanding: programme.feeAmount,
                  dueDate,
                  isOverdue: false,
                },
              },
            },
            select: studentListSelect,
          })

          return student
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
        }
      )
    } catch (error) {
      const canRetry =
        attempt < MAX_ENROLMENT_RETRIES &&
        (isTransactionConflict(error) ||
          isUniqueConstraintError(error, "student_id"))

      if (!canRetry) {
        throw error
      }
    }
  }

  throw new Error("Unable to enrol student")
}

function validateStudentCreateInput(
  body: unknown
): ApiResponse<StudentCreateInput> {
  if (!isRecord(body)) {
    return {
      data: null,
      error: "body: Request body must be a JSON object",
    }
  }

  const errors: string[] = []
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const programmeId =
    typeof body.programmeId === "string" ? body.programmeId.trim() : ""
  const academicYear = body.academicYear
  const dateOfBirthValue =
    typeof body.dateOfBirth === "string" ? body.dateOfBirth.trim() : ""
  const dateOfBirth = parseIsoDate(dateOfBirthValue)

  if (fullName === "") {
    errors.push("fullName: Full name is required")
  }

  if (!EMAIL_PATTERN.test(email)) {
    errors.push("email: Enter a valid email address")
  }

  if (dateOfBirth === null) {
    errors.push("dateOfBirth: Enter a valid date of birth")
  } else if (!isAtLeast16(dateOfBirth)) {
    errors.push("dateOfBirth: Student must be at least 16 years old")
  }

  if (programmeId === "") {
    errors.push("programmeId: Programme is required")
  }

  if (
    typeof academicYear !== "number" ||
    !Number.isInteger(academicYear) ||
    academicYear < 1
  ) {
    errors.push("academicYear: Academic year must be at least 1")
  }

  if (errors.length > 0 || dateOfBirth === null) {
    return { data: null, error: errors.join("; ") }
  }

  return {
    data: {
      fullName,
      email,
      dateOfBirth,
      programmeId,
      academicYear: academicYear as number,
    },
    error: null,
  }
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  field: string,
  maximum?: number
): ApiResponse<number> {
  if (value === null || value.trim() === "") {
    return { data: fallback, error: null }
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return { data: null, error: `${field}: Must be a positive integer` }
  }

  if (maximum !== undefined && parsed > maximum) {
    return { data: null, error: `${field}: Must not exceed ${maximum}` }
  }

  return { data: parsed, error: null }
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (match === null) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function isAtLeast16(dateOfBirth: Date): boolean {
  const today = startOfUtcDay(new Date())
  const latestEligibleDate = new Date(today)
  latestEligibleDate.setUTCFullYear(latestEligibleDate.getUTCFullYear() - 16)
  return dateOfBirth < today && dateOfBirth <= latestEligibleDate
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    JSON.stringify(error.meta?.target ?? "")
      .toLowerCase()
      .includes(field)
  )
}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
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

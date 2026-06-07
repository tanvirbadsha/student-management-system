import { EnrolmentStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  serializeSubmission,
  submissionRelationsSelect,
} from "@/lib/server/assessment-records"
import type { ApiResponse, SubmissionWithRelations } from "@/lib/types"
import { deleteUploadedFile, saveFile } from "@/lib/upload"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const assessmentId = searchParams.get("assessmentId")?.trim() ?? ""
  const studentId = searchParams.get("studentId")?.trim() ?? ""

  if (assessmentId === "" && studentId === "") {
    return validationError<SubmissionWithRelations[]>(
      "assessmentId or studentId is required"
    )
  }

  try {
    const submissions = await prisma.submission.findMany({
      where: {
        ...(assessmentId !== "" ? { assessmentId } : {}),
        ...(studentId !== "" ? { studentId } : {}),
      },
      select: submissionRelationsSelect,
      orderBy: { submittedAt: "desc" },
    })
    const response: ApiResponse<SubmissionWithRelations[]> = {
      data: submissions.map(serializeSubmission),
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError<SubmissionWithRelations[]>()
  }
}

export async function POST(request: Request) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return validationError<SubmissionWithRelations>(
      "Request body must be multipart/form-data"
    )
  }

  const assessmentId = stringField(formData.get("assessmentId"))
  const studentId = stringField(formData.get("studentId"))
  const lateConfirmed = stringField(formData.get("lateConfirmed")) === "true"
  const fileValue = formData.get("file")

  if (assessmentId === "") {
    return validationError<SubmissionWithRelations>(
      "assessmentId: Assessment is required"
    )
  }

  if (studentId === "") {
    return validationError<SubmissionWithRelations>(
      "studentId: Student is required"
    )
  }

  if (!(fileValue instanceof File)) {
    return validationError<SubmissionWithRelations>("file: File is required")
  }

  try {
    const [assessment, student, existing] = await Promise.all([
      prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: {
          id: true,
          deadline: true,
          module: {
            select: { programmeId: true },
          },
        },
      }),
      prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, programmeId: true, status: true },
      }),
      prisma.submission.findUnique({
        where: {
          assessmentId_studentId: {
            assessmentId,
            studentId,
          },
        },
        select: {
          id: true,
          fileUrl: true,
        },
      }),
    ])

    if (assessment === null) {
      return notFoundError<SubmissionWithRelations>("Assessment not found")
    }

    if (student === null) {
      return notFoundError<SubmissionWithRelations>("Student not found")
    }

    if (
      student.status === EnrolmentStatus.WITHDRAWN ||
      student.status === EnrolmentStatus.COMPLETED
    ) {
      return validationError<SubmissionWithRelations>(
        "Your enrolment is not active. Contact Registry."
      )
    }

    if (student.programmeId !== assessment.module.programmeId) {
      return validationError<SubmissionWithRelations>(
        "Assessment is not part of the student's programme"
      )
    }

    const submittedAt = new Date()
    const isLate = submittedAt > assessment.deadline

    if (existing === null && isLate && !lateConfirmed) {
      return validationError<SubmissionWithRelations>(
        "Late submission confirmation is required"
      )
    }

    if (existing !== null && isLate) {
      return validationError<SubmissionWithRelations>(
        "The deadline has passed. Resubmission is no longer allowed."
      )
    }

    let savedFile: Awaited<ReturnType<typeof saveFile>>

    try {
      savedFile = await saveFile(fileValue, studentId, assessmentId)
    } catch (error) {
      return validationError<SubmissionWithRelations>(
        error instanceof Error ? error.message : "Could not save file"
      )
    }

    try {
      const submission =
        existing === null
          ? await prisma.submission.create({
              data: {
                assessmentId,
                studentId,
                fileUrl: savedFile.fileUrl,
                fileType: savedFile.fileType,
                submittedAt,
                isLate,
              },
              select: submissionRelationsSelect,
            })
          : await prisma.submission.update({
              where: { id: existing.id },
              data: {
                fileUrl: savedFile.fileUrl,
                fileType: savedFile.fileType,
                submittedAt,
                isLate,
              },
              select: submissionRelationsSelect,
            })

      if (existing !== null) {
        await deleteUploadedFile(existing.fileUrl)
      }

      const response: ApiResponse<SubmissionWithRelations> = {
        data: serializeSubmission(submission),
        error: null,
      }
      return Response.json(response, { status: 201 })
    } catch (error) {
      await deleteUploadedFile(savedFile.fileUrl)
      throw error
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationError<SubmissionWithRelations>(
        "A submission already exists for this assessment"
      )
    }

    return internalServerError<SubmissionWithRelations>()
  }
}

function stringField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : ""
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

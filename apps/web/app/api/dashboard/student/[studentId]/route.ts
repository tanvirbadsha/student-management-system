import { prisma } from "@/lib/prisma"
import {
  assessmentListSelect,
  serializeAssessment,
} from "@/lib/server/assessment-records"
import {
  feeWithPaymentsInclude,
  serializeFeeWithPayments,
} from "@/lib/server/fee-records"
import {
  resultRelationsSelect,
  serializeResult,
} from "@/lib/server/result-records"
import {
  serializeStudent,
  studentListSelect,
} from "@/lib/server/student-records"
import type { ApiResponse, StudentDashboardData } from "@/lib/types"

type RouteContext = {
  params: Promise<{ studentId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { studentId } = await context.params
  const now = new Date()

  try {
    const [
      studentRecord,
      feeRecord,
      recentResultRecords,
      openAssessmentRecords,
      submissionGroups,
      publishedResultStats,
    ] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        select: studentListSelect,
      }),
      prisma.fee.findUnique({
        where: { studentId },
        include: feeWithPaymentsInclude,
      }),
      prisma.result.findMany({
        where: {
          studentId,
          isPublished: true,
        },
        select: resultRelationsSelect,
        orderBy: { gradedAt: "desc" },
        take: 3,
      }),
      prisma.assessment.findMany({
        where: {
          deadline: { gt: now },
          isArchived: false,
          module: {
            programme: {
              students: {
                some: { id: studentId },
              },
            },
          },
        },
        select: {
          ...assessmentListSelect,
          submissions: {
            where: { studentId },
            select: {
              id: true,
              submittedAt: true,
              isLate: true,
            },
            take: 1,
          },
        },
        orderBy: { deadline: "asc" },
      }),
      prisma.submission.groupBy({
        by: ["isLate"],
        where: { studentId },
        _count: { _all: true },
      }),
      prisma.result.aggregate({
        where: {
          studentId,
          isPublished: true,
        },
        _count: { _all: true },
        _avg: { grade: true },
      }),
    ])

    if (studentRecord === null) {
      return notFoundError()
    }

    const openAssessments = openAssessmentRecords.map((record) => ({
      assessment: serializeAssessment(record),
      submission:
        record.submissions[0] === undefined
          ? null
          : {
              ...record.submissions[0],
              submittedAt: record.submissions[0].submittedAt.toISOString(),
            },
    }))
    const onTime =
      submissionGroups.find((entry) => entry.isLate === false)?._count._all ?? 0
    const late =
      submissionGroups.find((entry) => entry.isLate === true)?._count._all ?? 0
    const data: StudentDashboardData = {
      student: serializeStudent(studentRecord),
      fee: feeRecord === null ? null : serializeFeeWithPayments(feeRecord),
      recentResults: recentResultRecords.map(serializeResult),
      openAssessments,
      submissionStats: {
        total: onTime + late,
        onTime,
        late,
        notSubmitted: openAssessments.filter(
          (entry) => entry.submission === null
        ).length,
      },
      resultStats: {
        published: publishedResultStats._count._all,
        averageGrade:
          publishedResultStats._avg.grade === null
            ? null
            : Math.round(publishedResultStats._avg.grade * 10) / 10,
      },
    }
    const response: ApiResponse<StudentDashboardData> = {
      data,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError()
  }
}

function notFoundError() {
  const response: ApiResponse<StudentDashboardData> = {
    data: null,
    error: "Student not found",
  }
  return Response.json(response, { status: 404 })
}

function internalServerError() {
  const response: ApiResponse<StudentDashboardData> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

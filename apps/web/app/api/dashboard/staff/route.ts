import { EnrolmentStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  assessmentListSelect,
  serializeAssessment,
} from "@/lib/server/assessment-records"
import { serializePayment } from "@/lib/server/fee-records"
import {
  serializeStudent,
  studentListSelect,
} from "@/lib/server/student-records"
import type { ApiResponse, StaffDashboardData } from "@/lib/types"

export async function GET() {
  const now = new Date()

  try {
    const [
      groupedStudentCounts,
      overdueFees,
      openAssessmentRecords,
      pendingGrades,
      recentEnrolmentRecords,
      recentPaymentRecords,
    ] = await Promise.all([
      prisma.student.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.fee.aggregate({
        where: {
          isOverdue: true,
          isWaived: false,
          outstanding: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { outstanding: true },
      }),
      prisma.assessment.findMany({
        where: { deadline: { gt: now }, isArchived: false },
        select: assessmentListSelect,
        orderBy: { deadline: "asc" },
      }),
      prisma.submission.count({
        where: { result: { is: null } },
      }),
      prisma.student.findMany({
        select: studentListSelect,
        orderBy: { enrolledAt: "desc" },
        take: 5,
      }),
      prisma.payment.findMany({
        select: {
          id: true,
          feeId: true,
          amount: true,
          paymentDate: true,
          referenceNumber: true,
          createdAt: true,
          fee: {
            select: {
              student: {
                select: {
                  studentId: true,
                  user: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
    ])

    const counts = new Map(
      groupedStudentCounts.map((entry) => [entry.status, entry._count._all])
    )
    const assessments = openAssessmentRecords.map(serializeAssessment)
    const data: StaffDashboardData = {
      studentCounts: {
        total: groupedStudentCounts.reduce(
          (total, entry) => total + entry._count._all,
          0
        ),
        enrolled: counts.get(EnrolmentStatus.ENROLLED) ?? 0,
        deferred: counts.get(EnrolmentStatus.DEFERRED) ?? 0,
        withdrawn: counts.get(EnrolmentStatus.WITHDRAWN) ?? 0,
        completed: counts.get(EnrolmentStatus.COMPLETED) ?? 0,
      },
      overdueFees: {
        count: overdueFees._count._all,
        totalOutstanding: overdueFees._sum.outstanding?.toNumber() ?? 0,
      },
      openAssessments: {
        count: assessments.length,
        totalSubmissions: assessments.reduce(
          (total, assessment) => total + assessment._count.submissions,
          0
        ),
        assessments,
      },
      pendingGrades,
      recentEnrolments: recentEnrolmentRecords.map(serializeStudent),
      recentPayments: recentPaymentRecords.map(({ fee, ...payment }) => ({
        payment: serializePayment(payment),
        student: fee.student,
      })),
    }
    const response: ApiResponse<StaffDashboardData> = {
      data,
      error: null,
    }

    return Response.json(response)
  } catch {
    return internalServerError()
  }
}

function internalServerError() {
  const response: ApiResponse<StaffDashboardData> = {
    data: null,
    error: "Internal server error",
  }
  return Response.json(response, { status: 500 })
}

import { Prisma } from "@prisma/client"

import type { StudentDetail, StudentWithRelations } from "@/lib/types"

export const studentListSelect = {
  id: true,
  studentId: true,
  academicYear: true,
  status: true,
  enrolledAt: true,
  dateOfBirth: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  programme: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  fee: {
    select: {
      id: true,
      outstanding: true,
      isOverdue: true,
      dueDate: true,
      totalAmount: true,
      amountPaid: true,
    },
  },
} satisfies Prisma.StudentSelect

export const studentDetailSelect = {
  ...studentListSelect,
  submissions: {
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      submittedAt: true,
      isLate: true,
      assessment: {
        select: {
          id: true,
          title: true,
          deadline: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  },
  results: {
    select: {
      id: true,
      grade: true,
      classification: true,
      isPublished: true,
      gradedAt: true,
      assessment: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { gradedAt: "desc" },
  },
} satisfies Prisma.StudentSelect

type StudentRecord = Prisma.StudentGetPayload<{
  select: typeof studentListSelect
}>

type StudentDetailRecord = Prisma.StudentGetPayload<{
  select: typeof studentDetailSelect
}>

export function serializeStudent(student: StudentRecord): StudentWithRelations {
  return {
    ...student,
    enrolledAt: student.enrolledAt.toISOString(),
    dateOfBirth: student.dateOfBirth.toISOString(),
    fee:
      student.fee === null
        ? null
        : {
            ...student.fee,
            totalAmount: student.fee.totalAmount.toNumber(),
            amountPaid: student.fee.amountPaid.toNumber(),
            outstanding: student.fee.outstanding.toNumber(),
            dueDate: student.fee.dueDate.toISOString(),
          },
  }
}

export function serializeStudentDetail(
  student: StudentDetailRecord
): StudentDetail {
  return {
    ...serializeStudent(student),
    submissions: student.submissions.map((submission) => ({
      ...submission,
      submittedAt: submission.submittedAt.toISOString(),
      assessment: {
        ...submission.assessment,
        deadline: submission.assessment.deadline.toISOString(),
      },
    })),
    results: student.results.map((result) => ({
      ...result,
      gradedAt: result.gradedAt.toISOString(),
    })),
  }
}

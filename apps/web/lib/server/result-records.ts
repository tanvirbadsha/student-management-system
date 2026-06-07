import { Classification, Prisma } from "@prisma/client"

import type { MarksheetSummary, ResultWithRelations } from "@/lib/types"

export const resultRelationsSelect = {
  id: true,
  submissionId: true,
  studentId: true,
  assessmentId: true,
  grade: true,
  classification: true,
  isPublished: true,
  gradedAt: true,
  updatedAt: true,
  student: {
    select: {
      id: true,
      studentId: true,
      user: {
        select: {
          fullName: true,
        },
      },
    },
  },
  assessment: {
    select: {
      id: true,
      title: true,
      deadline: true,
      module: {
        select: {
          title: true,
          code: true,
        },
      },
    },
  },
  submission: {
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      submittedAt: true,
      isLate: true,
    },
  },
} satisfies Prisma.ResultSelect

export const marksheetAssessmentSelect = {
  id: true,
  title: true,
  deadline: true,
  module: {
    select: {
      title: true,
      code: true,
    },
  },
} satisfies Prisma.AssessmentSelect

type ResultRecord = Prisma.ResultGetPayload<{
  select: typeof resultRelationsSelect
}>

type MarksheetAssessmentRecord = Prisma.AssessmentGetPayload<{
  select: typeof marksheetAssessmentSelect
}>

export function serializeResult(result: ResultRecord): ResultWithRelations {
  return {
    ...result,
    gradedAt: result.gradedAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    assessment: {
      ...result.assessment,
      deadline: result.assessment.deadline.toISOString(),
    },
    submission: {
      ...result.submission,
      submittedAt: result.submission.submittedAt.toISOString(),
    },
  }
}

export function serializeMarksheetAssessment(
  assessment: MarksheetAssessmentRecord
) {
  return {
    ...assessment,
    deadline: assessment.deadline.toISOString(),
  }
}

export function summarizeResults(
  results: ResultWithRelations[]
): MarksheetSummary {
  const totalGraded = results.length
  const totalPublished = results.filter((result) => result.isPublished).length
  const averageGrade =
    totalGraded === 0
      ? 0
      : Math.round(
          (results.reduce((total, result) => total + result.grade, 0) /
            totalGraded) *
            10
        ) / 10

  return {
    totalGraded,
    totalPublished,
    averageGrade,
    distribution: {
      [Classification.FAIL]: results.filter(
        (result) => result.classification === Classification.FAIL
      ).length,
      [Classification.PASS]: results.filter(
        (result) => result.classification === Classification.PASS
      ).length,
      [Classification.MERIT]: results.filter(
        (result) => result.classification === Classification.MERIT
      ).length,
      [Classification.DISTINCTION]: results.filter(
        (result) => result.classification === Classification.DISTINCTION
      ).length,
    },
  }
}

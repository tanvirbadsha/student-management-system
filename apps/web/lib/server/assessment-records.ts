import { Prisma } from "@prisma/client"

import type {
  AssessmentDetail,
  AssessmentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"

export const assessmentListSelect = {
  id: true,
  title: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  module: {
    select: {
      id: true,
      programmeId: true,
      title: true,
      code: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  _count: {
    select: {
      submissions: true,
    },
  },
} satisfies Prisma.AssessmentSelect

export const submissionRelationsSelect = {
  id: true,
  assessmentId: true,
  studentId: true,
  fileUrl: true,
  fileType: true,
  submittedAt: true,
  isLate: true,
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
          id: true,
          title: true,
          code: true,
        },
      },
    },
  },
  result: {
    select: {
      grade: true,
      classification: true,
      isPublished: true,
    },
  },
} satisfies Prisma.SubmissionSelect

export const assessmentDetailSelect = {
  ...assessmentListSelect,
  submissions: {
    select: submissionRelationsSelect,
    orderBy: {
      submittedAt: "desc",
    },
  },
} satisfies Prisma.AssessmentSelect

type AssessmentListRecord = Prisma.AssessmentGetPayload<{
  select: typeof assessmentListSelect
}>

type AssessmentDetailRecord = Prisma.AssessmentGetPayload<{
  select: typeof assessmentDetailSelect
}>

type SubmissionRecord = Prisma.SubmissionGetPayload<{
  select: typeof submissionRelationsSelect
}>

export function serializeAssessment(
  assessment: AssessmentListRecord
): AssessmentWithRelations {
  return {
    ...assessment,
    deadline: assessment.deadline.toISOString(),
    createdAt: assessment.createdAt.toISOString(),
    updatedAt: assessment.updatedAt.toISOString(),
  }
}

export function serializeSubmission(
  submission: SubmissionRecord
): SubmissionWithRelations {
  return {
    ...submission,
    submittedAt: submission.submittedAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    assessment: {
      ...submission.assessment,
      deadline: submission.assessment.deadline.toISOString(),
    },
  }
}

export function serializeAssessmentDetail(
  assessment: AssessmentDetailRecord
): AssessmentDetail {
  return {
    ...serializeAssessment(assessment),
    submissions: assessment.submissions.map(serializeSubmission),
  }
}

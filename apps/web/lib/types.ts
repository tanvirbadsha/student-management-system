import type {
  Classification as PrismaClassification,
  EnrolmentStatus as PrismaEnrolmentStatus,
  FileType as PrismaFileType,
} from "@prisma/client"

export { Classification, EnrolmentStatus, FileType, Role } from "@prisma/client"

export type RoleToggleState = "STAFF" | "STUDENT"

export type UserListItem = {
  id: string
  fullName: string
  email: string
  role: RoleToggleState
}

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: string }

export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type PaginatedApiResponse<T> =
  | { data: T; error: null; pagination: Pagination }
  | { data: null; error: string }

export type StudentWithRelations = {
  id: string
  studentId: string
  academicYear: number
  status: PrismaEnrolmentStatus
  enrolledAt: string
  withdrawalDate: string | null
  dateOfBirth: string
  user: {
    id: string
    fullName: string
    email: string
  }
  programme: {
    id: string
    name: string
    code: string
  }
  fee: {
    id: string
    outstanding: number
    isOverdue: boolean
    isWaived: boolean
    dueDate: string
    totalAmount: number
    amountPaid: number
  } | null
}

export type StudentDetail = StudentWithRelations & {
  submissions: Array<{
    id: string
    fileUrl: string
    fileType: PrismaFileType
    submittedAt: string
    isLate: boolean
    assessment: {
      id: string
      title: string
      deadline: string
    }
  }>
  results: Array<{
    id: string
    grade: number
    classification: PrismaClassification
    isPublished: boolean
    gradedAt: string
    assessment: {
      id: string
      title: string
    }
  }>
}

export type StudentMutationResponse =
  | { data: StudentWithRelations; error: null; note?: string }
  | { data: null; error: string }

export type StudentNoteRecord = {
  id: string
  authorId: string
  content: string
  createdAt: string
  author: {
    fullName: string
  }
}

export type PaymentRecord = {
  id: string
  feeId: string
  amount: number
  paymentDate: string
  referenceNumber: string
  createdAt: string
}

export type FeeRecord = {
  id: string
  studentId: string
  totalAmount: number
  amountPaid: number
  outstanding: number
  dueDate: string
  isOverdue: boolean
  isWaived: boolean
  createdAt: string
  updatedAt: string
}

export type FeeAdjustmentRecord = {
  id: string
  feeId: string
  adjustmentType: "DISCOUNT" | "WAIVER" | "CORRECTION"
  amount: number | null
  reason: string
  appliedById: string
  createdAt: string
  appliedBy: {
    fullName: string
  }
}

export type FeeWithPayments = FeeRecord & {
  percentagePaid: number
  payments: PaymentRecord[]
  adjustments: FeeAdjustmentRecord[]
}

export type FeeDetailsData = {
  fee: FeeWithPayments
}

export type PaymentMutationData = {
  payment: PaymentRecord
  updatedFee: FeeRecord
}

export type OverdueFeeRecord = {
  id: string
  studentId: string
  fullName: string
  programme: {
    id: string
    name: string
    code: string
  }
  fee: {
    outstanding: number
    dueDate: string
    amountPaid: number
    totalAmount: number
    isWaived: boolean
  }
}

export type AssessmentWithRelations = {
  id: string
  title: string
  deadline: string
  isArchived: boolean
  createdAt: string
  updatedAt: string
  module: {
    id: string
    programmeId: string
    title: string
    code: string
  }
  createdBy: {
    id: string
    fullName: string
  }
  _count: {
    submissions: number
  }
}

export type SubmissionResult = {
  id: string
  grade: number
  classification: PrismaClassification
  isPublished: boolean
  gradedAt: string
  updatedAt: string
}

export type SubmissionWithRelations = {
  id: string
  assessmentId: string
  studentId: string
  fileUrl: string
  fileType: PrismaFileType
  submittedAt: string
  isLate: boolean
  updatedAt: string
  student: {
    id: string
    studentId: string
    user: {
      fullName: string
    }
  }
  assessment: {
    id: string
    title: string
    deadline: string
    isArchived: boolean
    module: {
      id: string
      title: string
      code: string
    }
  }
  result: SubmissionResult | null
}

export type AssessmentDetail = AssessmentWithRelations & {
  submissions: SubmissionWithRelations[]
}

export type AssessmentMutationResponse =
  | {
      data: AssessmentWithRelations
      error: null
      warning?: string
    }
  | { data: null; error: string }

export type ResultWithRelations = {
  id: string
  submissionId: string
  studentId: string
  assessmentId: string
  grade: number
  classification: PrismaClassification
  isPublished: boolean
  gradedAt: string
  updatedAt: string
  student: {
    id: string
    studentId: string
    user: {
      fullName: string
    }
  }
  assessment: {
    id: string
    title: string
    deadline: string
    module: {
      title: string
      code: string
    }
  }
  submission: {
    id: string
    fileUrl: string
    fileType: PrismaFileType
    submittedAt: string
    isLate: boolean
  }
}

export type ResultMutationResponse =
  | {
      data: ResultWithRelations
      error: null
      warning?: string
    }
  | { data: null; error: string }

export type MarksheetSummary = {
  totalGraded: number
  totalPublished: number
  averageGrade: number
  distribution: Record<PrismaClassification, number>
}

export type MarksheetData = {
  assessment: {
    id: string
    title: string
    deadline: string
    module: {
      title: string
      code: string
    }
    submissionCount: number
  }
  results: ResultWithRelations[]
  summary?: MarksheetSummary
}

export type StaffDashboardPayment = {
  payment: PaymentRecord
  student: {
    studentId: string
    user: {
      fullName: string
    }
  }
}

export type StaffDashboardData = {
  studentCounts: {
    total: number
    enrolled: number
    deferred: number
    withdrawn: number
    completed: number
  }
  overdueFees: {
    count: number
    totalOutstanding: number
  }
  openAssessments: {
    count: number
    totalSubmissions: number
    assessments: AssessmentWithRelations[]
  }
  pendingGrades: number
  recentEnrolments: StudentWithRelations[]
  recentPayments: StaffDashboardPayment[]
}

export type DashboardSubmission = {
  id: string
  submittedAt: string
  isLate: boolean
}

export type StudentDashboardData = {
  student: StudentWithRelations
  fee: FeeWithPayments | null
  recentResults: ResultWithRelations[]
  openAssessments: Array<{
    assessment: AssessmentWithRelations
    submission: DashboardSubmission | null
  }>
  submissionStats: {
    total: number
    onTime: number
    late: number
    notSubmitted: number
  }
  resultStats: {
    published: number
    averageGrade: number | null
  }
}

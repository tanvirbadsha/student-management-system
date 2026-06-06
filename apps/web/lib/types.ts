import type {
  Classification as PrismaClassification,
  EnrolmentStatus as PrismaEnrolmentStatus,
  FileType as PrismaFileType,
  Prisma,
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
  createdAt: string
  updatedAt: string
}

export type FeeWithPayments = FeeRecord & {
  percentagePaid: number
  payments: PaymentRecord[]
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
  }
}

export type AssessmentWithRelations = Prisma.AssessmentGetPayload<{
  include: {
    module: {
      select: {
        id: true
        title: true
        code: true
      }
    }
    createdBy: {
      select: {
        id: true
        fullName: true
      }
    }
  }
}>

export type SubmissionWithRelations = Prisma.SubmissionGetPayload<{
  include: {
    student: {
      select: {
        id: true
        studentId: true
        user: {
          select: {
            fullName: true
          }
        }
      }
    }
    assessment: {
      select: {
        id: true
        title: true
        deadline: true
      }
    }
  }
}>

export type ResultWithRelations = Prisma.ResultGetPayload<{
  include: {
    student: {
      select: {
        id: true
        studentId: true
        user: {
          select: {
            fullName: true
          }
        }
      }
    }
    assessment: {
      select: {
        id: true
        title: true
        module: {
          select: {
            title: true
          }
        }
      }
    }
    submission: {
      select: {
        id: true
        isLate: true
      }
    }
  }
}>

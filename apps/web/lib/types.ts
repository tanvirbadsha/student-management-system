import type { Prisma } from "@prisma/client"

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

export type StudentWithRelations = Prisma.StudentGetPayload<{
  include: {
    user: {
      select: {
        id: true
        fullName: true
        email: true
      }
    }
    programme: {
      select: {
        id: true
        name: true
        code: true
      }
    }
    fee: {
      select: {
        id: true
        outstanding: true
        isOverdue: true
        dueDate: true
      }
    }
  }
}>

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

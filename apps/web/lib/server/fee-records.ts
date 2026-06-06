import type { Fee, Payment, Prisma } from "@prisma/client"

import type {
  FeeRecord,
  FeeWithPayments,
  OverdueFeeRecord,
  PaymentRecord,
} from "@/lib/types"

export const feeWithPaymentsInclude = {
  payments: {
    orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.FeeInclude

export const overdueFeeSelect = {
  id: true,
  studentId: true,
  user: {
    select: {
      fullName: true,
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
      outstanding: true,
      dueDate: true,
      amountPaid: true,
      totalAmount: true,
    },
  },
} satisfies Prisma.StudentSelect

type FeeWithPaymentsRecord = Prisma.FeeGetPayload<{
  include: typeof feeWithPaymentsInclude
}>

type OverdueStudentRecord = Prisma.StudentGetPayload<{
  select: typeof overdueFeeSelect
}>

export function serializePayment(payment: Payment): PaymentRecord {
  return {
    ...payment,
    amount: payment.amount.toNumber(),
    paymentDate: payment.paymentDate.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  }
}

export function serializeFee(fee: Fee): FeeRecord {
  return {
    ...fee,
    totalAmount: fee.totalAmount.toNumber(),
    amountPaid: fee.amountPaid.toNumber(),
    outstanding: fee.outstanding.toNumber(),
    dueDate: fee.dueDate.toISOString(),
    createdAt: fee.createdAt.toISOString(),
    updatedAt: fee.updatedAt.toISOString(),
  }
}

export function serializeFeeWithPayments(
  fee: FeeWithPaymentsRecord
): FeeWithPayments {
  const totalAmount = fee.totalAmount.toNumber()
  const amountPaid = fee.amountPaid.toNumber()

  return {
    ...serializeFee(fee),
    percentagePaid:
      totalAmount === 0
        ? 0
        : Math.round((amountPaid / totalAmount) * 1000) / 10,
    payments: fee.payments.map(serializePayment),
  }
}

export function serializeOverdueFee(
  student: OverdueStudentRecord
): OverdueFeeRecord {
  if (student.fee === null) {
    throw new Error("Overdue student is missing a fee record")
  }

  return {
    id: student.id,
    studentId: student.studentId,
    fullName: student.user.fullName,
    programme: student.programme,
    fee: {
      outstanding: student.fee.outstanding.toNumber(),
      dueDate: student.fee.dueDate.toISOString(),
      amountPaid: student.fee.amountPaid.toNumber(),
      totalAmount: student.fee.totalAmount.toNumber(),
    },
  }
}

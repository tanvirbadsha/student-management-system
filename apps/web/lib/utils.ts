import { Classification, Prisma } from "@prisma/client"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | Prisma.Decimal): string {
  const value = typeof amount === "number" ? amount : amount.toNumber()

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date))
}

export function deriveClassification(grade: number): Classification {
  if (grade < 40) {
    return Classification.FAIL
  }

  if (grade < 60) {
    return Classification.PASS
  }

  if (grade < 70) {
    return Classification.MERIT
  }

  return Classification.DISTINCTION
}

export function generateStudentId(year: number, count: number): string {
  return `SMS-${year}-${count.toString().padStart(4, "0")}`
}

export function isOverdue(
  dueDate: Date,
  outstanding: number | Prisma.Decimal
): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const outstandingAmount =
    typeof outstanding === "number" ? outstanding : outstanding.toNumber()

  return dueDate.getTime() < today.getTime() && outstandingAmount > 0
}

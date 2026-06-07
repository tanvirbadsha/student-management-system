"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  OverdueFeeRecord,
  PaginatedApiResponse,
  StudentWithRelations,
} from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function FeesPage() {
  const router = useRouter()
  const { role, isStaff, isStudent } = useRole()
  const [overdueFees, setOverdueFees] = useState<OverdueFeeRecord[]>([])
  const [students, setStudents] = useState<StudentWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (isStudent) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStudent, role, router])

  useEffect(() => {
    if (!isStaff) {
      return
    }

    const controller = new AbortController()

    async function loadFees() {
      setIsLoading(true)

      try {
        const [overduePayload, allStudents] = await Promise.all([
          fetchApi<OverdueFeeRecord[]>("/api/fees/overdue", {
            signal: controller.signal,
          }),
          loadAllStudents(controller.signal),
        ])

        if (overduePayload.error !== null) {
          throw new Error(overduePayload.error ?? "Could not load overdue fees")
        }

        setOverdueFees(overduePayload.data)
        setStudents(allStudents)
        setError(null)
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return
        }

        setError("Could not load fee information. Please try again.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadFees()
    return () => controller.abort()
  }, [isStaff, refreshToken])

  const summary = useMemo(() => {
    const totalOutstanding = overdueFees.reduce(
      (total, record) => total + record.fee.outstanding,
      0
    )
    const fullyPaid = students.filter(
      (student) => student.fee?.outstanding === 0
    ).length
    const partialPayment = students.filter(
      (student) =>
        student.fee !== null &&
        student.fee.amountPaid > 0 &&
        student.fee.amountPaid < student.fee.totalAmount
    ).length

    return {
      totalOutstanding,
      fullyPaid,
      partialPayment,
    }
  }, [overdueFees, students])

  if (!isStaff || isLoading) {
    return <FeesPageSkeleton />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Fees &amp; Payments
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor overdue balances and student payment status
        </p>
      </div>

      {error !== null ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setRefreshToken((token) => token + 1)}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Overdue students"
              value={String(overdueFees.length)}
            />
            <SummaryCard
              title="Overdue outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              valueClassName="text-red-700 dark:text-red-300"
            />
            <SummaryCard
              title="Students fully paid"
              value={String(summary.fullyPaid)}
              valueClassName="text-emerald-700 dark:text-emerald-300"
            />
            <SummaryCard
              title="Partial payments"
              value={String(summary.partialPayment)}
              valueClassName="text-amber-700 dark:text-amber-300"
            />
          </div>

          {overdueFees.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    strokeWidth={2}
                    className="size-6"
                  />
                </span>
                <h2 className="mt-4 font-heading text-lg font-medium">
                  No overdue fees — all students are up to date
                </h2>
              </CardContent>
            </Card>
          ) : (
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead>Total Fee</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueFees.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono font-medium">
                        {record.studentId}
                      </TableCell>
                      <TableCell>{record.fullName}</TableCell>
                      <TableCell>{record.programme.code}</TableCell>
                      <TableCell>
                        {formatCurrency(record.fee.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(record.fee.amountPaid)}
                      </TableCell>
                      <TableCell className="font-medium text-red-700 dark:text-red-300">
                        {formatCurrency(record.fee.outstanding)}
                      </TableCell>
                      <TableCell>{formatDate(record.fee.dueDate)}</TableCell>
                      <TableCell className="text-red-700 dark:text-red-300">
                        {daysOverdue(record.fee.dueDate)} days overdue
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/students/${record.id}`}>
                            View Student
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  valueClassName,
}: {
  title: string
  value: string
  valueClassName?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${valueClassName ?? ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function daysOverdue(dueDate: string): number {
  const now = new Date()
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  const due = new Date(dueDate)
  const normalizedDue = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate()
  )

  return Math.max(0, Math.floor((today - normalizedDue) / 86_400_000))
}

async function loadAllStudents(
  signal: AbortSignal
): Promise<StudentWithRelations[]> {
  const firstPayload = await fetchApi<
    StudentWithRelations[],
    PaginatedApiResponse<StudentWithRelations[]>
  >("/api/students?limit=100&page=1", { signal })

  if (firstPayload.error !== null) {
    throw new Error(firstPayload.error ?? "Could not load fee summary")
  }

  if (firstPayload.pagination.totalPages <= 1) {
    return firstPayload.data
  }

  const remainingPages = await Promise.all(
    Array.from(
      { length: firstPayload.pagination.totalPages - 1 },
      async (_, index) => {
        const payload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?limit=100&page=${index + 2}`, { signal })

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load fee summary")
        }

        return payload.data
      }
    )
  )

  return [firstPayload.data, ...remainingPages].flat()
}

function FeesPageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

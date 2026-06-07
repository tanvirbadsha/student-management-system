"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
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
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
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
      <PageHeader
        title="Fees & Payments"
        subtitle="Monitor overdue balances and student payment status"
      />

      {error !== null ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-danger">{error}</p>
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
            <StatCard
              label="Overdue students"
              value={String(overdueFees.length)}
              variant={overdueFees.length > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Overdue outstanding"
              value={formatCurrency(summary.totalOutstanding)}
              variant={summary.totalOutstanding > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Students fully paid"
              value={String(summary.fullyPaid)}
              variant="success"
            />
            <StatCard
              label="Partial payments"
              value={String(summary.partialPayment)}
              variant={summary.partialPayment > 0 ? "warning" : "default"}
            />
          </div>

          {overdueFees.length === 0 ? (
            <EmptyState
              icon={
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  strokeWidth={2}
                  className="size-5"
                />
              }
              title="No overdue fees"
              description="All students are up to date."
            />
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
                      <TableCell>
                        <span className="font-mono text-sm">
                          {record.programme.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(record.fee.totalAmount)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(record.fee.amountPaid)}
                      </TableCell>
                      <TableCell className="font-medium text-danger">
                        {formatCurrency(record.fee.outstanding)}
                      </TableCell>
                      <TableCell>{formatDate(record.fee.dueDate)}</TableCell>
                      <TableCell className="text-danger">
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

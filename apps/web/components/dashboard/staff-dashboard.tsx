"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import type { StaffDashboardData } from "@/lib/types"
import { fetchApi } from "@/lib/api-client"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"

export function StaffDashboard() {
  const [data, setData] = useState<StaffDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        const payload = await fetchApi<StaffDashboardData>(
          "/api/dashboard/staff",
          {
            signal: controller.signal,
          }
        )

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load dashboard")
        }

        setData(payload.data)
        setError(null)
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load dashboard"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadDashboard()
    return () => controller.abort()
  }, [refreshToken])

  if (isLoading) return <StaffDashboardSkeleton />

  if (error !== null || data === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-sm text-danger">
            {error ?? "Could not load dashboard"}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setIsLoading(true)
              setRefreshToken((token) => token + 1)
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Dashboard"
        subtitle="Registry operations overview"
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Total Students"
          value={String(data.studentCounts.total)}
          subtext={`${data.studentCounts.enrolled} enrolled / ${data.studentCounts.deferred} deferred / ${data.studentCounts.completed} completed / ${data.studentCounts.withdrawn} withdrawn`}
        />
        <StatCard
          label="Overdue Fees"
          value={String(data.overdueFees.count)}
          subtext={`${formatCurrency(data.overdueFees.totalOutstanding)} outstanding`}
          variant={data.overdueFees.count > 0 ? "danger" : "default"}
        />
        <StatCard
          label="Open Assessments"
          value={String(data.openAssessments.count)}
          subtext={`${data.openAssessments.totalSubmissions} submissions received`}
        />
        <StatCard
          label="Pending Grades"
          value={String(data.pendingGrades)}
          subtext="Submissions awaiting a result"
          variant={data.pendingGrades > 0 ? "warning" : "default"}
        />
      </div>

      {data.overdueFees.count > 0 && (
        <Alert className="border-warning bg-warning-bg text-text-primary">
          <AlertTitle>Overdue fee balances</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-1">
            <span>
              {data.overdueFees.count} students have overdue fee balances
              totalling {formatCurrency(data.overdueFees.totalOutstanding)}.
            </span>
            <Link
              href="/dashboard/fees"
              className="font-medium underline underline-offset-4"
            >
              View Fees -&gt;
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Enrolments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentEnrolments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students enrolled yet.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentEnrolments.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {student.user.fullName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {student.studentId}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="secondary">
                        <span className="font-mono text-sm">
                          {student.programme.code}
                        </span>
                      </Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(student.enrolledAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/students">
                View all students
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentPayments.map(({ payment, student }) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {student.user.fullName}
                      </p>
                      <p className="truncate font-mono text-sm text-text-secondary">
                        {payment.referenceNumber}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.paymentDate)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/fees">
                View all fees
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {data.openAssessments.count > 0 && (
        <Card className="py-0">
          <CardHeader className="py-5">
            <CardTitle>Open Assessments</CardTitle>
          </CardHeader>
          <Table>
            <TableCaption className="sr-only">
              Open assessments summary
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment Title</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.openAssessments.assessments.map((assessment) => {
                const days = daysUntil(assessment.deadline)

                return (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">
                      {assessment.title}
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-sm">
                        {assessment.module.code}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {assessment.module.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{formatDateTime(assessment.deadline)}</p>
                      {days <= 7 && (
                        <p className="mt-1 text-xs font-medium text-warning">
                          Closing in {days} day{days === 1 ? "" : "s"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{assessment._count.submissions}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/assessments/${assessment.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function daysUntil(deadline: string): number {
  return Math.max(
    1,
    Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  )
}

function StaffDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading staff dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

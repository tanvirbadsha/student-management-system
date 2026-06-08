"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ClassificationBadge } from "@/components/results/classification-badge"
import { PageHeader } from "@/components/ui/page-header"
import { StatCard } from "@/components/ui/stat-card"
import { fetchApi } from "@/lib/api-client"
import type {
  PaginatedApiResponse,
  StudentDashboardData,
  StudentWithRelations,
} from "@/lib/types"
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils"

export function StudentDashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      try {
        const studentPayload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?userId=${encodeURIComponent(userId)}&limit=1`, {
          signal: controller.signal,
        })

        if (studentPayload.error !== null) {
          throw new Error(studentPayload.error ?? "Could not load student")
        }

        const student = studentPayload.data[0]
        if (student === undefined) {
          throw new Error("Student profile not found")
        }

        const dashboardPayload = await fetchApi<StudentDashboardData>(
          `/api/dashboard/student/${encodeURIComponent(student.id)}`,
          { signal: controller.signal }
        )

        if (dashboardPayload.error !== null) {
          throw new Error(dashboardPayload.error ?? "Could not load dashboard")
        }

        setData(dashboardPayload.data)
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
  }, [refreshToken, userId])

  if (isLoading) return <StudentDashboardSkeleton />

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
        title={`Welcome back, ${data.student.user.fullName}`}
        subtitle={todayLabel()}
      />

      <FeeStatusCard data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open Assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.openAssessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open assessments at this time.
              </p>
            ) : (
              <div className="divide-y">
                {data.openAssessments.map(({ assessment, submission }) => (
                  <div
                    key={assessment.id}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{assessment.title}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          <span className="font-mono text-sm">
                            {assessment.module.code}
                          </span>{" "}
                          / {assessment.module.title}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Due {formatDateTime(assessment.deadline)}
                        </p>
                      </div>
                      <SubmissionStatus
                        isLate={submission?.isLate}
                        submitted={submission !== null}
                      />
                    </div>
                    {submission === null && (
                      <Button className="mt-3" size="sm" asChild>
                        <Link href="/dashboard/assessments">Submit now</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Results will appear here once published by your tutor.
              </p>
            ) : (
              <div className="divide-y">
                {data.recentResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {result.assessment.title}
                      </p>
                      <p className="mt-1 font-mono text-sm text-text-secondary">
                        {result.assessment.module.code}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-2xl font-semibold">
                        {result.grade}%
                      </span>
                      <ClassificationBadge
                        classification={result.classification}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="link" className="px-0" asChild>
              <Link href="/dashboard/results">
                View all results
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Submissions"
          value={String(data.submissionStats.total)}
          subtext={`On time: ${data.submissionStats.onTime} / Late: ${data.submissionStats.late}`}
        />
        <StatCard
          label="Published Results"
          value={String(data.resultStats.published)}
          subtext="Visible on your marksheet"
        />
        <StatCard
          label="Average Grade"
          value={
            data.resultStats.averageGrade === null
              ? "-"
              : `${data.resultStats.averageGrade}%`
          }
          subtext="Across published results"
        />
      </div>
    </div>
  )
}

function FeeStatusCard({ data }: { data: StudentDashboardData }) {
  const fee = data.fee

  if (fee === null) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Fee record not found.
        </CardContent>
      </Card>
    )
  }

  const isFullyPaid = Math.round(fee.outstanding * 100) === 0
  const isOverdue = fee.isOverdue && !isFullyPaid
  const tone = isOverdue ? "red" : isFullyPaid ? "green" : "amber"
  const Icon = isOverdue
    ? AlertCircleIcon
    : isFullyPaid
      ? CheckmarkCircle02Icon
      : Clock01Icon

  return (
    <Card
      id="fee-status"
      className={cn(
        "border-2",
        tone === "red" && "border-danger bg-danger-bg",
        tone === "green" && "border-success bg-success-bg",
        tone === "amber" && "border-warning bg-warning-bg"
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface/70">
          <HugeiconsIcon
            icon={Icon}
            strokeWidth={2}
            className={cn(
              "size-5",
              tone === "red" && "text-danger",
              tone === "green" && "text-success",
              tone === "amber" && "text-warning"
            )}
          />
        </span>
        <div>
          <CardTitle>Fee Status</CardTitle>
          <p className="mt-1 text-xs">
            {isOverdue
              ? "Payment is overdue"
              : isFullyPaid
                ? "Fully paid"
                : `Due ${formatDate(fee.dueDate)}`}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-4">
          <FeeValue label="Total Fee" value={formatCurrency(fee.totalAmount)} />
          <FeeValue
            label="Amount Paid"
            value={formatCurrency(fee.amountPaid)}
          />
          <FeeValue
            label="Outstanding"
            value={formatCurrency(fee.outstanding)}
          />
          <FeeValue label="Due Date" value={formatDate(fee.dueDate)} />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs">
            <span>Payment progress</span>
            <span>{fee.percentagePaid}%</span>
          </div>
          <Progress value={fee.percentagePaid} className="h-2 bg-surface/70" />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="bg-surface/70" asChild>
          <Link href="/dashboard/my-fees">
            View fee details
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              data-icon="inline-end"
            />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function FeeValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
    </div>
  )
}

function SubmissionStatus({
  submitted,
  isLate,
}: {
  submitted: boolean
  isLate?: boolean
}) {
  if (!submitted) {
    return <Badge variant="outline">Not submitted</Badge>
  }

  return (
    <Badge
      className={cn(
        isLate ? "bg-danger-bg text-danger" : "bg-success-bg text-success"
      )}
    >
      {isLate ? "Submitted late" : "Submitted on time"}
    </Badge>
  )
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

function StudentDashboardSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading student dashboard">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    </div>
  )
}

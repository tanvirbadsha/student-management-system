"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  File01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Money01Icon,
  Chart01Icon,
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

      <section className="space-y-3" aria-labelledby="student-quick-actions">
        <div>
          <h2
            id="student-quick-actions"
            className="font-heading text-base font-semibold text-text-primary"
          >
            Quick Actions
          </h2>
          <p className="text-sm text-text-secondary">
            Continue with your most common student tasks.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickActionCard
            href="/dashboard/assessments"
            icon={File01Icon}
            title="Open Assessments"
            description="Browse and submit current work."
            tone="red"
          />
          <QuickActionCard
            href="/dashboard/results"
            icon={Chart01Icon}
            title="My Results"
            description="View published grades and marksheet."
            tone="blue"
          />
          <QuickActionCard
            href="/dashboard/my-fees"
            icon={Money01Icon}
            title="My Fees"
            description="Check balance and payment history."
            tone="green"
          />
        </div>
      </section>

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

function QuickActionCard({
  href,
  icon,
  title,
  description,
  tone,
}: {
  href: string
  icon: typeof ArrowRight01Icon
  title: string
  description: string
  tone: "blue" | "green" | "red"
}) {
  return (
    <Link
      href={href}
      className="group rounded-md border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md text-white shadow-sm",
            tone === "blue" && "bg-[#075985]",
            tone === "green" && "bg-[#14532d]",
            tone === "red" && "bg-[#7f1d1d]"
          )}
        >
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          className="mt-1 size-4 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-text-primary"
        />
      </div>
      <h3 className="mt-4 font-heading text-sm font-semibold text-text-primary">
        {title}
      </h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </Link>
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
        "border-0 text-white shadow-md shadow-black/10 [&_[data-slot=card-title]]:text-white",
        tone === "red" && "bg-[#6f1d1b]",
        tone === "green" && "bg-[#14532d]",
        tone === "amber" && "bg-[#7f1d1d]"
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md ring-1 ring-white/15",
            tone === "green" ? "bg-emerald-300/15" : "bg-red-300/15"
          )}
        >
          <HugeiconsIcon
            icon={Icon}
            strokeWidth={2}
            className="size-5 text-white"
          />
        </span>
        <div>
          <CardTitle>Fee Status</CardTitle>
          <p className="mt-1 text-xs font-medium text-white/80">
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
            <span className="font-medium text-white/80">Payment progress</span>
            <span className="font-mono font-semibold text-white">
              {fee.percentagePaid}%
            </span>
          </div>
          <Progress
            value={fee.percentagePaid}
            className={cn(
              "h-2 bg-black/25 [&_[data-slot=progress-indicator]]:bg-white",
              tone === "green" &&
                "[&_[data-slot=progress-indicator]]:bg-emerald-100",
              tone !== "green" &&
                "[&_[data-slot=progress-indicator]]:bg-red-100"
            )}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
          asChild
        >
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
    <div className="rounded-md bg-black/15 px-3 py-2 ring-1 ring-white/10">
      <p className="text-xs text-white/70">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-white">
        {value}
      </p>
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
        isLate ? "bg-[#7f1d1d] text-white" : "bg-[#14532d] text-white"
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

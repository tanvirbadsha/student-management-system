"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ClassificationBadge } from "@/components/results/classification-badge"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  PaginatedApiResponse,
  ResultWithRelations,
  StudentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

export default function StudentResultsPage() {
  const router = useRouter()
  const { role, userId, isStaff, isStudent } = useRole()
  const [results, setResults] = useState<ResultWithRelations[]>([])
  const [awaitingGrade, setAwaitingGrade] = useState<SubmissionWithRelations[]>(
    []
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (isStaff) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStaff, role, router])

  useEffect(() => {
    if (!isStudent || userId === null) return
    const controller = new AbortController()

    async function loadResults() {
      try {
        const studentPayload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?userId=${encodeURIComponent(userId ?? "")}&limit=1`, {
          signal: controller.signal,
        })

        if (studentPayload.error !== null) {
          throw new Error(studentPayload.error ?? "Could not load student")
        }

        const student = studentPayload.data[0]
        if (student === undefined) {
          throw new Error("Student profile not found")
        }

        const [resultsPayload, submissionsPayload] = await Promise.all([
          fetchApi<ResultWithRelations[]>(
            `/api/results/student/${encodeURIComponent(student.id)}`,
            {
              signal: controller.signal,
            }
          ),
          fetchApi<SubmissionWithRelations[]>(
            `/api/submissions?studentId=${encodeURIComponent(student.id)}`,
            {
              signal: controller.signal,
            }
          ),
        ])

        if (resultsPayload.error !== null) {
          throw new Error(resultsPayload.error ?? "Could not load results")
        }

        if (submissionsPayload.error !== null) {
          throw new Error(
            submissionsPayload.error ?? "Could not load submissions"
          )
        }

        const published = resultsPayload.data.filter(
          (result) => result.isPublished === true
        )
        const gradedSubmissionIds = new Set(
          resultsPayload.data.map((result) => result.submissionId)
        )

        setResults(published)
        setAwaitingGrade(
          submissionsPayload.data.filter(
            (submission) => !gradedSubmissionIds.has(submission.id)
          )
        )
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError(
          error instanceof Error ? error.message : "Could not load results"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadResults()
    return () => controller.abort()
  }, [isStudent, userId])

  const summary = useMemo(() => {
    if (results.length === 0) return null
    const grades = results.map((result) => result.grade)

    return {
      count: grades.length,
      average:
        Math.round(
          (grades.reduce((total, grade) => total + grade, 0) / grades.length) *
            10
        ) / 10,
      highest: Math.max(...grades),
      lowest: Math.min(...grades),
    }
  }, [results])

  if (!isStudent || isLoading) return <ResultsSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          My Results
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Published assessment results
        </p>
      </div>

      {loadError !== null ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      ) : results.length === 0 && awaitingGrade.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Your results have not been published yet. Check back later.
          </CardContent>
        </Card>
      ) : (
        <>
          {summary !== null && (
            <Card>
              <CardHeader>
                <CardTitle>Overall Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                <SummaryValue label="Results" value={String(summary.count)} />
                <SummaryValue label="Average" value={`${summary.average}%`} />
                <SummaryValue label="Highest" value={`${summary.highest}%`} />
                <SummaryValue label="Lowest" value={`${summary.lowest}%`} />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <Card key={result.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {result.assessment.title}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {result.assessment.module.code} ·{" "}
                        {result.assessment.module.title}
                      </p>
                    </div>
                    <ClassificationBadge
                      classification={result.classification}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-4xl font-semibold">{result.grade}%</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {result.submission.isLate && (
                      <Badge className="bg-red-500/10 text-red-700 dark:text-red-300">
                        Submitted Late
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Submitted {formatDateTime(result.submission.submittedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {awaitingGrade.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {submission.assessment.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {submission.assessment.module.code} /{" "}
                    {submission.assessment.module.title}
                  </p>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">Awaiting grade</Badge>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Submitted {formatDateTime(submission.submittedAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-52 w-full" />
        ))}
      </div>
    </div>
  )
}

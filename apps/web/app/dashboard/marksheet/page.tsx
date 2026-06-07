"use client"

import { useEffect, useMemo, useState } from "react"
import { Classification } from "@prisma/client"
import { useRouter } from "next/navigation"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Switch } from "@workspace/ui/components/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "sonner"

import { ClassificationBadge } from "@/components/results/classification-badge"
import {
  GradingPanel,
  type GradingSubmission,
} from "@/components/results/grading-panel"
import { useRole } from "@/lib/context/role-context"
import type {
  ApiResponse,
  AssessmentWithRelations,
  MarksheetData,
  MarksheetSummary,
  ResultMutationResponse,
  ResultWithRelations,
  SubmissionResult,
} from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

type ProgrammeOption = {
  id: string
  name: string
  code: string
}

export default function MarksheetPage() {
  const router = useRouter()
  const { role, userId, isStaff, isStudent } = useRole()
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([])
  const [assessments, setAssessments] = useState<AssessmentWithRelations[]>([])
  const [programmeId, setProgrammeId] = useState("all")
  const [assessmentId, setAssessmentId] = useState("")
  const [marksheet, setMarksheet] = useState<MarksheetData | null>(null)
  const [isLoadingFilters, setIsLoadingFilters] = useState(true)
  const [isLoadingMarksheet, setIsLoadingMarksheet] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedResult, setSelectedResult] =
    useState<ResultWithRelations | null>(null)
  const [busyResultIds, setBusyResultIds] = useState<Set<string>>(new Set())
  const [publishProgress, setPublishProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  useEffect(() => {
    if (isStudent) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStudent, role, router])

  useEffect(() => {
    if (!isStaff) return
    const controller = new AbortController()

    async function loadFilters() {
      try {
        const [programmesResponse, assessmentsResponse] = await Promise.all([
          fetch("/api/programmes", { signal: controller.signal }),
          fetch("/api/assessments", { signal: controller.signal }),
        ])
        const programmesPayload =
          (await programmesResponse.json()) as ApiResponse<ProgrammeOption[]>
        const assessmentsPayload =
          (await assessmentsResponse.json()) as ApiResponse<
            AssessmentWithRelations[]
          >

        if (!programmesResponse.ok || programmesPayload.error !== null) {
          throw new Error(
            programmesPayload.error ?? "Could not load programmes"
          )
        }

        if (!assessmentsResponse.ok || assessmentsPayload.error !== null) {
          throw new Error(
            assessmentsPayload.error ?? "Could not load assessments"
          )
        }

        setProgrammes(programmesPayload.data)
        setAssessments(assessmentsPayload.data)
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError(
          error instanceof Error ? error.message : "Could not load filters"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoadingFilters(false)
      }
    }

    void loadFilters()
    return () => controller.abort()
  }, [isStaff])

  useEffect(() => {
    if (!isStaff || assessmentId === "") return

    const controller = new AbortController()

    async function loadMarksheet() {
      setIsLoadingMarksheet(true)
      setLoadError(null)

      try {
        const response = await fetch(
          `/api/results/marksheet?assessmentId=${encodeURIComponent(assessmentId)}`,
          {
            headers: requestHeaders(userId, role),
            signal: controller.signal,
          }
        )
        const payload = (await response.json()) as ApiResponse<MarksheetData>

        if (!response.ok || payload.error !== null) {
          throw new Error(payload.error ?? "Could not load marksheet")
        }

        setMarksheet(payload.data)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError(
          error instanceof Error ? error.message : "Could not load marksheet"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoadingMarksheet(false)
      }
    }

    void loadMarksheet()
    return () => controller.abort()
  }, [assessmentId, isStaff, role, userId])

  const filteredAssessments = useMemo(
    () =>
      programmeId === "all"
        ? assessments
        : assessments.filter(
            (assessment) => assessment.module.programmeId === programmeId
          ),
    [assessments, programmeId]
  )

  const unpublishedResults =
    marksheet?.results.filter((result) => !result.isPublished) ?? []

  async function togglePublished(result: ResultWithRelations) {
    const nextPublished = !result.isPublished
    setBusy(result.id, true)
    setMarksheet((current) =>
      current === null
        ? current
        : replaceResult(current, { ...result, isPublished: nextPublished })
    )

    try {
      const updated = await patchResult(result.id, {
        isPublished: nextPublished,
      })
      setMarksheet((current) =>
        current === null ? current : replaceResult(current, updated)
      )
    } catch (error) {
      setMarksheet((current) =>
        current === null ? current : replaceResult(current, result)
      )
      toast.error(
        error instanceof Error ? error.message : "Could not update result"
      )
    } finally {
      setBusy(result.id, false)
    }
  }

  async function publishAll() {
    if (unpublishedResults.length === 0) return

    const confirmed = window.confirm(
      `This will publish ${unpublishedResults.length} results and make them visible to students. Continue?`
    )

    if (!confirmed) return

    setPublishProgress({ done: 0, total: unpublishedResults.length })

    const settled = await Promise.allSettled(
      unpublishedResults.map(async (result) => {
        try {
          return await patchResult(result.id, { isPublished: true })
        } finally {
          setPublishProgress((current) =>
            current === null ? current : { ...current, done: current.done + 1 }
          )
        }
      })
    )
    const published = settled.flatMap((entry) =>
      entry.status === "fulfilled" ? [entry.value] : []
    )
    const failed = settled.length - published.length

    setMarksheet((current) => {
      if (current === null) return current
      return published.reduce(replaceResult, current)
    })
    setPublishProgress(null)
    toast.success(`${published.length} results published. ${failed} failed.`)
  }

  function setBusy(resultId: string, busy: boolean) {
    setBusyResultIds((current) => {
      const next = new Set(current)
      if (busy) next.add(resultId)
      else next.delete(resultId)
      return next
    })
  }

  if (!isStaff || isLoadingFilters) return <MarksheetSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Marksheet
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review grades and control student visibility
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          value={programmeId}
          onValueChange={(value) => {
            setProgrammeId(value)
            setAssessmentId("")
            setMarksheet(null)
          }}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Programme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programmes</SelectItem>
            {programmes.map((programme) => (
              <SelectItem key={programme.id} value={programme.id}>
                {programme.code} — {programme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assessmentId} onValueChange={setAssessmentId}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Select an assessment" />
          </SelectTrigger>
          <SelectContent>
            {filteredAssessments.map((assessment) => (
              <SelectItem key={assessment.id} value={assessment.id}>
                {assessment.module.code} — {assessment.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loadError !== null && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      {assessmentId === "" ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Select an assessment to view its marksheet
          </CardContent>
        </Card>
      ) : isLoadingMarksheet ? (
        <Skeleton className="h-96 w-full" />
      ) : marksheet !== null ? (
        <>
          <SummaryCards summary={marksheet.summary ?? emptySummary()} />

          <Card className="py-0">
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-5">
              <div>
                <CardTitle>{marksheet.assessment.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {marksheet.assessment.module.code} ·{" "}
                  {marksheet.assessment.module.title}
                </p>
              </div>
              <Button
                disabled={
                  unpublishedResults.length === 0 || publishProgress !== null
                }
                onClick={publishAll}
              >
                {publishProgress === null
                  ? "Publish All"
                  : `Publishing ${publishProgress.done}/${publishProgress.total}`}
              </Button>
            </CardHeader>

            {marksheet.results.length === 0 ? (
              <CardContent className="border-t py-16 text-center text-sm text-muted-foreground">
                No grades have been entered for this assessment yet.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marksheet.results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-mono font-medium">
                        {result.student.studentId}
                      </TableCell>
                      <TableCell>{result.student.user.fullName}</TableCell>
                      <TableCell>
                        {formatDateTime(result.submission.submittedAt)}
                      </TableCell>
                      <TableCell>
                        {result.submission.isLate && (
                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-300">
                            Late
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{result.grade}%</TableCell>
                      <TableCell>
                        <ClassificationBadge
                          classification={result.classification}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={result.isPublished}
                          disabled={
                            busyResultIds.has(result.id) ||
                            publishProgress !== null
                          }
                          aria-label={`Publish result for ${result.student.user.fullName}`}
                          onCheckedChange={() => togglePublished(result)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedResult(result)}
                        >
                          Edit Grade
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      ) : null}

      {selectedResult !== null && (
        <GradingPanel
          submission={resultToSubmission(selectedResult)}
          onOpenChange={(open) => {
            if (!open) setSelectedResult(null)
          }}
          onResultSaved={(result) => {
            setMarksheet((current) =>
              current === null ? current : replaceResult(current, result)
            )
            setSelectedResult(result)
          }}
        />
      )}
    </div>
  )

  async function patchResult(
    resultId: string,
    body: { isPublished: boolean }
  ): Promise<ResultWithRelations> {
    const response = await fetch(`/api/results/${resultId}`, {
      method: "PATCH",
      headers: requestHeaders(userId, role),
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as ResultMutationResponse

    if (!response.ok || payload.error !== null) {
      throw new Error(payload.error ?? "Could not update result")
    }

    return payload.data
  }
}

function SummaryCards({ summary }: { summary: MarksheetSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Total Graded" value={String(summary.totalGraded)} />
      <StatCard label="Average Grade" value={`${summary.averageGrade}%`} />
      <StatCard
        label="Published Count"
        value={String(summary.totalPublished)}
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Classification</CardTitle>
        </CardHeader>
        <CardContent>
          <DistributionPills summary={summary} />
        </CardContent>
      </Card>
    </div>
  )
}

function DistributionPills({ summary }: { summary: MarksheetSummary }) {
  return (
    <div className="flex w-full flex-wrap gap-1.5">
      <Badge className="bg-red-500/10 text-red-700 dark:text-red-300">
        Fail {summary.distribution.FAIL}
      </Badge>
      <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300">
        Pass {summary.distribution.PASS}
      </Badge>
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300">
        Merit {summary.distribution.MERIT}
      </Badge>
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        Distinction {summary.distribution.DISTINCTION}
      </Badge>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  )
}

function replaceResult(
  marksheet: MarksheetData,
  updated: ResultWithRelations
): MarksheetData {
  const results = marksheet.results.map((result) =>
    result.id === updated.id ? updated : result
  )

  return {
    ...marksheet,
    results,
    summary: summarize(results),
  }
}

function summarize(results: ResultWithRelations[]): MarksheetSummary {
  const totalGraded = results.length

  return {
    totalGraded,
    totalPublished: results.filter((result) => result.isPublished).length,
    averageGrade:
      totalGraded === 0
        ? 0
        : Math.round(
            (results.reduce((total, result) => total + result.grade, 0) /
              totalGraded) *
              10
          ) / 10,
    distribution: {
      FAIL: results.filter(
        (result) => result.classification === Classification.FAIL
      ).length,
      PASS: results.filter(
        (result) => result.classification === Classification.PASS
      ).length,
      MERIT: results.filter(
        (result) => result.classification === Classification.MERIT
      ).length,
      DISTINCTION: results.filter(
        (result) => result.classification === Classification.DISTINCTION
      ).length,
    },
  }
}

function emptySummary(): MarksheetSummary {
  return summarize([])
}

function resultToSubmission(result: ResultWithRelations): GradingSubmission {
  const submissionResult: SubmissionResult = {
    id: result.id,
    grade: result.grade,
    classification: result.classification,
    isPublished: result.isPublished,
    gradedAt: result.gradedAt,
    updatedAt: result.updatedAt,
  }

  return {
    id: result.submission.id,
    fileUrl: result.submission.fileUrl,
    submittedAt: result.submission.submittedAt,
    isLate: result.submission.isLate,
    student: result.student,
    assessment: result.assessment,
    result: submissionResult,
  }
}

function requestHeaders(userId: string | null, role: string | null) {
  return {
    "Content-Type": "application/json",
    "x-user-id": userId ?? "",
    "x-user-role": role ?? "",
  }
}

function MarksheetSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

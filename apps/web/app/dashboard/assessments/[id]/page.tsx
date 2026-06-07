"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Download01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons"
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
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
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
import { GradingPanel } from "@/components/results/grading-panel"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  AssessmentDetail,
  AssessmentMutationResponse,
  AssessmentWithRelations,
  PaginatedApiResponse,
  ResultWithRelations,
  StudentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"
import { cn, formatDateTime } from "@/lib/utils"

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { role, userId, isStaff, isStudent } = useRole()
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null)
  const [notSubmitted, setNotSubmitted] = useState<StudentWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState("")
  const [deadline, setDeadline] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionWithRelations | null>(null)

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

    async function loadAssessment() {
      try {
        const payload = await fetchApi<AssessmentDetail>(
          `/api/assessments/${id}`,
          {
            signal: controller.signal,
          }
        )

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load assessment")
        }

        const students = await loadProgrammeStudents(
          payload.data.module.programmeId,
          controller.signal
        )
        const submittedIds = new Set(
          payload.data.submissions.map((submission) => submission.studentId)
        )

        setAssessment(payload.data)
        setNotSubmitted(
          students.filter((student) => !submittedIds.has(student.id))
        )
        setTitle(payload.data.title)
        setDeadline(toDateTimeLocal(payload.data.deadline))
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError(
          error instanceof Error ? error.message : "Could not load assessment"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAssessment()
    return () => controller.abort()
  }, [id, isStaff])

  async function saveAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedDeadline = new Date(deadline)

    if (title.trim() === "") {
      setEditError("Title is required")
      return
    }

    if (deadline === "" || Number.isNaN(parsedDeadline.getTime())) {
      setEditError("Enter a valid deadline")
      return
    }

    setIsSaving(true)
    setEditError(null)
    setWarning(null)

    try {
      const payload = await fetchApi<
        AssessmentWithRelations,
        AssessmentMutationResponse
      >(`/api/assessments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId ?? "",
        },
        body: JSON.stringify({
          title,
          deadline: parsedDeadline.toISOString(),
        }),
      })

      if (payload.error !== null) {
        setEditError(fieldMessage(payload.error))
        return
      }

      setAssessment((current) =>
        current === null ? current : { ...current, ...payload.data }
      )
      setTitle(payload.data.title)
      setDeadline(toDateTimeLocal(payload.data.deadline))
      setWarning(payload.warning ?? null)
      setIsEditing(false)
      toast.success("Assessment updated")
    } catch {
      setEditError("Could not update assessment. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (!isStaff || isLoading) return <DetailSkeleton />

  if (loadError !== null || assessment === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <h1 className="font-heading text-xl font-semibold">
            {loadError ?? "Assessment not found"}
          </h1>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard/assessments">Back to assessments</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isClosed = new Date(assessment.deadline) <= new Date()

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" className="mb-3 -ml-2" asChild>
          <Link href="/dashboard/assessments">
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Back to assessments
          </Link>
        </Button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                {assessment.title}
              </h1>
              <Badge variant="secondary">{assessment.module.code}</Badge>
              <Badge
                className={cn(
                  isClosed
                    ? "bg-red-500/10 text-red-700 dark:text-red-300"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                )}
              >
                {isClosed ? "Closed" : "Open"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {assessment.module.title} · Due{" "}
              {formatDateTime(assessment.deadline)} · Created by{" "}
              {assessment.createdBy.fullName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {assessment._count.submissions} submission
              {assessment._count.submissions === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setIsEditing((editing) => !editing)
              setEditError(null)
            }}
          >
            <HugeiconsIcon
              icon={Edit02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Edit
          </Button>
        </div>
      </div>

      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveAssessment}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="assessment-title">Title</Label>
                  <Input
                    id="assessment-title"
                    value={title}
                    maxLength={200}
                    disabled={isSaving}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      setEditError(null)
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="assessment-deadline">Deadline</Label>
                  <Input
                    id="assessment-deadline"
                    type="datetime-local"
                    value={deadline}
                    disabled={isSaving}
                    onChange={(event) => {
                      setDeadline(event.target.value)
                      setEditError(null)
                    }}
                  />
                </div>
              </div>
              {editError !== null && (
                <p className="mt-3 text-sm text-destructive">{editError}</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {warning !== null && (
        <Alert className="border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTitle>Deadline warning</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            {warning}
          </AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <CardHeader className="py-5">
          <CardTitle>Submissions</CardTitle>
        </CardHeader>
        {assessment.submissions.length === 0 ? (
          <CardContent className="border-t py-12 text-center text-sm text-muted-foreground">
            No submissions received yet.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Submitted At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessment.submissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-mono font-medium">
                    {submission.student.studentId}
                  </TableCell>
                  <TableCell>{submission.student.user.fullName}</TableCell>
                  <TableCell>
                    {formatDateTime(submission.submittedAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        submission.isLate
                          ? "bg-red-500/10 text-red-700 dark:text-red-300"
                          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      )}
                    >
                      {submission.isLate ? "Late" : "On Time"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={submission.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Download submission"
                      >
                        <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                      </a>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {submission.result === null ? (
                      <span className="text-muted-foreground">Not graded</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{submission.result.grade}%</span>
                        <ClassificationBadge
                          classification={submission.result.classification}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {submission.result?.isPublished ? (
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className="size-4 text-emerald-600"
                        aria-label="Published"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedSubmission(submission)}
                    >
                      {submission.result === null ? "Grade" : "Edit Grade"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Not Yet Submitted</CardTitle>
        </CardHeader>
        <CardContent>
          {notSubmitted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every student in this programme has submitted.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {notSubmitted.map((student) => (
                <div
                  key={student.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{student.user.fullName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {student.studentId}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSubmission !== null && (
        <GradingPanel
          submission={selectedSubmission}
          onOpenChange={(open) => {
            if (!open) setSelectedSubmission(null)
          }}
          onResultSaved={updateResult}
        />
      )}
    </div>
  )

  function updateResult(result: ResultWithRelations) {
    setAssessment((current) => {
      if (current === null) return current

      return {
        ...current,
        submissions: current.submissions.map((submission) =>
          submission.id === result.submissionId
            ? {
                ...submission,
                result: {
                  id: result.id,
                  grade: result.grade,
                  classification: result.classification,
                  isPublished: result.isPublished,
                  gradedAt: result.gradedAt,
                  updatedAt: result.updatedAt,
                },
              }
            : submission
        ),
      }
    })
    setSelectedSubmission((current) =>
      current === null || current.id !== result.submissionId
        ? current
        : {
            ...current,
            result: {
              id: result.id,
              grade: result.grade,
              classification: result.classification,
              isPublished: result.isPublished,
              gradedAt: result.gradedAt,
              updatedAt: result.updatedAt,
            },
          }
    )
  }
}

async function loadProgrammeStudents(
  programmeId: string,
  signal: AbortSignal
): Promise<StudentWithRelations[]> {
  const firstPayload = await fetchApi<
    StudentWithRelations[],
    PaginatedApiResponse<StudentWithRelations[]>
  >(
    `/api/students?programme=${encodeURIComponent(programmeId)}&limit=100&page=1`,
    { signal }
  )

  if (firstPayload.error !== null) {
    throw new Error(firstPayload.error ?? "Could not load programme students")
  }

  if (firstPayload.pagination.totalPages <= 1) return firstPayload.data

  const pages = await Promise.all(
    Array.from(
      { length: firstPayload.pagination.totalPages - 1 },
      async (_, index) => {
        const payload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(
          `/api/students?programme=${encodeURIComponent(programmeId)}&limit=100&page=${index + 2}`,
          { signal }
        )

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load programme students")
        }

        return payload.data
      }
    )
  )

  return [firstPayload.data, ...pages].flat()
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fieldMessage(error: string | null): string {
  if (error === null) return "Could not update assessment"
  const separator = error.indexOf(":")
  return separator === -1 ? error : error.slice(separator + 1).trim()
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  )
}

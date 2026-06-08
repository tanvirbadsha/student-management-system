"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Add01Icon,
  Calendar01Icon,
  File01Icon,
  Upload01Icon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { toast } from "sonner"

import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { UploadDialog } from "@/components/submissions/upload-dialog"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  AssessmentWithRelations,
  PaginatedApiResponse,
  StudentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"
import { cn, formatDateTime } from "@/lib/utils"

type ModuleOption = {
  id: string
  programmeId: string
  title: string
  code: string
}

type ProgrammeOption = {
  id: string
}

type CreateForm = {
  title: string
  moduleId: string
  deadline: string
}

type AssessmentStatusFilter = "all" | "open" | "closed" | "archived"

type DeleteResponse = {
  deleted: true
}

const emptyForm: CreateForm = {
  title: "",
  moduleId: "",
  deadline: "",
}

export function AssessmentsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, isStaff, isStudent } = useRole()
  const status = validStatus(searchParams.get("status"))
  const queryString = useMemo(
    () =>
      status === "all"
        ? ""
        : status === "archived"
          ? "?includeArchived=true&isArchived=true"
          : `?status=${status}`,
    [status]
  )
  const [assessments, setAssessments] = useState<AssessmentWithRelations[]>([])
  const [referenceTime, setReferenceTime] = useState(0)
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [errors, setErrors] = useState<
    Partial<Record<keyof CreateForm, string>>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (role === null) {
      router.replace("/")
    }
  }, [role, router])

  useEffect(() => {
    if (!isStaff) return
    const controller = new AbortController()

    async function loadAssessments() {
      try {
        const payload = await fetchApi<AssessmentWithRelations[]>(
          `/api/assessments${queryString}`,
          {
            signal: controller.signal,
          }
        )

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load assessments")
        }

        setAssessments(payload.data)
        setReferenceTime(Date.now())
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError("Could not load assessments. Please try again.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAssessments()
    return () => controller.abort()
  }, [isStaff, queryString, refreshToken])

  useEffect(() => {
    if (!isStaff) return
    const controller = new AbortController()

    async function loadModules() {
      try {
        const programmesPayload = await fetchApi<ProgrammeOption[]>(
          "/api/programmes",
          {
            signal: controller.signal,
          }
        )

        if (programmesPayload.error !== null) {
          throw new Error("Could not load programmes")
        }

        const moduleGroups = await Promise.all(
          programmesPayload.data.map(async (programme) => {
            const payload = await fetchApi<ModuleOption[]>(
              `/api/modules?programmeId=${encodeURIComponent(programme.id)}`,
              { signal: controller.signal }
            )

            if (payload.error !== null) {
              throw new Error("Could not load modules")
            }

            return payload.data
          })
        )

        setModules(moduleGroups.flat())
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error("Could not load modules")
        }
      }
    }

    void loadModules()
    return () => controller.abort()
  }, [isStaff])

  function changeStatus(value: string) {
    router.push(
      value === "all"
        ? "/dashboard/assessments"
        : `/dashboard/assessments?status=${value}`,
      { scroll: false }
    )
  }

  function updateForm(field: keyof CreateForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function createAssessment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: typeof errors = {}
    const deadline = new Date(form.deadline)

    if (form.title.trim() === "") nextErrors.title = "Title is required"
    if (form.moduleId === "") nextErrors.moduleId = "Module is required"
    if (
      form.deadline === "" ||
      Number.isNaN(deadline.getTime()) ||
      deadline <= new Date()
    ) {
      nextErrors.deadline = "Please choose a future deadline"
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = await fetchApi<AssessmentWithRelations>(
        "/api/assessments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId ?? "",
          },
          body: JSON.stringify({
            title: form.title,
            moduleId: form.moduleId,
            deadline: deadline.toISOString(),
          }),
        }
      )

      if (payload.error !== null) {
        if (payload.error?.includes("Deadline must be in the future")) {
          setErrors({ deadline: "Please choose a future deadline" })
          return
        }

        setErrors(parseErrors(payload.error))
        return
      }

      setDialogOpen(false)
      setForm(emptyForm)
      setErrors({})
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success("Assessment created")
    } catch {
      toast.error("Could not create assessment")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateArchiveState(
    assessment: AssessmentWithRelations,
    isArchived: boolean
  ) {
    if (
      isArchived &&
      !window.confirm(
        "Archive this assessment? Students will no longer be able to submit."
      )
    ) {
      return
    }

    try {
      const payload = await fetchApi<AssessmentWithRelations>(
        `/api/assessments/${assessment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isArchived }),
        }
      )

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      setOpenMenuId(null)
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success(isArchived ? "Assessment archived" : "Assessment restored")
    } catch {
      toast.error("Could not update assessment")
    }
  }

  async function deleteAssessment(assessment: AssessmentWithRelations) {
    if (!window.confirm("Permanently delete this assessment?")) {
      return
    }

    try {
      const payload = await fetchApi<DeleteResponse>(
        `/api/assessments/${assessment.id}`,
        { method: "DELETE" }
      )

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      setOpenMenuId(null)
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success("Assessment deleted")
    } catch {
      toast.error("Could not delete assessment")
    }
  }

  if (isStudent) {
    return <StudentAssessmentsView userId={userId} />
  }

  if (!isStaff) return <AssessmentPageLoading />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        subtitle="Create assessments and monitor submissions"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Create Assessment
          </Button>
        }
      />

      <Tabs value={status} onValueChange={changeStatus}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
        </TabsList>
      </Tabs>

      {loadError !== null ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-danger">{loadError}</p>
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
      ) : isLoading ? (
        <AssessmentGridLoading />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={
            <HugeiconsIcon
              icon={Calendar01Icon}
              strokeWidth={1.8}
              className="size-5"
            />
          }
          title="No assessments yet"
          description="Create the first assessment to start collecting submissions."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              referenceTime={referenceTime}
              menuOpen={openMenuId === assessment.id}
              onMenuOpenChange={(open) =>
                setOpenMenuId(open ? assessment.id : null)
              }
              onArchive={() => updateArchiveState(assessment, true)}
              onRestore={() => updateArchiveState(assessment, false)}
              onDelete={() => deleteAssessment(assessment)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setDialogOpen(open)
            if (!open) {
              setForm(emptyForm)
              setErrors({})
            }
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isSubmitting) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (isSubmitting) event.preventDefault()
          }}
        >
          <form onSubmit={createAssessment}>
            <DialogHeader>
              <DialogTitle>Create Assessment</DialogTitle>
              <DialogDescription>
                Add an assessment to a programme module.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-4">
              <FormField label="Title" error={errors.title}>
                <Input
                  value={form.title}
                  maxLength={200}
                  disabled={isSubmitting}
                  onChange={(event) => updateForm("title", event.target.value)}
                />
              </FormField>
              <FormField label="Module" error={errors.moduleId}>
                <Select
                  value={form.moduleId}
                  disabled={isSubmitting}
                  onValueChange={(value) => updateForm("moduleId", value)}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.code} — {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Deadline" error={errors.deadline}>
                <Input
                  type="datetime-local"
                  value={form.deadline}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateForm("deadline", event.target.value)
                  }
                />
              </FormField>
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Assessment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AssessmentCard({
  assessment,
  referenceTime,
  menuOpen,
  onMenuOpenChange,
  onArchive,
  onRestore,
  onDelete,
}: {
  assessment: AssessmentWithRelations
  referenceTime: number
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const deadline = new Date(assessment.deadline)
  const hoursRemaining = (deadline.getTime() - referenceTime) / 3_600_000
  const isClosed = hoursRemaining <= 0
  const isClosingSoon = !isClosed && hoursRemaining <= 48

  return (
    <Card className={cn(assessment.isArchived && "opacity-60")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{assessment.title}</CardTitle>
          <div className="flex items-center gap-2">
            {assessment.isArchived && <Badge variant="outline">Archived</Badge>}
            <Badge variant="secondary">
              <span className="font-mono text-sm">
                {assessment.module.code}
              </span>
            </Badge>
            <div className="relative">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Assessment actions"
                onClick={() => onMenuOpenChange(!menuOpen)}
              >
                ...
              </Button>
              {menuOpen && (
                <div className="absolute top-7 right-0 z-20 w-36 rounded-md border border-border bg-surface p-1 shadow-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    asChild
                  >
                    <Link href={`/dashboard/assessments/${assessment.id}`}>
                      Edit
                    </Link>
                  </Button>
                  {assessment.isArchived ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={onRestore}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={onArchive}
                    >
                      Archive
                    </Button>
                  )}
                  {assessment._count.submissions === 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-danger"
                      onClick={onDelete}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {assessment.module.title}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            "flex items-center gap-2 text-sm",
            isClosed && "text-danger",
            isClosingSoon && "text-warning",
            !isClosed && !isClosingSoon && "text-text-secondary"
          )}
        >
          <HugeiconsIcon
            icon={Calendar01Icon}
            strokeWidth={2}
            className="size-4"
          />
          <span>
            {isClosed
              ? `Closed — ${formatDateTime(assessment.deadline)}`
              : isClosingSoon
                ? `Closing soon — ${formatDateTime(assessment.deadline)}`
                : formatDateTime(assessment.deadline)}
          </span>
        </div>
        <p className="text-sm text-text-secondary">
          {assessment._count.submissions} submission
          {assessment._count.submissions === 1 ? "" : "s"}
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" variant="outline" asChild>
          <Link href={`/dashboard/assessments/${assessment.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

function StudentAssessmentsView({ userId }: { userId: string | null }) {
  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [assessments, setAssessments] = useState<AssessmentWithRelations[]>([])
  const [submissions, setSubmissions] = useState<SubmissionWithRelations[]>([])
  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    if (userId === null) return
    const currentUserId = userId
    const controller = new AbortController()

    async function loadStudentAssessments() {
      setIsLoading(true)

      try {
        const studentPayload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?userId=${encodeURIComponent(currentUserId)}&limit=1`, {
          signal: controller.signal,
        })

        if (studentPayload.error !== null) {
          throw new Error(studentPayload.error ?? "Could not load student")
        }

        const currentStudent = studentPayload.data[0]
        if (currentStudent === undefined) {
          throw new Error("Student profile not found")
        }

        const [assessmentsPayload, submissionsPayload] = await Promise.all([
          fetchApi<AssessmentWithRelations[]>(
            `/api/assessments?programmeId=${encodeURIComponent(currentStudent.programme.id)}&status=open&isArchived=false`,
            { signal: controller.signal }
          ),
          fetchApi<SubmissionWithRelations[]>(
            `/api/submissions?studentId=${encodeURIComponent(currentStudent.id)}`,
            { signal: controller.signal }
          ),
        ])

        if (assessmentsPayload.error !== null) {
          throw new Error(
            assessmentsPayload.error ?? "Could not load assessments"
          )
        }

        if (submissionsPayload.error !== null) {
          throw new Error(
            submissionsPayload.error ?? "Could not load submissions"
          )
        }

        setStudent(currentStudent)
        setAssessments(assessmentsPayload.data)
        setSubmissions(submissionsPayload.data)
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError(
          error instanceof Error ? error.message : "Could not load assessments"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadStudentAssessments()
    return () => controller.abort()
  }, [refreshToken, userId])

  if (isLoading) return <AssessmentPageLoading />

  if (loadError !== null || student === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-sm text-danger">
            {loadError ?? "Student profile not found"}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => setRefreshToken((token) => token + 1)}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const submissionByAssessment = new Map(
    submissions.map((submission) => [submission.assessmentId, submission])
  )
  const selectedSubmission =
    selectedAssessment === null
      ? undefined
      : submissionByAssessment.get(selectedAssessment.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open Assessments"
        subtitle="Browse current assessments for your programme"
      />

      {assessments.length === 0 ? (
        <EmptyState
          icon={
            <HugeiconsIcon
              icon={Calendar01Icon}
              strokeWidth={1.8}
              className="size-5"
            />
          }
          title="No open assessments"
          description="No open assessments for your programme right now."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => {
            const submission = submissionByAssessment.get(assessment.id)
            const enrolmentInactive =
              student.status === "WITHDRAWN" || student.status === "COMPLETED"

            return (
              <Card key={assessment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      {assessment.title}
                    </CardTitle>
                    <Badge variant="secondary">
                      <span className="font-mono text-sm">
                        {assessment.module.code}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary">
                    {assessment.module.title}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DeadlineCountdown deadline={assessment.deadline} />
                  <StudentSubmissionStatus submission={submission} />

                  {submission !== undefined && (
                    <div className="flex items-start gap-2 rounded-md border p-3">
                      <HugeiconsIcon
                        icon={File01Icon}
                        strokeWidth={2}
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <a
                          href={submission.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-sm font-medium hover:underline"
                        >
                          {fileName(submission.fileUrl)}
                        </a>
                        <p className="text-xs text-text-secondary">
                          Submitted {formatDateTime(submission.submittedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={submission === undefined ? "default" : "outline"}
                    disabled={enrolmentInactive}
                    onClick={() => setSelectedAssessment(assessment)}
                  >
                    <HugeiconsIcon
                      icon={Upload01Icon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    {submission === undefined
                      ? "Submit Now"
                      : "Replace Submission"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <UploadDialog
        open={selectedAssessment !== null}
        assessment={selectedAssessment}
        student={student}
        existingSubmission={selectedSubmission}
        onOpenChange={(open) => {
          if (!open) setSelectedAssessment(null)
        }}
        onUploaded={() => {
          setIsLoading(true)
          setRefreshToken((token) => token + 1)
        }}
      />
    </div>
  )
}

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const daysRemaining = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / 86_400_000
  )
  const label =
    daysRemaining <= 1
      ? "Closes in 1 day"
      : `Closes in ${Math.max(1, daysRemaining)} days`

  return (
    <div
      className={cn(
        "text-sm",
        daysRemaining <= 1 && "text-danger",
        daysRemaining > 1 && daysRemaining <= 3 && "text-warning",
        daysRemaining > 3 && "text-success"
      )}
    >
      {label} · {formatDateTime(deadline)}
    </div>
  )
}

function StudentSubmissionStatus({
  submission,
}: {
  submission: SubmissionWithRelations | undefined
}) {
  if (submission === undefined) {
    return <Badge variant="outline">Not submitted</Badge>
  }

  return (
    <Badge
      className={cn(
        submission.isLate
          ? "bg-danger-bg text-danger"
          : "bg-success-bg text-success"
      )}
    >
      {submission.isLate ? "Late Submission" : "Submitted"}
    </Badge>
  )
}

function fileName(fileUrl: string): string {
  return decodeURIComponent(fileUrl.split("/").pop() ?? fileUrl)
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error !== undefined && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function AssessmentGridLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-52 w-full" />
      ))}
    </div>
  )
}

function AssessmentPageLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function validStatus(value: string | null): AssessmentStatusFilter {
  return value === "open" || value === "closed" || value === "archived"
    ? value
    : "all"
}

function parseErrors(
  error: string | null
): Partial<Record<keyof CreateForm, string>> {
  if (error === null) return {}
  const result: Partial<Record<keyof CreateForm, string>> = {}

  for (const entry of error.split(";")) {
    const separator = entry.indexOf(":")
    if (separator === -1) continue
    const field = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 1).trim()
    if (field === "title" || field === "moduleId" || field === "deadline") {
      result[field] = message
    }
  }

  return result
}

"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Add01Icon, Calendar01Icon } from "@hugeicons/core-free-icons"
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
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type { AssessmentWithRelations } from "@/lib/types"
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
    () => (status === "all" ? "" : `?status=${status}`),
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
}: {
  assessment: AssessmentWithRelations
  referenceTime: number
}) {
  const deadline = new Date(assessment.deadline)
  const hoursRemaining = (deadline.getTime() - referenceTime) / 3_600_000
  const isClosed = hoursRemaining <= 0
  const isClosingSoon = !isClosed && hoursRemaining <= 48

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{assessment.title}</CardTitle>
          <Badge variant="secondary">
            <span className="font-mono text-sm">{assessment.module.code}</span>
          </Badge>
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

function validStatus(value: string | null): "all" | "open" | "closed" {
  return value === "open" || value === "closed" ? value : "all"
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

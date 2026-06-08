"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Download01Icon,
  Search01Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "sonner"

import { StatusBadge } from "@/components/students/status-badge"
import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  PaginatedApiResponse,
  Pagination,
  StudentMutationResponse,
  StudentWithRelations,
} from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

type ProgrammeOption = {
  id: string
  name: string
  code: string
  durationYears: number
}

type FormValues = {
  fullName: string
  email: string
  dateOfBirth: string
  programmeId: string
  academicYear: string
}

type BulkStatusResponse = {
  updated: number
}

const initialForm: FormValues = {
  fullName: "",
  email: "",
  dateOfBirth: "",
  programmeId: "",
  academicYear: "1",
}

const statusOptions = [
  { value: "ALL", label: "All statuses" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "DEFERRED", label: "Deferred" },
  { value: "WITHDRAWN", label: "Withdrawn" },
  { value: "COMPLETED", label: "Completed" },
] as const

const bulkStatusOptions = [
  { value: "ENROLLED", label: "Enrolled" },
  { value: "DEFERRED", label: "Deferred" },
  { value: "COMPLETED", label: "Completed" },
] as const

export function StudentsClient() {
  const searchParams = useSearchParams()
  return (
    <StudentsView
      key={searchParams.toString()}
      initialSearch={searchParams.get("search") ?? ""}
      queryString={searchParams.toString()}
    />
  )
}

function StudentsView({
  initialSearch,
  queryString,
}: {
  initialSearch: string
  queryString: string
}) {
  const router = useRouter()
  const { role, isStaff, isStudent } = useRole()
  const params = useMemo(() => new URLSearchParams(queryString), [queryString])
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [students, setStudents] = useState<StudentWithRelations[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: Number(params.get("page")) || 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<FormValues>(initialForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkStatus, setBulkStatus] = useState("ENROLLED")
  const [isApplyingBulkStatus, setIsApplyingBulkStatus] = useState(false)

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

    async function loadStudents() {
      try {
        const payload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?${queryString}`, {
          signal: controller.signal,
        })

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load students")
        }

        setStudents(payload.data)
        setPagination(payload.pagination)
        setSelectedStudentIds((current) => {
          const pageIds = new Set(payload.data.map((student) => student.id))
          return new Set(
            Array.from(current).filter((studentId) => pageIds.has(studentId))
          )
        })
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setLoadError("Could not load students. Please try again.")
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadStudents()
    return () => controller.abort()
  }, [isStaff, queryString, refreshToken])

  useEffect(() => {
    if (!isStaff) {
      return
    }

    const controller = new AbortController()

    async function loadProgrammes() {
      try {
        const payload = await fetchApi<ProgrammeOption[]>("/api/programmes", {
          signal: controller.signal,
        })

        if (payload.error === null) {
          setProgrammes(payload.data)
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error("Could not load programmes")
        }
      }
    }

    void loadProgrammes()
    return () => controller.abort()
  }, [isStaff])

  useEffect(() => {
    const currentSearch = params.get("search") ?? ""

    if (searchInput === currentSearch) {
      return
    }

    const timeout = window.setTimeout(() => {
      updateQuery({ search: searchInput, page: null })
    }, 300)

    return () => window.clearTimeout(timeout)
  })

  function updateQuery(updates: Record<string, string | null>) {
    const nextParams = new URLSearchParams(queryString)

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "ALL") {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value)
      }
    }

    const nextQuery = nextParams.toString()
    router.push(
      nextQuery === ""
        ? "/dashboard/students"
        : `/dashboard/students?${nextQuery}`,
      { scroll: false }
    )
  }

  function clearFilters() {
    router.push("/dashboard/students", { scroll: false })
  }

  function downloadCsv() {
    const exportParams = new URLSearchParams()
    const search = params.get("search")
    const programme = params.get("programme")
    const status = params.get("status")

    if (search !== null && search !== "") {
      exportParams.set("search", search)
    }

    if (programme !== null && programme !== "") {
      exportParams.set("programme", programme)
    }

    if (status !== null && status !== "") {
      exportParams.set("status", status)
    }

    const query = exportParams.toString()
    window.location.href =
      query === "" ? "/api/students/export" : `/api/students/export?${query}`
  }

  function toggleStudentSelection(studentId: string, checked: boolean) {
    setSelectedStudentIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(studentId)
      } else {
        next.delete(studentId)
      }

      return next
    })
  }

  function togglePageSelection(checked: boolean) {
    setSelectedStudentIds(() =>
      checked ? new Set(students.map((student) => student.id)) : new Set()
    )
  }

  async function applyBulkStatus() {
    const selectedCount = selectedStudentIds.size
    const statusLabel = bulkStatusOptions.find(
      (option) => option.value === bulkStatus
    )?.label

    if (
      selectedCount === 0 ||
      statusLabel === undefined ||
      !window.confirm(
        `Change status of ${selectedCount} students to ${statusLabel}?`
      )
    ) {
      return
    }

    setIsApplyingBulkStatus(true)

    try {
      const payload = await fetchApi<BulkStatusResponse>(
        "/api/students/bulk-status",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentIds: Array.from(selectedStudentIds),
            status: bulkStatus,
          }),
        }
      )

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      setSelectedStudentIds(new Set())
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success(`Updated ${payload.data.updated} students`)
    } catch {
      toast.error("Could not update selected students. Please try again.")
    } finally {
      setIsApplyingBulkStatus(false)
    }
  }

  function updateForm(field: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function resetForm() {
    setForm(initialForm)
    setFieldErrors({})
  }

  function validateForm() {
    const errors: Record<string, string> = {}

    if (form.fullName.trim() === "") {
      errors.fullName = "Full name is required"
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address"
    }

    if (form.dateOfBirth === "") {
      errors.dateOfBirth = "Date of birth is required"
    } else {
      const date = new Date(`${form.dateOfBirth}T00:00:00.000Z`)
      const cutoff = new Date()
      cutoff.setUTCHours(0, 0, 0, 0)
      cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 16)

      if (Number.isNaN(date.getTime()) || date > cutoff) {
        errors.dateOfBirth = "Student must be at least 16 years old"
      }
    }

    if (form.programmeId === "") {
      errors.programmeId = "Programme is required"
    }

    const academicYear = Number(form.academicYear)
    const selectedProgramme = programmes.find(
      (programme) => programme.id === form.programmeId
    )

    if (!Number.isInteger(academicYear) || academicYear < 1) {
      errors.academicYear = "Academic year must be at least 1"
    } else if (
      selectedProgramme !== undefined &&
      academicYear > selectedProgramme.durationYears
    ) {
      errors.academicYear = `Academic year cannot exceed ${selectedProgramme.durationYears}`
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function submitEnrolment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})

    try {
      const payload = await fetchApi<
        StudentWithRelations,
        StudentMutationResponse
      >("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          dateOfBirth: form.dateOfBirth,
          programmeId: form.programmeId,
          academicYear: Number(form.academicYear),
        }),
      })

      if (payload.error !== null) {
        if (payload.error.includes("already exists")) {
          setFieldErrors({
            email: "A user with this email already exists",
          })
          return
        }

        if (payload.error.includes(":")) {
          setFieldErrors(parseFieldErrors(payload.error))
          return
        }

        throw new Error(payload.error ?? "Could not enrol student")
      }

      setDialogOpen(false)
      resetForm()
      toast.success(
        `Student enrolled successfully — ID: ${payload.data.studentId}`
      )
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
    } catch {
      toast.error("Could not enrol student. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isStaff) {
    return <StudentsLoadingState />
  }

  const programmeFilter = params.get("programme") ?? "ALL"
  const statusFilter = params.get("status") ?? "ALL"
  const hasFilters =
    (params.get("search") ?? "") !== "" ||
    programmeFilter !== "ALL" ||
    statusFilter !== "ALL"
  const selectedCount = selectedStudentIds.size
  const allPageSelected =
    students.length > 0 &&
    students.every((student) => selectedStudentIds.has(student.id))
  const somePageSelected =
    students.some((student) => selectedStudentIds.has(student.id)) &&
    !allPageSelected

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Enrolment"
        subtitle="Registry of all enrolled students"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={downloadCsv}>
              <HugeiconsIcon
                icon={Download01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Export CSV
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <HugeiconsIcon
                icon={UserAdd01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Enrol New Student
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-9 pl-9"
              value={searchInput}
              placeholder="Search by name, ID or email"
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            value={programmeFilter}
            onValueChange={(value) =>
              updateQuery({ programme: value, page: null })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All programmes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All programmes</SelectItem>
              {programmes.map((programme) => (
                <SelectItem key={programme.id} value={programme.id}>
                  {programme.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              updateQuery({ status: value, page: null })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
        <StudentTableSkeleton />
      ) : students.length === 0 ? (
        <EmptyState
          icon={
            <HugeiconsIcon
              icon={UserGroupIcon}
              strokeWidth={1.8}
              className="size-5"
            />
          }
          title="No students found"
          description="Try changing or clearing the current filters."
          action={
            hasFilters ? (
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {selectedCount > 0 && (
            <div className="sticky top-3 z-10 flex flex-col gap-3 rounded-md border border-border bg-surface-elevated p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">
                {selectedCount} student{selectedCount === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={bulkStatus}
                  disabled={isApplyingBulkStatus}
                  onValueChange={setBulkStatus}
                >
                  <SelectTrigger className="h-9 w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bulkStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={isApplyingBulkStatus}
                  onClick={applyBulkStatus}
                >
                  {isApplyingBulkStatus ? "Applying..." : "Apply to Selected"}
                </Button>
                <Button
                  variant="link"
                  disabled={isApplyingBulkStatus}
                  onClick={() => setSelectedStudentIds(new Set())}
                >
                  Clear selection
                </Button>
              </div>
            </div>
          )}

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all students on this page"
                      checked={allPageSelected}
                      ref={(element) => {
                        if (element !== null) {
                          element.indeterminate = somePageSelected
                        }
                      }}
                      className="size-4 rounded border-border accent-accent"
                      onChange={(event) =>
                        togglePageSelection(event.target.checked)
                      }
                    />
                  </TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Programme</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outstanding Balance</TableHead>
                  <TableHead>Overdue</TableHead>
                  <TableHead>Enrolled Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow
                    key={student.id}
                    data-state={
                      selectedStudentIds.has(student.id)
                        ? "selected"
                        : undefined
                    }
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${student.user.fullName}`}
                        checked={selectedStudentIds.has(student.id)}
                        className="size-4 rounded border-border accent-accent"
                        onChange={(event) =>
                          toggleStudentSelection(
                            student.id,
                            event.target.checked
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {student.studentId}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{student.user.fullName}</p>
                        <p className="text-text-secondary">
                          {student.user.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {student.programme.code}
                      </span>
                    </TableCell>
                    <TableCell>{student.academicYear}</TableCell>
                    <TableCell>
                      <StatusBadge status={student.status} />
                    </TableCell>
                    <TableCell>
                      {student.fee === null
                        ? "—"
                        : formatCurrency(student.fee.outstanding)}
                    </TableCell>
                    <TableCell>
                      {student.fee?.isOverdue ? (
                        <Badge className="bg-danger-bg text-danger">
                          Overdue
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatDate(student.enrolledAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/students/${student.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-text-secondary">
              {pagination.total} student
              {pagination.total === 1 ? "" : "s"} total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() =>
                  updateQuery({
                    page: String(Math.max(1, pagination.page - 1)),
                  })
                }
              >
                <HugeiconsIcon
                  icon={ArrowLeft01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Previous
              </Button>
              <span className="px-2 text-sm">
                Page {pagination.page} of {Math.max(1, pagination.totalPages)}
              </span>
              <Button
                variant="outline"
                disabled={
                  pagination.totalPages === 0 ||
                  pagination.page >= pagination.totalPages
                }
                onClick={() =>
                  updateQuery({ page: String(pagination.page + 1) })
                }
              >
                Next
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setDialogOpen(open)
            if (!open) {
              resetForm()
            }
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (isSubmitting) {
              event.preventDefault()
            }
          }}
        >
          <form onSubmit={submitEnrolment}>
            <DialogHeader>
              <DialogTitle>Enrol New Student</DialogTitle>
              <DialogDescription>
                Create the student account, registry profile, and initial fee
                record.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <FormField
                id="fullName"
                label="Full Name"
                error={fieldErrors.fullName}
              >
                <Input
                  id="fullName"
                  value={form.fullName}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                />
              </FormField>

              <FormField id="email" label="Email" error={fieldErrors.email}>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  disabled={isSubmitting}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </FormField>

              <FormField
                id="dateOfBirth"
                label="Date of Birth"
                error={fieldErrors.dateOfBirth}
              >
                <Input
                  id="dateOfBirth"
                  type="date"
                  max={maximumDateOfBirth()}
                  value={form.dateOfBirth}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateForm("dateOfBirth", event.target.value)
                  }
                />
              </FormField>

              <FormField
                id="programmeId"
                label="Programme"
                error={fieldErrors.programmeId}
              >
                <Select
                  value={form.programmeId}
                  disabled={isSubmitting}
                  onValueChange={(value) => updateForm("programmeId", value)}
                >
                  <SelectTrigger id="programmeId" className="h-9 w-full">
                    <SelectValue placeholder="Select a programme" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmes.map((programme) => (
                      <SelectItem key={programme.id} value={programme.id}>
                        {programme.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                id="academicYear"
                label="Academic Year"
                error={fieldErrors.academicYear}
              >
                <Input
                  id="academicYear"
                  type="number"
                  min={1}
                  max={
                    programmes.find(
                      (programme) => programme.id === form.programmeId
                    )?.durationYears
                  }
                  value={form.academicYear}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    updateForm("academicYear", event.target.value)
                  }
                />
              </FormField>
            </div>

            {fieldErrors.body !== undefined && (
              <p className="mt-4 text-sm text-danger">{fieldErrors.body}</p>
            )}

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
                {isSubmitting ? "Enrolling..." : "Enrol Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error !== undefined && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function StudentTableSkeleton() {
  return (
    <Card className="py-0">
      <div className="space-y-3 p-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  )
}

function StudentsLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

function parseFieldErrors(error: string): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const entry of error.split(";")) {
    const separator = entry.indexOf(":")

    if (separator === -1) {
      fieldErrors.body = entry.trim()
      continue
    }

    const field = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 1).trim()
    fieldErrors[field] = message
  }

  return fieldErrors
}

function maximumDateOfBirth(): string {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - 16)
  return date.toISOString().slice(0, 10)
}

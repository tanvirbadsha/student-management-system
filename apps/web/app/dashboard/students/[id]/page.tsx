"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft01Icon,
  Edit02Icon,
  LockIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toast } from "sonner"

import { StatusBadge } from "@/components/students/status-badge"
import { StudentFees } from "@/components/fees/student-fees"
import { useRole } from "@/lib/context/role-context"
import type {
  ApiResponse,
  StudentDetail,
  StudentMutationResponse,
} from "@/lib/types"
import { formatDate } from "@/lib/utils"

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, isStaff, isStudent } = useRole()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState("")
  const [academicYear, setAcademicYear] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (role === null) {
      router.replace("/")
    }
  }, [role, router])

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudent() {
      try {
        const response = await fetch(`/api/students/${id}`, {
          signal: controller.signal,
        })
        const payload = (await response.json()) as ApiResponse<StudentDetail>

        if (!response.ok || payload.error !== null) {
          throw new Error(
            response.status === 404
              ? "Student not found"
              : (payload.error ?? "Could not load student")
          )
        }

        setStudent(payload.data)
        setStatus(payload.data.status)
        setAcademicYear(String(payload.data.academicYear))
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setLoadError(
          error instanceof Error ? error.message : "Could not load student"
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadStudent()
    return () => controller.abort()
  }, [id])

  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const year = Number(academicYear)

    if (!Number.isInteger(year) || year < 1) {
      setEditError("Academic year must be at least 1")
      return
    }

    setIsSaving(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          academicYear: year,
        }),
      })
      const payload = (await response.json()) as StudentMutationResponse

      if (!response.ok || payload.error !== null) {
        setEditError(
          payload.error?.includes(":")
            ? payload.error.slice(payload.error.indexOf(":") + 1).trim()
            : (payload.error ?? "Could not update student")
        )
        return
      }

      setStudent((current) =>
        current === null
          ? current
          : {
              ...current,
              ...payload.data,
            }
      )
      setEditOpen(false)
      toast.success("Student details updated")

      if (payload.note !== undefined) {
        toast.info(payload.note)
      }
    } catch {
      setEditError("Could not update student. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || role === null) {
    return <DetailSkeleton />
  }

  if (loadError !== null || student === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <h1 className="font-heading text-xl font-semibold">
            {loadError ?? "Student not found"}
          </h1>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard/students">Back to students</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isStudent && student.user.id !== userId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-6" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold">
            403 — Access denied
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Student accounts can only view their own registry record.
          </p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard">Return to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        {isStaff && (
          <Button variant="ghost" className="mb-3 -ml-2" asChild>
            <Link href="/dashboard/students">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Back to students
            </Link>
          </Button>
        )}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                {student.user.fullName}
              </h1>
              <StatusBadge status={student.status} />
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {student.studentId}
            </p>
          </div>
          {isStaff && (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(student.status)
                setAcademicYear(String(student.academicYear))
                setEditError(null)
                setEditOpen(true)
              }}
            >
              <HugeiconsIcon
                icon={Edit02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Edit
            </Button>
          )}
        </div>
      </div>

      <Tabs
        defaultValue={searchParams.get("tab") === "fees" ? "fees" : "overview"}
      >
        <TabsList
          className="w-full justify-start overflow-x-auto"
          variant="line"
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions &amp; Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Student information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Full name" value={student.user.fullName} />
              <InfoItem label="Email" value={student.user.email} />
              <InfoItem label="Student ID" value={student.studentId} />
              <InfoItem
                label="Date of birth"
                value={formatDate(student.dateOfBirth)}
              />
              <InfoItem
                label="Programme"
                value={`${student.programme.name} (${student.programme.code})`}
              />
              <InfoItem
                label="Academic year"
                value={`Year ${student.academicYear}`}
              />
              <InfoItem
                label="Status"
                value={
                  student.status.charAt(0) +
                  student.status.slice(1).toLowerCase()
                }
              />
              <InfoItem
                label="Enrolled date"
                value={formatDate(student.enrolledAt)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <StudentFees studentId={student.id} isStaff={isStaff} />
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <PlaceholderCard>
            Submissions &amp; Results — see Prompts 6 and 7
          </PlaceholderCard>
        </TabsContent>
      </Tabs>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!isSaving) {
            setEditOpen(open)
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isSaving) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (isSaving) {
              event.preventDefault()
            }
          }}
        >
          <form onSubmit={saveChanges}>
            <DialogHeader>
              <DialogTitle>Edit student</DialogTitle>
              <DialogDescription>
                Update enrolment status and current academic year.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={status}
                  disabled={isSaving}
                  onValueChange={setStatus}
                >
                  <SelectTrigger id="edit-status" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENROLLED">Enrolled</SelectItem>
                    <SelectItem value="DEFERRED">Deferred</SelectItem>
                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="edit-academic-year">Academic Year</Label>
                <Input
                  id="edit-academic-year"
                  type="number"
                  min={1}
                  value={academicYear}
                  disabled={isSaving}
                  onChange={(event) => {
                    setAcademicYear(event.target.value)
                    setEditError(null)
                  }}
                />
              </div>

              {editError !== null && (
                <p className="text-sm text-destructive">{editError}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function PlaceholderCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-8 w-full max-w-md" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

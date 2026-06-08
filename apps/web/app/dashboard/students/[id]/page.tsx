"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowDataTransferHorizontalIcon,
  Delete02Icon,
  Edit02Icon,
  LockIcon,
  WasteIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  StudentDetail,
  StudentMutationResponse,
  StudentNoteRecord,
  StudentWithRelations,
} from "@/lib/types"
import { formatDate, formatDateTime } from "@/lib/utils"

type ProgrammeOption = {
  id: string
  name: string
  code: string
  durationYears: number
}

type DeleteResponse = {
  deleted: true
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, isStaff, isStudent } = useRole()
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [editOpen, setEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState("")
  const [academicYear, setAcademicYear] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [selectedProgrammeId, setSelectedProgrammeId] = useState("")
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [notes, setNotes] = useState<StudentNoteRecord[]>([])
  const [notesRefreshToken, setNotesRefreshToken] = useState(0)
  const [notesLoadError, setNotesLoadError] = useState<string | null>(null)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [noteContent, setNoteContent] = useState("")
  const [noteError, setNoteError] = useState<string | null>(null)
  const [isNoteSubmitting, setIsNoteSubmitting] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmAction, setConfirmAction] = useState<
    "withdraw" | "delete-student" | null
  >(null)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)
  const [isDeletingNote, setIsDeletingNote] = useState(false)

  useEffect(() => {
    if (role === null) {
      router.replace("/")
    }
  }, [role, router])

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudent() {
      try {
        const payload = await fetchApi<StudentDetail>(`/api/students/${id}`, {
          signal: controller.signal,
        })

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load student")
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
  }, [id, refreshToken])

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
    if (!isStaff) {
      return
    }

    const controller = new AbortController()

    async function loadNotes() {
      try {
        const payload = await fetchApi<StudentNoteRecord[]>(
          `/api/students/${id}/notes`,
          {
            signal: controller.signal,
          }
        )

        if (payload.error !== null) {
          throw new Error(payload.error)
        }

        setNotes(payload.data)
        setNotesLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setNotesLoadError(
          error instanceof Error ? error.message : "Could not load notes"
        )
      }
    }

    void loadNotes()
    return () => controller.abort()
  }, [id, isStaff, notesRefreshToken])

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
      const payload = await fetchApi<
        StudentWithRelations,
        StudentMutationResponse
      >(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          academicYear: year,
        }),
      })

      if (payload.error !== null) {
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

  async function transferProgramme(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (selectedProgrammeId === "") {
      setTransferError("Select a new programme")
      return
    }

    setIsTransferring(true)
    setTransferError(null)

    try {
      const payload = await fetchApi<
        StudentWithRelations,
        StudentMutationResponse
      >(`/api/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programmeId: selectedProgrammeId }),
      })

      if (payload.error !== null) {
        setTransferError(cleanApiError(payload.error))
        return
      }

      setTransferOpen(false)
      setSelectedProgrammeId("")
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success("Programme transferred — fee updated")
    } catch {
      setTransferError("Could not transfer programme. Please try again.")
    } finally {
      setIsTransferring(false)
    }
  }

  async function withdrawStudent() {
    setIsWithdrawing(true)

    try {
      const payload = await fetchApi<
        StudentWithRelations,
        StudentMutationResponse
      >(`/api/students/${id}/withdraw`, {
        method: "PATCH",
      })

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      setStudent((current) =>
        current === null ? current : { ...current, ...payload.data }
      )
      setConfirmAction(null)
      toast.success("Student withdrawn")
    } catch {
      toast.error("Could not withdraw student. Please try again.")
    } finally {
      setIsWithdrawing(false)
    }
  }

  async function deleteStudentRecord() {
    setIsDeleting(true)

    try {
      const payload = await fetchApi<DeleteResponse>(`/api/students/${id}`, {
        method: "DELETE",
      })

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      toast.success("Student record deleted")
      router.push("/dashboard/students")
    } catch {
      toast.error("Could not delete student record. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = noteContent.trim()

    if (content === "") {
      setNoteError("Note content is required")
      return
    }

    if (content.length > 1000) {
      setNoteError("Note content must be 1000 characters or fewer")
      return
    }

    setIsNoteSubmitting(true)
    setNoteError(null)

    try {
      const payload = await fetchApi<StudentNoteRecord>(
        `/api/students/${id}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      )

      if (payload.error !== null) {
        setNoteError(cleanApiError(payload.error))
        return
      }

      setNoteDialogOpen(false)
      setNoteContent("")
      setNotesRefreshToken((token) => token + 1)
      toast.success("Note added")
    } catch {
      setNoteError("Could not add note. Please try again.")
    } finally {
      setIsNoteSubmitting(false)
    }
  }

  async function deleteNote() {
    if (noteToDelete === null) return
    setIsDeletingNote(true)
    try {
      const payload = await fetchApi<DeleteResponse>(
        `/api/students/notes/${noteToDelete}`,
        { method: "DELETE" }
      )

      if (payload.error !== null) {
        toast.error(payload.error)
        return
      }

      setNotesRefreshToken((token) => token + 1)
      setNoteToDelete(null)
      toast.success("Note deleted")
    } catch {
      toast.error("Could not delete note. Please try again.")
    } finally {
      setIsDeletingNote(false)
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
          <span className="flex size-12 items-center justify-center rounded-full bg-[#7f1d1d] text-white">
            <HugeiconsIcon icon={LockIcon} strokeWidth={2} className="size-6" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold">
            403 — Access denied
          </h1>
          <p className="mt-2 max-w-md text-sm text-text-secondary">
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
            <p className="mt-1 font-mono text-sm text-text-secondary">
              {student.studentId}
            </p>
          </div>
          {isStaff && (
            <div className="flex flex-col gap-2 sm:items-end">
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
              <Button
                variant="secondary"
                onClick={() => {
                  const nextProgramme = programmes.find(
                    (programme) => programme.id !== student.programme.id
                  )
                  setSelectedProgrammeId(nextProgramme?.id ?? "")
                  setTransferError(null)
                  setTransferOpen(true)
                }}
              >
                <HugeiconsIcon
                  icon={ArrowDataTransferHorizontalIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Transfer Programme
              </Button>
            </div>
          )}
        </div>
      </div>

      {student.status === "WITHDRAWN" && (
        <Alert variant="destructive">
          <AlertTitle>Withdrawn</AlertTitle>
          <AlertDescription>
            This student has withdrawn from the programme.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={initialTab(searchParams.get("tab"), isStaff)}>
        <TabsList
          className="w-full justify-start overflow-x-auto"
          variant="line"
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="submissions">
            Submissions &amp; Results
          </TabsTrigger>
          {isStaff && <TabsTrigger value="notes">Notes</TabsTrigger>}
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
              {student.withdrawalDate !== null && (
                <InfoItem
                  label="Withdrawal date"
                  value={formatDate(student.withdrawalDate)}
                />
              )}
            </CardContent>
          </Card>

          {isStaff && (
            <Card className="mt-4 border-danger/40">
              <CardHeader>
                <CardTitle>Danger zone</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Student record actions</p>
                  <p className="mt-1 max-w-2xl text-sm text-text-secondary">
                    Withdraw keeps the registry record. Delete Record (no
                    history) is only for accidental enrolments with no payments,
                    submissions, or results.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    disabled={
                      isWithdrawing ||
                      student.status === "WITHDRAWN" ||
                      student.status === "COMPLETED"
                    }
                    onClick={() => setConfirmAction("withdraw")}
                  >
                    <HugeiconsIcon
                      icon={WasteIcon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    {isWithdrawing ? "Withdrawing..." : "Withdraw Student"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={() => setConfirmAction("delete-student")}
                  >
                    <HugeiconsIcon
                      icon={Delete02Icon}
                      strokeWidth={2}
                      data-icon="inline-start"
                    />
                    {isDeleting ? "Deleting..." : "Delete Record (no history)"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          <StudentFees studentId={student.id} isStaff={isStaff} />
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          <PlaceholderCard>
            Submissions &amp; Results — see Prompts 6 and 7
          </PlaceholderCard>
        </TabsContent>

        {isStaff && (
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Notes</CardTitle>
                <Button
                  onClick={() => {
                    setNoteContent("")
                    setNoteError(null)
                    setNoteDialogOpen(true)
                  }}
                >
                  <HugeiconsIcon
                    icon={Add01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Add Note
                </Button>
              </CardHeader>
              <CardContent>
                {notesLoadError !== null ? (
                  <p className="text-sm text-danger">{notesLoadError}</p>
                ) : notes.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-text-secondary">
                    No notes yet. Add a note to record registry actions for this
                    student.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-md border border-border bg-surface-elevated p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              {note.author.fullName}
                            </p>
                            <p className="mt-0.5 text-xs text-text-secondary">
                              {formatDateTime(note.createdAt)}
                            </p>
                          </div>
                          {note.authorId === userId && (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Delete note"
                              onClick={() => setNoteToDelete(note.id)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                strokeWidth={2}
                              />
                            </Button>
                          )}
                        </div>
                        <p className="mt-3 text-sm whitespace-pre-wrap text-text-primary">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
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
                <p className="text-sm text-danger">{editError}</p>
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

      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          if (!isTransferring) {
            setTransferOpen(open)
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isTransferring) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (isTransferring) {
              event.preventDefault()
            }
          }}
        >
          <form onSubmit={transferProgramme}>
            <DialogHeader>
              <DialogTitle>Transfer to New Programme</DialogTitle>
              <DialogDescription>
                Current: {student.programme.name} ({student.programme.code})
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="transfer-programme">Programme</Label>
                <Select
                  value={selectedProgrammeId}
                  disabled={isTransferring}
                  onValueChange={(value) => {
                    setSelectedProgrammeId(value)
                    setTransferError(null)
                  }}
                >
                  <SelectTrigger id="transfer-programme" className="h-9 w-full">
                    <SelectValue placeholder="Select a programme" />
                  </SelectTrigger>
                  <SelectContent>
                    {programmes
                      .filter(
                        (programme) => programme.id !== student.programme.id
                      )
                      .map((programme) => (
                        <SelectItem key={programme.id} value={programme.id}>
                          {programme.name} ({programme.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Alert>
                <AlertTitle>Fee recalculation</AlertTitle>
                <AlertDescription>
                  Transferring programmes will recalculate this student&apos;s
                  total fee based on the new programme&apos;s fee amount.
                  Existing payments will be retained and deducted from the new
                  total.
                </AlertDescription>
              </Alert>

              {transferError !== null && (
                <p className="text-sm text-danger">{transferError}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isTransferring}
                onClick={() => setTransferOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isTransferring}>
                {isTransferring ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={noteDialogOpen}
        onOpenChange={(open) => {
          if (!isNoteSubmitting) {
            setNoteDialogOpen(open)
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isNoteSubmitting) {
              event.preventDefault()
            }
          }}
          onPointerDownOutside={(event) => {
            if (isNoteSubmitting) {
              event.preventDefault()
            }
          }}
        >
          <form onSubmit={addNote}>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
              <DialogDescription>
                Record a registry action for this student.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-2">
              <Label htmlFor="student-note">Note</Label>
              <textarea
                id="student-note"
                rows={4}
                maxLength={1000}
                value={noteContent}
                disabled={isNoteSubmitting}
                className="min-h-28 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50"
                onChange={(event) => {
                  setNoteContent(event.target.value)
                  setNoteError(null)
                }}
              />
              <div className="flex items-center justify-between gap-3">
                {noteError !== null ? (
                  <p className="text-xs text-danger">{noteError}</p>
                ) : (
                  <span />
                )}
                <p className="text-xs text-text-secondary">
                  {noteContent.length}/1000
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isNoteSubmitting}
                onClick={() => setNoteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isNoteSubmitting}>
                {isNoteSubmitting ? "Adding..." : "Add Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmAction === "withdraw"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
        title="Withdraw Student"
        description="This will mark the student as Withdrawn. This cannot be automatically reversed."
        confirmLabel="Withdraw Student"
        isLoading={isWithdrawing}
        onConfirm={() => void withdrawStudent()}
      />

      <ConfirmDialog
        open={confirmAction === "delete-student"}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
        title="Delete Student Record"
        description="This will permanently delete an accidental enrolment record if it has no payments, submissions, or results."
        confirmLabel="Delete Student Record"
        isLoading={isDeleting}
        onConfirm={() => void deleteStudentRecord()}
      />

      <ConfirmDialog
        open={noteToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setNoteToDelete(null)
        }}
        title="Delete Note"
        description="This will permanently delete this registry note."
        confirmLabel="Delete Note"
        isLoading={isDeletingNote}
        onConfirm={() => void deleteNote()}
      />
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function PlaceholderCard({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 text-center text-sm text-text-secondary">
        {children}
      </CardContent>
    </Card>
  )
}

function initialTab(tab: string | null, isStaff: boolean) {
  if (tab === "fees" || tab === "submissions") {
    return tab
  }

  if (tab === "notes" && isStaff) {
    return tab
  }

  return "overview"
}

function cleanApiError(error: string) {
  return error.includes(":")
    ? error.slice(error.indexOf(":") + 1).trim()
    : error
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

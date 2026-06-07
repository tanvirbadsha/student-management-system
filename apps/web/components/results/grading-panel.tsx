"use client"

import { useMemo, useState } from "react"
import { Download01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { toast } from "sonner"

import { useRole } from "@/lib/context/role-context"
import type {
  ApiResponse,
  ResultMutationResponse,
  ResultWithRelations,
  SubmissionResult,
} from "@/lib/types"
import { cn, deriveClassification, formatDateTime } from "@/lib/utils"

import { ClassificationBadge } from "./classification-badge"

type GradingPanelProps = {
  submission: GradingSubmission | null
  onOpenChange: (open: boolean) => void
  onResultSaved: (result: ResultWithRelations) => void
}

export type GradingSubmission = {
  id: string
  fileUrl: string
  submittedAt: string
  isLate: boolean
  student: {
    studentId: string
    user: {
      fullName: string
    }
  }
  assessment: {
    title: string
  }
  result: SubmissionResult | null
}

export function GradingPanel({
  submission,
  onOpenChange,
  onResultSaved,
}: GradingPanelProps) {
  const { userId, role } = useRole()
  const result = submission?.result ?? null
  const [gradeInput, setGradeInput] = useState(
    result === null ? "" : String(result.grade)
  )
  const [wholeNumberWarning, setWholeNumberWarning] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const parsedGrade = Number(gradeInput)
  const hasValidPreview =
    gradeInput.trim() !== "" &&
    Number.isFinite(parsedGrade) &&
    parsedGrade >= 0 &&
    parsedGrade <= 100
  const previewClassification = hasValidPreview
    ? deriveClassification(Math.round(parsedGrade))
    : null

  const roundedGrade = useMemo(() => {
    if (gradeInput.trim() === "") return null
    const value = Number(gradeInput)
    if (!Number.isFinite(value) || value < 0 || value > 100) return null
    return Math.round(value)
  }, [gradeInput])

  function normalizeGrade() {
    if (gradeInput.trim() === "") return
    const value = Number(gradeInput)

    if (!Number.isFinite(value)) return

    const rounded = Math.round(value)
    if (rounded !== value) {
      setWholeNumberWarning("Grades must be whole numbers")
    }
    setGradeInput(String(rounded))
  }

  async function saveGrade() {
    if (submission === null) return
    normalizeGrade()

    if (roundedGrade === null) {
      setError("Grade must be a whole number between 0 and 100")
      return
    }

    if (result?.isPublished === true && roundedGrade !== result.grade) {
      const confirmed = window.confirm(
        "Updating this grade will unpublish the result and hide it from the student. The result must be re-published after the update. Continue?"
      )

      if (!confirmed) return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response =
        result === null
          ? await fetch("/api/results", {
              method: "POST",
              headers: requestHeaders(userId, role),
              body: JSON.stringify({
                submissionId: submission.id,
                grade: roundedGrade,
              }),
            })
          : await fetch(`/api/results/${result.id}`, {
              method: "PATCH",
              headers: requestHeaders(userId, role),
              body: JSON.stringify({
                grade: roundedGrade,
              }),
            })
      const payload =
        result === null
          ? ((await response.json()) as ApiResponse<ResultWithRelations>)
          : ((await response.json()) as ResultMutationResponse)

      if (!response.ok || payload.error !== null) {
        setError(payload.error ?? "Could not save grade")
        return
      }

      onResultSaved(payload.data)
      onOpenChange(false)

      if (result === null) {
        toast.success("Grade saved — not yet published")
      } else if ("warning" in payload && typeof payload.warning === "string") {
        toast.warning(payload.warning)
      } else {
        toast.success("Grade updated")
      }
    } catch {
      setError("Could not save grade. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  async function updatePublishState(isPublished: boolean) {
    if (result === null) return

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/results/${result.id}`, {
        method: "PATCH",
        headers: requestHeaders(userId, role),
        body: JSON.stringify({ isPublished }),
      })
      const payload = (await response.json()) as ResultMutationResponse

      if (!response.ok || payload.error !== null) {
        setError(payload.error ?? "Could not update result")
        return
      }

      onResultSaved(payload.data)
      onOpenChange(false)
      toast.success(isPublished ? "Result published" : "Result unpublished")
    } catch {
      setError("Could not update result. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={submission !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        {submission !== null && (
          <>
            <DialogHeader>
              <DialogTitle>
                Grade Submission — {submission.student.user.fullName}
              </DialogTitle>
              <DialogDescription>
                {submission.assessment.title}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
                <Detail
                  label="Student"
                  value={submission.student.user.fullName}
                />
                <Detail
                  label="Student ID"
                  value={submission.student.studentId}
                  mono
                />
                <Detail
                  label="Submitted"
                  value={formatDateTime(submission.submittedAt)}
                />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Status
                  </p>
                  <Badge
                    className={cn(
                      "mt-1",
                      submission.isLate
                        ? "bg-red-500/10 text-red-700 dark:text-red-300"
                        : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    {submission.isLate ? "Late" : "On Time"}
                  </Badge>
                </div>
                <div className="sm:col-span-2">
                  <Button variant="outline" asChild>
                    <a
                      href={submission.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <HugeiconsIcon
                        icon={Download01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      Open file
                    </a>
                  </Button>
                </div>
              </div>

              {result !== null && (
                <Alert
                  className={cn(
                    result.isPublished
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                  )}
                >
                  <AlertTitle>
                    {result.isPublished ? "Published" : "Saved"}
                  </AlertTitle>
                  <AlertDescription>
                    {result.isPublished
                      ? "This result has been published to the student."
                      : "This result is saved but not visible to the student yet."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label htmlFor="grade-input">Grade</Label>
                <Input
                  id="grade-input"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={gradeInput}
                  disabled={isSaving}
                  onBlur={normalizeGrade}
                  onChange={(event) => {
                    setGradeInput(event.target.value)
                    setError(null)
                    setWholeNumberWarning(null)
                  }}
                />
                <div className="flex min-h-6 items-center gap-2">
                  {previewClassification !== null && (
                    <ClassificationBadge
                      classification={previewClassification}
                    />
                  )}
                  {wholeNumberWarning !== null && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {wholeNumberWarning}
                    </p>
                  )}
                </div>
              </div>

              {error !== null && (
                <Alert className="border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                  <AlertTitle>Could not save result</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={isSaving} onClick={saveGrade}>
                {isSaving
                  ? "Saving..."
                  : result === null
                    ? "Save Grade"
                    : "Update Grade"}
              </Button>
              {result !== null && !result.isPublished && (
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => updatePublishState(true)}
                >
                  Publish Result
                </Button>
              )}
              {result !== null && result.isPublished && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => updatePublishState(false)}
                >
                  Unpublish Result
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Detail({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1", mono && "font-mono")}>{value}</p>
    </div>
  )
}

function requestHeaders(userId: string | null, role: string | null) {
  return {
    "Content-Type": "application/json",
    "x-user-id": userId ?? "",
    "x-user-role": role ?? "",
  }
}

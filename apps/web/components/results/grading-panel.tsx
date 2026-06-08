"use client"

import { useEffect, useMemo, useState } from "react"
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

import { fetchApi } from "@/lib/api-client"
import type {
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
  const result = submission?.result ?? null
  const initialGrade = result === null ? "" : String(result.grade)
  const [gradeInput, setGradeInput] = useState(initialGrade)
  const [wholeNumberWarning, setWholeNumberWarning] = useState<string | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const hasUnsavedChanges = gradeInput !== initialGrade

  useEffect(() => {
    if (!hasUnsavedChanges) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])

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
      const payload =
        result === null
          ? await fetchApi<ResultWithRelations>("/api/results", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                submissionId: submission.id,
                grade: roundedGrade,
              }),
            })
          : await fetchApi<ResultWithRelations, ResultMutationResponse>(
              `/api/results/${result.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  grade: roundedGrade,
                }),
              }
            )

      if (payload.error !== null) {
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

    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved grade changes. Leave anyway?")
    ) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const payload = await fetchApi<
        ResultWithRelations,
        ResultMutationResponse
      >(`/api/results/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      })

      if (payload.error !== null) {
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

  function requestOpenChange(open: boolean) {
    if (!open && hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved grade changes. Leave anyway?"
      )

      if (!confirmed) return
    }

    onOpenChange(open)
  }

  return (
    <Dialog open={submission !== null} onOpenChange={requestOpenChange}>
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
                  <p className="text-xs font-medium text-text-secondary">
                    Status
                  </p>
                  <Badge
                    className={cn(
                      "mt-1",
                      submission.isLate
                        ? "bg-[#7f1d1d] text-white"
                        : "bg-[#14532d] text-white"
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
                      ? "border-emerald-950 bg-[#14532d] text-white"
                      : "border-orange-950 bg-[#7c2d12] text-white"
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

              {submission.isLate && (
                <Alert className="border-orange-950 bg-[#7c2d12] text-white">
                  <AlertTitle>Late submission</AlertTitle>
                  <AlertDescription>
                    This is a late submission - submitted on{" "}
                    {formatDateTime(submission.submittedAt)}. Apply your late
                    penalty policy before grading if applicable.
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
                    <p className="text-xs text-warning">{wholeNumberWarning}</p>
                  )}
                </div>
              </div>

              {error !== null && (
                <Alert variant="destructive">
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
                onClick={() => requestOpenChange(false)}
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
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={cn("mt-1", mono && "font-mono text-sm")}>{value}</p>
    </div>
  )
}

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { toast } from "sonner"

import { fetchApi } from "@/lib/api-client"
import type {
  AssessmentWithRelations,
  StudentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"

const MAX_FILE_SIZE = 10 * 1024 * 1024

type UploadDialogProps = {
  assessment: AssessmentWithRelations | null
  student: StudentWithRelations | null
  existingSubmission?: SubmissionWithRelations
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: () => void
}

export function UploadDialog({
  assessment,
  student,
  existingSubmission,
  open,
  onOpenChange,
  onUploaded,
}: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)

  function closeDialog() {
    setSelectedFile(null)
    setFileError(null)
    setFileInputKey((key) => key + 1)
    onOpenChange(false)
  }

  function chooseFile(file: File | null) {
    setSelectedFile(null)
    setFileError(null)

    if (file === null) return

    const extension = file.name.toLowerCase().split(".").pop()
    if (extension !== "pdf" && extension !== "docx") {
      setFileError("Only PDF and DOCX files are accepted")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size must not exceed 10MB")
      return
    }

    setSelectedFile(file)
  }

  async function uploadSubmission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (assessment === null || student === null || selectedFile === null) {
      setFileError("Select a PDF or DOCX file")
      return
    }

    const isLateInitialSubmission =
      new Date(assessment.deadline) <= new Date() &&
      existingSubmission === undefined

    if (isLateInitialSubmission) {
      const confirmed = window.confirm(
        "The deadline for this assessment has passed. Your submission will be marked as late. Do you want to continue?"
      )

      if (!confirmed) return
    }

    setIsUploading(true)
    setFileError(null)
    const formData = new FormData()
    formData.set("assessmentId", assessment.id)
    formData.set("studentId", student.id)
    formData.set("file", selectedFile)
    formData.set("lateConfirmed", String(isLateInitialSubmission))

    try {
      const payload = await fetchApi<SubmissionWithRelations>(
        "/api/submissions",
        {
          method: "POST",
          body: formData,
        }
      )

      if (payload.error !== null) {
        if (payload.error.includes("Resubmission is no longer allowed")) {
          setFileError(
            "The deadline has passed. You can no longer replace your submission."
          )
        } else if (payload.error.includes("Only PDF and DOCX")) {
          setFileError("Only PDF and DOCX files are accepted")
        } else {
          setFileError(fieldMessage(payload.error))
        }
        return
      }

      toast.success("Submission received")
      closeDialog()
      onUploaded()
    } catch {
      setFileError("Could not upload submission. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isUploading) closeDialog()
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (isUploading) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (isUploading) event.preventDefault()
        }}
      >
        <form onSubmit={uploadSubmission}>
          <DialogHeader>
            <DialogTitle>
              {existingSubmission === undefined
                ? "Upload Submission"
                : "Replace Submission"}
            </DialogTitle>
            <DialogDescription>
              Upload a PDF or DOCX file up to 10MB.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-2">
            <Label htmlFor="submission-file">File</Label>
            <Input
              key={fileInputKey}
              id="submission-file"
              type="file"
              accept=".pdf,.docx"
              disabled={isUploading}
              onChange={(event) =>
                chooseFile(event.target.files?.item(0) ?? null)
              }
            />
            {selectedFile !== null && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <p className="truncate font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            )}
            {fileError !== null && (
              <p className="text-xs text-danger">{fileError}</p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={closeDialog}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUploading}>
              {isUploading ? "Uploading..." : "Submit File"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function fieldMessage(error: string | null): string {
  if (error === null) return "Could not upload submission"
  const separator = error.indexOf(":")
  return separator === -1 ? error : error.slice(separator + 1).trim()
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

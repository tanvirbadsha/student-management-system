"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  File01Icon,
  Upload01Icon,
  UserGroupIcon,
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"

import { useRole } from "@/lib/context/role-context"
import type {
  ApiResponse,
  AssessmentWithRelations,
  PaginatedApiResponse,
  StudentWithRelations,
  SubmissionWithRelations,
} from "@/lib/types"
import { cn, formatDateTime } from "@/lib/utils"

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function MySubmissionsPage() {
  const router = useRouter()
  const { role, userId, isStaff, isStudent } = useRole()
  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [assessments, setAssessments] = useState<AssessmentWithRelations[]>([])
  const [submissions, setSubmissions] = useState<SubmissionWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectedAssessment, setSelectedAssessment] =
    useState<AssessmentWithRelations | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    if (isStaff) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStaff, role, router])

  useEffect(() => {
    if (!isStudent || userId === null) return
    const currentUserId = userId
    const controller = new AbortController()

    async function loadData() {
      try {
        const studentResponse = await fetch(
          `/api/students?userId=${encodeURIComponent(currentUserId)}&limit=1`,
          { signal: controller.signal }
        )
        const studentPayload =
          (await studentResponse.json()) as PaginatedApiResponse<
            StudentWithRelations[]
          >

        if (!studentResponse.ok || studentPayload.error !== null) {
          throw new Error(studentPayload.error ?? "Could not load student")
        }

        const currentStudent = studentPayload.data[0]
        if (currentStudent === undefined) {
          throw new Error("Student profile not found")
        }

        const [assessmentsResponse, submissionsResponse] = await Promise.all([
          fetch(
            `/api/assessments?programmeId=${encodeURIComponent(currentStudent.programme.id)}`,
            { signal: controller.signal }
          ),
          fetch(
            `/api/submissions?studentId=${encodeURIComponent(currentStudent.id)}`,
            { signal: controller.signal }
          ),
        ])
        const assessmentsPayload =
          (await assessmentsResponse.json()) as ApiResponse<
            AssessmentWithRelations[]
          >
        const submissionsPayload =
          (await submissionsResponse.json()) as ApiResponse<
            SubmissionWithRelations[]
          >

        if (!assessmentsResponse.ok || assessmentsPayload.error !== null) {
          throw new Error(
            assessmentsPayload.error ?? "Could not load assessments"
          )
        }

        if (!submissionsResponse.ok || submissionsPayload.error !== null) {
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
          error instanceof Error ? error.message : "Could not load submissions"
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadData()
    return () => controller.abort()
  }, [isStudent, refreshToken, userId])

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

    if (
      selectedAssessment === null ||
      student === null ||
      selectedFile === null
    ) {
      setFileError("Select a PDF or DOCX file")
      return
    }

    setIsUploading(true)
    setFileError(null)
    const formData = new FormData()
    formData.set("assessmentId", selectedAssessment.id)
    formData.set("studentId", student.id)
    formData.set("file", selectedFile)

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "x-user-id": userId ?? "",
        },
        body: formData,
      })
      const payload =
        (await response.json()) as ApiResponse<SubmissionWithRelations>

      if (!response.ok || payload.error !== null) {
        if (payload.error?.includes("Resubmission is no longer allowed")) {
          setFileError(
            "The deadline has passed. You can no longer replace your submission."
          )
        } else if (payload.error?.includes("Only PDF and DOCX")) {
          setFileError("Only PDF and DOCX files are accepted")
        } else {
          setFileError(fieldMessage(payload.error))
        }
        return
      }

      closeDialog()
      setIsLoading(true)
      setRefreshToken((token) => token + 1)
      toast.success("Submission received")
    } catch {
      setFileError("Could not upload submission. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  function closeDialog() {
    setSelectedAssessment(null)
    setSelectedFile(null)
    setFileError(null)
    setFileInputKey((key) => key + 1)
  }

  if (!isStudent || isLoading) return <SubmissionsSkeleton />

  if (loadError !== null || student === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-sm text-destructive">
            {loadError ?? "Student profile not found"}
          </p>
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
    )
  }

  const submissionByAssessment = new Map(
    submissions.map((submission) => [submission.assessmentId, submission])
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          My Submissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload coursework and review submission status
        </p>
      </div>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <HugeiconsIcon
              icon={UserGroupIcon}
              strokeWidth={1.8}
              className="size-8 text-muted-foreground"
            />
            <h2 className="mt-4 font-heading text-lg font-medium">
              No assessments are available for your programme.
            </h2>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assessments.map((assessment) => {
            const submission = submissionByAssessment.get(assessment.id)
            const isClosed = new Date(assessment.deadline) <= new Date()

            return (
              <Card key={assessment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      {assessment.title}
                    </CardTitle>
                    <Badge variant="secondary">{assessment.module.code}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {assessment.module.title}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Deadline
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        isClosed
                          ? "text-red-700 dark:text-red-300"
                          : "text-muted-foreground"
                      )}
                    >
                      {isClosed ? "Closed — " : ""}
                      {formatDateTime(assessment.deadline)}
                    </p>
                  </div>

                  <SubmissionStatus submission={submission} />

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
                        <p className="text-xs text-muted-foreground">
                          {submission.fileType} ·{" "}
                          {formatDateTime(submission.submittedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  {!isClosed && (
                    <Button
                      className="w-full"
                      variant={submission === undefined ? "default" : "outline"}
                      onClick={() => setSelectedAssessment(assessment)}
                    >
                      <HugeiconsIcon
                        icon={Upload01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      {submission === undefined
                        ? "Upload File"
                        : "Replace File"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={selectedAssessment !== null}
        onOpenChange={(open) => {
          if (!open && !isUploading) closeDialog()
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
                {selectedAssessment !== null &&
                submissionByAssessment.has(selectedAssessment.id)
                  ? "Replace Submission"
                  : "Upload Submission"}
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
                <p className="text-xs text-destructive">{fileError}</p>
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
    </div>
  )
}

function SubmissionStatus({
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
          ? "bg-red-500/10 text-red-700 dark:text-red-300"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      )}
    >
      Submitted — {submission.isLate ? "Late" : "On Time"}
    </Badge>
  )
}

function fileName(fileUrl: string): string {
  return decodeURIComponent(fileUrl.split("/").pop() ?? fileUrl)
}

function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`
}

function fieldMessage(error: string | null): string {
  if (error === null) return "Could not upload submission"
  const separator = error.indexOf(":")
  return separator === -1 ? error : error.slice(separator + 1).trim()
}

function SubmissionsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-72 w-full" />
        ))}
      </div>
    </div>
  )
}

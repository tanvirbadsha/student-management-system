import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { FileType } from "@prisma/client"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads")

export async function saveFile(
  file: File,
  studentId: string,
  assessmentId: string
): Promise<{ fileUrl: string; fileType: FileType }> {
  const extension = path.extname(file.name).toLowerCase()

  if (extension !== ".pdf" && extension !== ".docx") {
    throw new Error("Only PDF and DOCX files are accepted")
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File size must not exceed 10MB")
  }

  const fileType = extension === ".pdf" ? FileType.PDF : FileType.DOCX
  const filename = `${safeSegment(studentId)}_${safeSegment(assessmentId)}_${Date.now()}${extension}`

  await mkdir(UPLOAD_DIRECTORY, { recursive: true })
  await writeFile(
    path.join(UPLOAD_DIRECTORY, filename),
    Buffer.from(await file.arrayBuffer())
  )

  return {
    fileUrl: `/uploads/${filename}`,
    fileType,
  }
}

export async function deleteUploadedFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith("/uploads/")) {
    return
  }

  const filename = path.basename(fileUrl)

  try {
    await unlink(path.join(UPLOAD_DIRECTORY, filename))
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error
    }
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_")
}

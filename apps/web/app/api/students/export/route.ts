import { EnrolmentStatus, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { studentListSelect } from "@/lib/server/student-records"
import { formatDate } from "@/lib/utils"

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const status = searchParams.get("status")?.trim() ?? ""

  if (
    status !== "" &&
    !Object.values(EnrolmentStatus).includes(status as EnrolmentStatus)
  ) {
    return Response.json(
      { data: null, error: "status: Invalid enrolment status" },
      { status: 400 }
    )
  }

  const search = searchParams.get("search")?.trim() ?? ""
  const programmeId = searchParams.get("programme")?.trim() ?? ""
  const where: Prisma.StudentWhereInput = {
    ...(programmeId !== "" ? { programmeId } : {}),
    ...(status !== "" ? { status: status as EnrolmentStatus } : {}),
    ...(search !== ""
      ? {
          OR: [
            {
              studentId: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              user: {
                fullName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                email: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  }

  try {
    const students = await prisma.student.findMany({
      where,
      select: studentListSelect,
      orderBy: { enrolledAt: "desc" },
    })
    const csv = toStudentCsv(students)
    const filename = `students-export-${new Date().toISOString().slice(0, 10)}.csv`

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return Response.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    )
  }
}

type StudentCsvRecord = Prisma.StudentGetPayload<{
  select: typeof studentListSelect
}>

function toStudentCsv(students: StudentCsvRecord[]): string {
  const rows = [
    [
      "Student ID",
      "Full Name",
      "Email",
      "Date of Birth",
      "Programme",
      "Academic Year",
      "Status",
      "Enrolled Date",
      "Total Fee",
      "Amount Paid",
      "Outstanding",
      "Overdue",
    ],
    ...students.map((student) => [
      student.studentId,
      student.user.fullName,
      student.user.email,
      formatDate(student.dateOfBirth),
      `${student.programme.name} (${student.programme.code})`,
      `Year ${student.academicYear}`,
      student.status,
      formatDate(student.enrolledAt),
      student.fee?.totalAmount.toFixed(2) ?? "",
      student.fee?.amountPaid.toFixed(2) ?? "",
      student.fee?.outstanding.toFixed(2) ?? "",
      student.fee?.isOverdue ? "Yes" : "No",
    ]),
  ]

  return `${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n")}\r\n`
}

function escapeCsvValue(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value
  }

  return `"${value.replaceAll('"', '""')}"`
}

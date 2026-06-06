import bcrypt from "bcryptjs"
import {
  Classification,
  EnrolmentStatus,
  FileType,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client"

const prisma = new PrismaClient()

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function generateStudentId(year: number, index: number): string {
  return `SMS-${year}-${index.toString().padStart(4, "0")}`
}

async function main() {
  const now = new Date()
  const today = startOfUtcDay(now)
  const currentYear = now.getUTCFullYear()
  const passwordHash = await bcrypt.hash("password123", 12)

  await prisma.$transaction(
    async (tx) => {
      await tx.result.deleteMany()
      await tx.submission.deleteMany()
      await tx.assessment.deleteMany()
      await tx.payment.deleteMany()
      await tx.fee.deleteMany()
      await tx.student.deleteMany()
      await tx.module.deleteMany()
      await tx.programme.deleteMany()
      await tx.user.deleteMany()

      const bscProgramme = await tx.programme.create({
        data: {
          name: "BSc Computer Science",
          code: "BSC-CS",
          feeAmount: 9250,
          durationYears: 3,
          modules: {
            create: [
              {
                title: "Introduction to Algorithms",
                code: "CS101",
              },
              {
                title: "Database Systems",
                code: "CS201",
              },
            ],
          },
        },
        include: { modules: true },
      })

      const mbaProgramme = await tx.programme.create({
        data: {
          name: "MBA Business Administration",
          code: "MBA-BA",
          feeAmount: 14500,
          durationYears: 2,
          modules: {
            create: [
              {
                title: "Strategic Management",
                code: "MBA101",
              },
              {
                title: "Financial Accounting",
                code: "MBA201",
              },
            ],
          },
        },
        include: { modules: true },
      })

      const cs101 = bscProgramme.modules.find(
        (module) => module.code === "CS101"
      )
      const cs201 = bscProgramme.modules.find(
        (module) => module.code === "CS201"
      )
      const mba101 = mbaProgramme.modules.find(
        (module) => module.code === "MBA101"
      )

      if (cs101 === undefined || cs201 === undefined || mba101 === undefined) {
        throw new Error("Failed to create required modules")
      }

      const drMitchell = await tx.user.create({
        data: {
          fullName: "Dr Sarah Mitchell",
          email: "s.mitchell@college.ac.uk",
          passwordHash,
          role: Role.STAFF,
        },
      })

      const profOkafor = await tx.user.create({
        data: {
          fullName: "Prof James Okafor",
          email: "j.okafor@college.ac.uk",
          passwordHash,
          role: Role.STAFF,
        },
      })

      const alice = await createStudent(tx, {
        fullName: "Alice Nguyen",
        email: "alice.nguyen@student.ac.uk",
        passwordHash,
        programmeId: bscProgramme.id,
        studentId: generateStudentId(currentYear, 1),
        academicYear: 2,
        status: EnrolmentStatus.ENROLLED,
        dateOfBirth: new Date("2001-03-14T00:00:00.000Z"),
        totalAmount: 9250,
        amountPaid: 4625,
        dueDate: addUtcMonths(today, 3),
        payments: [
          {
            amount: 4625,
            paymentDate: addUtcMonths(today, -1),
            referenceNumber: "TXN-2025-001",
          },
        ],
        today,
      })

      const ben = await createStudent(tx, {
        fullName: "Ben Carter",
        email: "ben.carter@student.ac.uk",
        passwordHash,
        programmeId: bscProgramme.id,
        studentId: generateStudentId(currentYear, 2),
        academicYear: 1,
        status: EnrolmentStatus.ENROLLED,
        dateOfBirth: new Date("2003-07-22T00:00:00.000Z"),
        totalAmount: 9250,
        amountPaid: 0,
        dueDate: addUtcMonths(today, -1),
        payments: [],
        today,
      })

      await createStudent(tx, {
        fullName: "Fatima Al-Hassan",
        email: "fatima.alhassan@student.ac.uk",
        passwordHash,
        programmeId: mbaProgramme.id,
        studentId: generateStudentId(currentYear, 3),
        academicYear: 1,
        status: EnrolmentStatus.ENROLLED,
        dateOfBirth: new Date("1995-11-05T00:00:00.000Z"),
        totalAmount: 14500,
        amountPaid: 14500,
        dueDate: addUtcMonths(today, 6),
        payments: [
          {
            amount: 8000,
            paymentDate: addUtcMonths(today, -2),
            referenceNumber: "TXN-2025-002",
          },
          {
            amount: 6500,
            paymentDate: addUtcMonths(today, -1),
            referenceNumber: "TXN-2025-003",
          },
        ],
        today,
      })

      await createStudent(tx, {
        fullName: "Liam Brooks",
        email: "liam.brooks@student.ac.uk",
        passwordHash,
        programmeId: bscProgramme.id,
        studentId: generateStudentId(currentYear, 4),
        academicYear: 2,
        status: EnrolmentStatus.DEFERRED,
        dateOfBirth: new Date("2000-01-30T00:00:00.000Z"),
        totalAmount: 9250,
        amountPaid: 2000,
        dueDate: addUtcDays(today, -14),
        payments: [
          {
            amount: 2000,
            paymentDate: addUtcMonths(today, -1),
            referenceNumber: "TXN-2025-004",
          },
        ],
        today,
      })

      await createStudent(tx, {
        fullName: "Priya Sharma",
        email: "priya.sharma@student.ac.uk",
        passwordHash,
        programmeId: mbaProgramme.id,
        studentId: generateStudentId(currentYear, 5),
        academicYear: 2,
        status: EnrolmentStatus.ENROLLED,
        dateOfBirth: new Date("1992-09-18T00:00:00.000Z"),
        totalAmount: 14500,
        amountPaid: 7000,
        dueDate: addUtcMonths(today, 2),
        payments: [
          {
            amount: 7000,
            paymentDate: addUtcMonths(today, -1),
            referenceNumber: "TXN-2025-005",
          },
        ],
        today,
      })

      const databaseDeadline = addUtcDays(now, -3)

      await tx.assessment.create({
        data: {
          title: "Algorithms Coursework 1",
          moduleId: cs101.id,
          createdById: drMitchell.id,
          deadline: addUtcDays(now, 14),
        },
      })

      const databaseAssessment = await tx.assessment.create({
        data: {
          title: "Database Design Project",
          moduleId: cs201.id,
          createdById: drMitchell.id,
          deadline: databaseDeadline,
        },
      })

      await tx.assessment.create({
        data: {
          title: "Strategic Analysis Report",
          moduleId: mba101.id,
          createdById: profOkafor.id,
          deadline: addUtcMonths(now, 1),
        },
      })

      const aliceSubmission = await tx.submission.create({
        data: {
          assessmentId: databaseAssessment.id,
          studentId: alice.id,
          fileUrl: "/submissions/alice-database-design.pdf",
          fileType: FileType.PDF,
          submittedAt: addUtcDays(databaseDeadline, -1),
          isLate: false,
        },
      })

      const benSubmission = await tx.submission.create({
        data: {
          assessmentId: databaseAssessment.id,
          studentId: ben.id,
          fileUrl: "/submissions/ben-database-design.docx",
          fileType: FileType.DOCX,
          submittedAt: addUtcDays(databaseDeadline, 1),
          isLate: true,
        },
      })

      await tx.result.createMany({
        data: [
          {
            submissionId: aliceSubmission.id,
            studentId: alice.id,
            assessmentId: databaseAssessment.id,
            grade: 72,
            classification: Classification.DISTINCTION,
            isPublished: true,
          },
          {
            submissionId: benSubmission.id,
            studentId: ben.id,
            assessmentId: databaseAssessment.id,
            grade: 45,
            classification: Classification.PASS,
            isPublished: false,
          },
        ],
      })
    },
    { timeout: 20_000 }
  )

  console.log("Database seeded successfully")
}

type StudentSeedData = {
  fullName: string
  email: string
  passwordHash: string
  programmeId: string
  studentId: string
  academicYear: number
  status: EnrolmentStatus
  dateOfBirth: Date
  totalAmount: number
  amountPaid: number
  dueDate: Date
  payments: Array<{
    amount: number
    paymentDate: Date
    referenceNumber: string
  }>
  today: Date
}

async function createStudent(
  tx: Prisma.TransactionClient,
  data: StudentSeedData
) {
  const outstanding = data.totalAmount - data.amountPaid
  const isOverdue = data.dueDate < data.today && outstanding > 0

  const user = await tx.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash: data.passwordHash,
      role: Role.STUDENT,
      student: {
        create: {
          programmeId: data.programmeId,
          studentId: data.studentId,
          academicYear: data.academicYear,
          status: data.status,
          dateOfBirth: data.dateOfBirth,
        },
      },
    },
    include: { student: true },
  })

  if (user.student === null) {
    throw new Error(`Failed to create student profile for ${data.email}`)
  }

  await tx.fee.create({
    data: {
      studentId: user.student.id,
      totalAmount: data.totalAmount,
      amountPaid: data.amountPaid,
      outstanding,
      dueDate: data.dueDate,
      isOverdue,
      payments: {
        create: data.payments,
      },
    },
  })

  return user.student
}

async function run() {
  try {
    await main()
  } catch (error: unknown) {
    console.error("Database seed failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void run()

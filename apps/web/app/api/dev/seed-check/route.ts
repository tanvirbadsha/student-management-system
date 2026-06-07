export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { prisma } = await import("@/lib/prisma")
  const [
    users,
    students,
    programmes,
    modules,
    assessments,
    submissions,
    results,
    fees,
    payments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.programme.count(),
    prisma.module.count(),
    prisma.assessment.count(),
    prisma.submission.count(),
    prisma.result.count(),
    prisma.fee.count(),
    prisma.payment.count(),
  ])

  return Response.json({
    data: {
      users,
      students,
      programmes,
      modules,
      assessments,
      submissions,
      results,
      fees,
      payments,
    },
    error: null,
  })
}

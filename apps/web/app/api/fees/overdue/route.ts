import { prisma } from "@/lib/prisma"
import { overdueFeeSelect, serializeOverdueFee } from "@/lib/server/fee-records"
import type { ApiResponse, OverdueFeeRecord } from "@/lib/types"

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      where: {
        fee: {
          isOverdue: true,
        },
      },
      select: overdueFeeSelect,
      orderBy: {
        fee: {
          outstanding: "desc",
        },
      },
    })

    const response: ApiResponse<OverdueFeeRecord[]> = {
      data: students.map(serializeOverdueFee),
      error: null,
    }

    return Response.json(response)
  } catch {
    const response: ApiResponse<OverdueFeeRecord[]> = {
      data: null,
      error: "Internal server error",
    }
    return Response.json(response, { status: 500 })
  }
}

import { Role } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { ApiResponse, UserListItem } from "@/lib/types"

export async function GET(request: Request) {
  const roleParam = new URL(request.url).searchParams.get("role")

  if (roleParam !== Role.STAFF && roleParam !== Role.STUDENT) {
    const response: ApiResponse<UserListItem[]> = {
      data: null,
      error: "role param must be STAFF or STUDENT",
    }

    return Response.json(response, { status: 400 })
  }

  try {
    const users = await prisma.user.findMany({
      where: { role: roleParam },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
      orderBy: { fullName: "asc" },
    })

    const response: ApiResponse<UserListItem[]> = {
      data: users,
      error: null,
    }

    return Response.json(response)
  } catch {
    const response: ApiResponse<UserListItem[]> = {
      data: null,
      error: "Could not load users",
    }

    return Response.json(response, { status: 500 })
  }
}

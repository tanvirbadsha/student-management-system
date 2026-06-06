"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useRole } from "@/lib/context/role-context"

export default function DashboardPage() {
  const router = useRouter()
  const { role } = useRole()

  useEffect(() => {
    if (role === null) {
      router.replace("/")
    }
  }, [role, router])

  if (role === null) {
    return (
      <div className="space-y-3" aria-label="Loading dashboard">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold">
          {role === "STAFF"
            ? "Staff Dashboard — coming in next prompt"
            : "Student Dashboard — coming in next prompt"}
        </h1>
      </CardContent>
    </Card>
  )
}

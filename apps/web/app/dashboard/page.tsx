"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { StaffDashboard } from "@/components/dashboard/staff-dashboard"
import { StudentDashboard } from "@/components/dashboard/student-dashboard"
import { useRole } from "@/lib/context/role-context"

export default function DashboardPage() {
  const router = useRouter()
  const { role, userId } = useRole()

  useEffect(() => {
    if (role === null) {
      router.replace("/")
    }
  }, [role, router])

  if (role === null) {
    return (
      <div className="space-y-6" aria-label="Loading dashboard">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (role === "STAFF") {
    return <StaffDashboard />
  }

  return userId === null ? (
    <Skeleton className="h-96 w-full" />
  ) : (
    <StudentDashboard userId={userId} />
  )
}

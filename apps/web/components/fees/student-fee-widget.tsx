"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import type { PaginatedApiResponse, StudentWithRelations } from "@/lib/types"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

export function StudentFeeWidget({ userId }: { userId: string }) {
  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudent() {
      try {
        const response = await fetch(
          `/api/students?userId=${encodeURIComponent(userId)}&limit=1`,
          { signal: controller.signal }
        )
        const payload = (await response.json()) as PaginatedApiResponse<
          StudentWithRelations[]
        >

        if (!response.ok || payload.error !== null) {
          throw new Error(payload.error ?? "Could not load fee status")
        }

        const currentStudent = payload.data[0]

        if (currentStudent === undefined) {
          throw new Error("Student profile not found")
        }

        setStudent(currentStudent)
        setError(null)
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load fee status"
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadStudent()
    return () => controller.abort()
  }, [userId])

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  if (error !== null || student?.fee === null || student === null) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          {error ?? "Fee record not found"}
        </CardContent>
      </Card>
    )
  }

  const fee = student.fee
  const isFullyPaid = fee.outstanding === 0
  const tone = fee.isOverdue ? "red" : isFullyPaid ? "green" : "amber"
  const Icon = fee.isOverdue
    ? AlertCircleIcon
    : isFullyPaid
      ? CheckmarkCircle02Icon
      : Clock01Icon

  return (
    <Card
      className={cn(
        "border-2",
        tone === "red" &&
          "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
        tone === "green" &&
          "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30",
        tone === "amber" &&
          "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      )}
    >
      <CardContent className="flex flex-col justify-between gap-5 py-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            icon={Icon}
            strokeWidth={2}
            className={cn(
              "mt-0.5 size-5 shrink-0",
              tone === "red" && "text-red-700 dark:text-red-300",
              tone === "green" && "text-emerald-700 dark:text-emerald-300",
              tone === "amber" && "text-amber-700 dark:text-amber-300"
            )}
          />
          <div>
            <h2 className="font-heading font-semibold">Fee status</h2>
            <p className="mt-1 text-sm">
              {fee.isOverdue
                ? `Your fees are overdue. Outstanding: ${formatCurrency(fee.outstanding)}. Please contact the Registry immediately.`
                : isFullyPaid
                  ? "Your fees are fully paid. Thank you."
                  : `Outstanding: ${formatCurrency(fee.outstanding)}. Payment is due by ${formatDate(fee.dueDate)}.`}
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0 bg-background/70" asChild>
          <Link href={`/dashboard/students/${student.id}?tab=fees`}>
            View full fee details
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              data-icon="inline-end"
            />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

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
import { fetchApi } from "@/lib/api-client"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

export function StudentFeeWidget({ userId }: { userId: string }) {
  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadStudent() {
      try {
        const payload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?userId=${encodeURIComponent(userId)}&limit=1`, {
          signal: controller.signal,
        })

        if (payload.error !== null) {
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
        <CardContent className="py-10 text-center text-sm text-danger">
          {error ?? "Fee record not found"}
        </CardContent>
      </Card>
    )
  }

  const fee = student.fee
  const isFullyPaid = Math.round(fee.outstanding * 100) === 0
  const isOverdue = fee.isOverdue && !isFullyPaid
  const tone = isOverdue ? "red" : isFullyPaid ? "green" : "amber"
  const Icon = isOverdue
    ? AlertCircleIcon
    : isFullyPaid
      ? CheckmarkCircle02Icon
      : Clock01Icon

  return (
    <Card
      className={cn(
        "border-0 text-white shadow-md [&_[data-slot=card-title]]:text-white",
        tone === "red" && "bg-[#6f1d1b]",
        tone === "green" && "bg-[#14532d]",
        tone === "amber" && "bg-[#7f1d1d]"
      )}
    >
      <CardContent className="flex flex-col justify-between gap-5 py-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <HugeiconsIcon
            icon={Icon}
            strokeWidth={2}
            className="mt-0.5 size-5 shrink-0 text-white"
          />
          <div>
            <h2 className="font-heading font-semibold">Fee status</h2>
            <p className="mt-1 text-sm">
              {isOverdue
                ? `Your fees are overdue. Outstanding: ${formatCurrency(fee.outstanding)}. Please contact the Registry immediately.`
                : isFullyPaid
                  ? "Your fees are fully paid. Thank you."
                  : `Outstanding: ${formatCurrency(fee.outstanding)}. Payment is due by ${formatDate(fee.dueDate)}.`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="shrink-0 border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
          asChild
        >
          <Link href="/dashboard/my-fees">
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

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/ui/page-header"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type {
  FeeDetailsData,
  PaginatedApiResponse,
  StudentWithRelations,
} from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function MyFeesPage() {
  const router = useRouter()
  const { role, userId, isStaff, isStudent } = useRole()
  const [student, setStudent] = useState<StudentWithRelations | null>(null)
  const [feeData, setFeeData] = useState<FeeDetailsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isStaff) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStaff, role, router])

  useEffect(() => {
    if (!isStudent || userId === null) return
    const currentUserId = userId
    const controller = new AbortController()

    async function loadFees() {
      setIsLoading(true)

      try {
        const studentPayload = await fetchApi<
          StudentWithRelations[],
          PaginatedApiResponse<StudentWithRelations[]>
        >(`/api/students?userId=${encodeURIComponent(currentUserId)}&limit=1`, {
          signal: controller.signal,
        })

        if (studentPayload.error !== null) {
          throw new Error(studentPayload.error ?? "Could not load student")
        }

        const currentStudent = studentPayload.data[0]

        if (currentStudent === undefined) {
          throw new Error("Student profile not found")
        }

        const feePayload = await fetchApi<FeeDetailsData>(
          `/api/fees/${currentStudent.id}`,
          { signal: controller.signal }
        )

        if (feePayload.error !== null) {
          throw new Error(feePayload.error ?? "Could not load fees")
        }

        setStudent(currentStudent)
        setFeeData(feePayload.data)
        setError(null)
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return
        }

        setError(
          loadError instanceof Error ? loadError.message : "Could not load fees"
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadFees()
    return () => controller.abort()
  }, [isStudent, userId])

  if (!isStudent || isLoading) {
    return <MyFeesSkeleton />
  }

  if (error !== null || student === null || feeData === null) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-danger">
          {error ?? "Fee details unavailable"}
        </CardContent>
      </Card>
    )
  }

  const fee = feeData.fee
  const progress =
    fee.totalAmount === 0
      ? 0
      : Math.min(100, Math.round((fee.amountPaid / fee.totalAmount) * 100))

  return (
    <div className="space-y-6">
      <PageHeader title="My Fees" subtitle="Your programme fee status" />

      <Card>
        <CardHeader>
          <CardTitle>{student.programme.name} fee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-medium text-text-secondary">Total fee</p>
            <p className="mt-1 font-mono text-4xl font-semibold">
              {formatCurrency(fee.totalAmount)}
            </p>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-text-secondary">
                {formatCurrency(fee.amountPaid)} /{" "}
                {formatCurrency(fee.totalAmount)}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InlineStat label="Paid" value={formatCurrency(fee.amountPaid)} />
            <InlineStat
              label="Outstanding"
              value={formatCurrency(fee.outstanding)}
            />
            <InlineStat label="Due" value={formatDate(fee.dueDate)} />
          </div>

          <FeeStatusAlert fee={fee} />
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="py-5">
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        {fee.payments.length === 0 ? (
          <CardContent className="border-t py-12 text-center text-sm text-text-secondary">
            No payments recorded yet.
          </CardContent>
        ) : (
          <Table>
            <TableCaption className="sr-only">
              My payment history
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fee.payments.map((payment, index) => (
                <TableRow key={payment.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-mono font-medium">
                    {payment.referenceNumber}
                  </TableCell>
                  <TableCell>{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function FeeStatusAlert({ fee }: { fee: FeeDetailsData["fee"] }) {
  const isFullyPaid = Math.round(fee.outstanding * 100) === 0

  if (fee.isWaived) {
    return (
      <Alert className="border-purple-300 bg-purple-50 text-purple-700">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
        <AlertTitle>Fee balance waived</AlertTitle>
        <AlertDescription className="text-purple-700">
          Your fee balance has been waived. No payment required.
        </AlertDescription>
      </Alert>
    )
  }

  if (fee.isOverdue && !isFullyPaid) {
    return (
      <Alert variant="destructive" className="border-danger bg-danger-bg">
        <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
        <AlertTitle>Overdue</AlertTitle>
        <AlertDescription>
          Your fees are overdue. Please contact the Registry immediately.
        </AlertDescription>
      </Alert>
    )
  }

  if (isFullyPaid) {
    return (
      <Alert className="border-success bg-success-bg text-success">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
        <AlertTitle>Fully paid</AlertTitle>
        <AlertDescription className="text-success">
          Your fees are fully paid. No action required.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="border-warning bg-warning-bg text-warning">
      <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
      <AlertTitle>Payment due</AlertTitle>
      <AlertDescription className="text-warning">
        Payment due by {formatDate(fee.dueDate)}.
      </AlertDescription>
    </Alert>
  )
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-elevated px-3 py-2">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold">{value}</p>
    </div>
  )
}

function MyFeesSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  )
}

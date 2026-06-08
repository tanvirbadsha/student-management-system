"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircleIcon,
  CalendarAdd01Icon,
  CheckmarkCircle02Icon,
  CreditCardAddIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Progress } from "@workspace/ui/components/progress"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { toast } from "sonner"

import type {
  FeeDetailsData,
  FeeRecord,
  FeeWithPayments,
  PaymentMutationData,
} from "@/lib/types"
import { fetchApi } from "@/lib/api-client"
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  utcDateInputValue,
} from "@/lib/utils"

type StudentFeesProps = {
  studentId: string
  isStaff: boolean
}

type PaymentForm = {
  amount: string
  paymentDate: string
  referenceNumber: string
}

type AdjustmentType = "DISCOUNT" | "WAIVER" | "CORRECTION"

type AdjustmentForm = {
  adjustmentType: AdjustmentType
  amount: string
  reason: string
}

type FeeAdjustmentResponse = {
  fee: FeeRecord
}

export function StudentFees({ studentId, isStaff }: StudentFeesProps) {
  const [fee, setFee] = useState<FeeWithPayments | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [extendOpen, setExtendOpen] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [dueDateError, setDueDateError] = useState<string | null>(null)
  const [isExtending, setIsExtending] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(() =>
    emptyPaymentForm()
  )
  const [paymentErrors, setPaymentErrors] = useState<
    Partial<Record<keyof PaymentForm | "body", string>>
  >({})
  const [isRecording, setIsRecording] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({
    adjustmentType: "DISCOUNT",
    amount: "",
    reason: "",
  })
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const enteredPaymentAmount = Number(paymentForm.amount)
  const exceedsOutstanding =
    fee !== null &&
    paymentForm.amount.trim() !== "" &&
    Number.isFinite(enteredPaymentAmount) &&
    enteredPaymentAmount > fee.outstanding

  const fetchFee = useCallback(
    async (signal?: AbortSignal) => {
      const payload = await fetchApi<FeeDetailsData>(`/api/fees/${studentId}`, {
        signal,
      })

      if (payload.error !== null) {
        throw new Error(payload.error ?? "Could not load fee details")
      }

      return payload.data.fee
    },
    [studentId]
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadFee() {
      try {
        const nextFee = await fetchFee(controller.signal)
        setFee(nextFee)
        setLoadError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }

        setLoadError(
          error instanceof Error ? error.message : "Could not load fee details"
        )
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadFee()
    return () => controller.abort()
  }, [fetchFee, refreshToken])

  async function extendDueDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (dueDate === "") {
      setDueDateError("Due date is required")
      return
    }

    setIsExtending(true)
    setDueDateError(null)

    try {
      const payload = await fetchApi<FeeRecord>(`/api/fees/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      })

      if (payload.error !== null) {
        setDueDateError(
          fieldMessage(payload.error, "Could not update due date")
        )
        return
      }

      setExtendOpen(false)
      toast.success("Due date updated")
      setFee(await fetchFee())
    } catch {
      setDueDateError("Could not update due date. Please try again.")
    } finally {
      setIsExtending(false)
    }
  }

  async function recordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (fee === null) {
      return
    }

    const amount = Number(paymentForm.amount)
    const errors: typeof paymentErrors = {}

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Payment amount must be greater than 0"
    } else if (amount > fee.outstanding) {
      errors.amount = "Cannot exceed outstanding balance"
    }

    if (paymentForm.paymentDate === "") {
      errors.paymentDate = "Payment date is required"
    } else if (paymentForm.paymentDate > utcDateInputValue()) {
      errors.paymentDate = "Payment date cannot be in the future"
    }

    if (paymentForm.referenceNumber.trim() === "") {
      errors.referenceNumber = "Reference number is required"
    }

    if (Object.keys(errors).length > 0) {
      setPaymentErrors(errors)
      return
    }

    setIsRecording(true)
    setPaymentErrors({})

    try {
      const payload = await fetchApi<PaymentMutationData>("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          amount,
          paymentDate: paymentForm.paymentDate,
          referenceNumber: paymentForm.referenceNumber,
        }),
      })

      if (payload.error !== null) {
        if (payload.error.includes("exceeds outstanding")) {
          setPaymentErrors({ amount: "Cannot exceed outstanding balance" })
          return
        }

        setPaymentErrors(parsePaymentErrors(payload.error))
        return
      }

      setPaymentOpen(false)
      setPaymentForm(emptyPaymentForm())
      toast.success(`Payment of ${formatCurrency(amount)} recorded`)
      setFee(await fetchFee())
    } catch {
      setPaymentErrors({
        body: "Could not record payment. Please try again.",
      })
    } finally {
      setIsRecording(false)
    }
  }

  async function applyAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (fee === null) return

    const amount = Number(adjustmentForm.amount)

    if (
      adjustmentForm.adjustmentType !== "WAIVER" &&
      (!Number.isFinite(amount) || amount <= 0)
    ) {
      setAdjustmentError("Amount must be greater than 0")
      return
    }

    if (
      adjustmentForm.adjustmentType === "DISCOUNT" &&
      amount >= fee.totalAmount
    ) {
      setAdjustmentError("Discount must be less than the current total fee")
      return
    }

    if (adjustmentForm.reason.trim() === "") {
      setAdjustmentError("Reason is required")
      return
    }

    setIsAdjusting(true)
    setAdjustmentError(null)

    try {
      const payload = await fetchApi<FeeAdjustmentResponse>(
        `/api/fees/${studentId}/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adjustmentType: adjustmentForm.adjustmentType,
            amount: adjustmentForm.adjustmentType === "WAIVER" ? null : amount,
            reason: adjustmentForm.reason,
          }),
        }
      )

      if (payload.error !== null) {
        setAdjustmentError(fieldMessage(payload.error, "Could not adjust fee"))
        return
      }

      setAdjustmentOpen(false)
      resetAdjustmentForm()
      setFee(await fetchFee())
      toast.success("Fee adjustment applied")
    } catch {
      setAdjustmentError("Could not apply adjustment. Please try again.")
    } finally {
      setIsAdjusting(false)
    }
  }

  function resetAdjustmentForm() {
    setAdjustmentForm({
      adjustmentType: "DISCOUNT",
      amount: "",
      reason: "",
    })
    setAdjustmentError(null)
  }

  if (isLoading) {
    return <FeeSkeleton />
  }

  if (loadError !== null || fee === null) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-danger">
            {loadError ?? "Fee record not found"}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              setIsLoading(true)
              setRefreshToken((token) => token + 1)
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {fee.isWaived ? (
        <Alert className="border-purple-300 bg-purple-50 px-4 py-3 text-purple-700">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
          <AlertTitle>Fee Waived</AlertTitle>
          <AlertDescription className="text-purple-700">
            This student&apos;s outstanding fee balance has been waived.
          </AlertDescription>
        </Alert>
      ) : fee.isOverdue && Math.round(fee.outstanding * 100) !== 0 ? (
        <Alert
          variant="destructive"
          className="border-danger bg-danger-bg px-4 py-3"
        >
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>Overdue balance</AlertTitle>
          <AlertDescription>
            This student has an overdue balance. Payment is required
            immediately.
          </AlertDescription>
        </Alert>
      ) : Math.round(fee.outstanding * 100) === 0 ? (
        <Alert className="border-success bg-success-bg px-4 py-3 text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
          <AlertTitle>Fully Paid</AlertTitle>
          <AlertDescription className="text-success">
            This student has no outstanding fee balance.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Fee summary</CardTitle>
          {isStaff && !fee.isWaived && fee.outstanding > 0 && (
            <Button onClick={() => setPaymentOpen(true)}>
              <HugeiconsIcon
                icon={CreditCardAddIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryValue
              label="Total fee"
              value={formatCurrency(fee.totalAmount)}
            />
            <SummaryValue
              label="Amount paid"
              value={formatCurrency(fee.amountPaid)}
              className="text-success"
            />
            <SummaryValue
              label="Outstanding balance"
              value={formatCurrency(fee.outstanding)}
              className={fee.isOverdue ? "text-danger" : undefined}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-text-secondary">Payment progress</span>
              <span className="font-medium">{fee.percentagePaid}%</span>
            </div>
            <Progress
              value={Math.min(100, fee.percentagePaid)}
              className="h-2"
            />
          </div>

          <div className="flex flex-col justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium text-text-secondary">
                Payment due date
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatDate(fee.dueDate)}
              </p>
            </div>
            {isStaff && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDueDate(fee.dueDate.slice(0, 10))
                  setDueDateError(null)
                  setExtendOpen(true)
                }}
              >
                <HugeiconsIcon
                  icon={CalendarAdd01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Extend Due Date
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="py-5">
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        {fee.payments.length === 0 ? (
          <CardContent className="border-t py-12 text-center text-sm text-text-secondary">
            No payments recorded yet
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Reference Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Recorded At</TableHead>
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
                  <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {isStaff && (
        <Card className="py-0">
          <CardHeader className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Fee Adjustment History</CardTitle>
            {!fee.isWaived && fee.outstanding > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  resetAdjustmentForm()
                  setAdjustmentOpen(true)
                }}
              >
                Apply Adjustment
              </Button>
            )}
          </CardHeader>
          {fee.adjustments.length === 0 ? (
            <CardContent className="border-t py-12 text-center text-sm text-text-secondary">
              No adjustments recorded
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Applied By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fee.adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell>
                      <AdjustmentBadge type={adjustment.adjustmentType} />
                    </TableCell>
                    <TableCell>
                      {adjustment.amount === null
                        ? "-"
                        : formatCurrency(adjustment.amount)}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      {adjustment.reason}
                    </TableCell>
                    <TableCell>{adjustment.appliedBy.fullName}</TableCell>
                    <TableCell>
                      {formatDateTime(adjustment.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <Dialog
        open={extendOpen}
        onOpenChange={(open) => {
          if (!isExtending) {
            setExtendOpen(open)
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isExtending) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (isExtending) event.preventDefault()
          }}
        >
          <form onSubmit={extendDueDate}>
            <DialogHeader>
              <DialogTitle>Extend Due Date</DialogTitle>
              <DialogDescription>
                Set the revised payment deadline for this student.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-1.5">
              <Label htmlFor="fee-due-date">Due Date</Label>
              <Input
                id="fee-due-date"
                type="date"
                value={dueDate}
                disabled={isExtending}
                onChange={(event) => {
                  setDueDate(event.target.value)
                  setDueDateError(null)
                }}
              />
              {dueDateError !== null && (
                <p className="text-xs text-danger">{dueDateError}</p>
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isExtending}
                onClick={() => setExtendOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isExtending}>
                {isExtending ? "Saving..." : "Save Due Date"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          if (!isRecording) {
            setPaymentOpen(open)
            if (!open) {
              setPaymentForm(emptyPaymentForm())
              setPaymentErrors({})
            }
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isRecording) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (isRecording) event.preventDefault()
          }}
        >
          <form onSubmit={recordPayment}>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Add a payment transaction to this student&apos;s fee record.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="payment-amount">Amount</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0.01"
                  max={fee.outstanding}
                  step="0.01"
                  value={paymentForm.amount}
                  disabled={isRecording}
                  onChange={(event) =>
                    updatePaymentForm(
                      "amount",
                      event.target.value,
                      setPaymentForm,
                      setPaymentErrors
                    )
                  }
                />
                <p className="text-xs text-text-secondary">
                  Maximum: {formatCurrency(fee.outstanding)}
                </p>
                {exceedsOutstanding ? (
                  <p className="text-xs text-danger">
                    Cannot exceed outstanding balance
                  </p>
                ) : paymentErrors.amount !== undefined ? (
                  <p className="text-xs text-danger">{paymentErrors.amount}</p>
                ) : null}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="payment-date">Payment Date</Label>
                <Input
                  id="payment-date"
                  type="date"
                  max={utcDateInputValue()}
                  value={paymentForm.paymentDate}
                  disabled={isRecording}
                  onChange={(event) =>
                    updatePaymentForm(
                      "paymentDate",
                      event.target.value,
                      setPaymentForm,
                      setPaymentErrors
                    )
                  }
                />
                {paymentErrors.paymentDate !== undefined && (
                  <p className="text-xs text-danger">
                    {paymentErrors.paymentDate}
                  </p>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="payment-reference">Reference Number</Label>
                <Input
                  id="payment-reference"
                  value={paymentForm.referenceNumber}
                  disabled={isRecording}
                  onChange={(event) =>
                    updatePaymentForm(
                      "referenceNumber",
                      event.target.value,
                      setPaymentForm,
                      setPaymentErrors
                    )
                  }
                />
                {paymentErrors.referenceNumber !== undefined && (
                  <p className="text-xs text-danger">
                    {paymentErrors.referenceNumber}
                  </p>
                )}
              </div>
            </div>

            {paymentErrors.body !== undefined && (
              <p className="mt-4 text-sm text-danger">{paymentErrors.body}</p>
            )}

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isRecording}
                onClick={() => setPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRecording || exceedsOutstanding}
              >
                {isRecording ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={adjustmentOpen}
        onOpenChange={(open) => {
          if (!isAdjusting) {
            setAdjustmentOpen(open)
            if (!open) resetAdjustmentForm()
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={(event) => {
            if (isAdjusting) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (isAdjusting) event.preventDefault()
          }}
        >
          <form onSubmit={applyAdjustment}>
            <DialogHeader>
              <DialogTitle>Apply Adjustment</DialogTitle>
              <DialogDescription>
                Record a scholarship, waiver, or correction against this fee.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2">
                <Label>Adjustment Type</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {adjustmentTypeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        adjustmentForm.adjustmentType === option.value
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        setAdjustmentForm((current) => ({
                          ...current,
                          adjustmentType: option.value,
                          amount:
                            option.value === "WAIVER" ? "" : current.amount,
                        }))
                        setAdjustmentError(null)
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {adjustmentForm.adjustmentType !== "WAIVER" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="adjustment-amount">Amount</Label>
                  <Input
                    id="adjustment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={adjustmentForm.amount}
                    disabled={isAdjusting}
                    onChange={(event) => {
                      setAdjustmentForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                      setAdjustmentError(null)
                    }}
                  />
                  <p className="text-xs text-text-secondary">
                    {adjustmentHelperText(fee, adjustmentForm)}
                  </p>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="adjustment-reason">Reason</Label>
                <textarea
                  id="adjustment-reason"
                  rows={4}
                  maxLength={500}
                  value={adjustmentForm.reason}
                  disabled={isAdjusting}
                  className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50"
                  onChange={(event) => {
                    setAdjustmentForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                    setAdjustmentError(null)
                  }}
                />
                <div className="flex justify-end text-xs text-text-secondary">
                  {adjustmentForm.reason.length}/500
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm">
                {adjustmentPreviewText(fee, adjustmentForm)}
              </div>

              {adjustmentError !== null && (
                <p className="text-sm text-danger">{adjustmentError}</p>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={isAdjusting}
                onClick={() => setAdjustmentOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdjusting}>
                {isAdjusting ? "Applying..." : "Apply Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const adjustmentTypeOptions: Array<{ value: AdjustmentType; label: string }> = [
  { value: "DISCOUNT", label: "Scholarship / Discount" },
  { value: "WAIVER", label: "Fee Waiver" },
  { value: "CORRECTION", label: "Data Correction" },
]

function AdjustmentBadge({ type }: { type: AdjustmentType }) {
  if (type === "WAIVER") {
    return <Badge className="bg-purple-50 text-purple-700">Waiver</Badge>
  }

  if (type === "CORRECTION") {
    return <Badge className="bg-warning-bg text-warning">Correction</Badge>
  }

  return <Badge className="bg-success-bg text-success">Discount</Badge>
}

function adjustmentHelperText(fee: FeeWithPayments, form: AdjustmentForm) {
  const amount = Number(form.amount)

  if (!Number.isFinite(amount) || amount <= 0) {
    return form.adjustmentType === "DISCOUNT"
      ? `Will reduce total from ${formatCurrency(fee.totalAmount)}`
      : "Will set a new total fee amount"
  }

  if (form.adjustmentType === "DISCOUNT") {
    return `Will reduce total from ${formatCurrency(fee.totalAmount)} to ${formatCurrency(Math.max(0, fee.totalAmount - amount))}`
  }

  return `Will set new total to ${formatCurrency(amount)}`
}

function adjustmentPreviewText(fee: FeeWithPayments, form: AdjustmentForm) {
  const preview = calculateAdjustmentPreview(fee, form)

  return `New total: ${formatCurrency(preview.totalAmount)} | New outstanding: ${formatCurrency(preview.outstanding)}`
}

function calculateAdjustmentPreview(
  fee: FeeWithPayments,
  form: AdjustmentForm
) {
  if (form.adjustmentType === "WAIVER") {
    return {
      totalAmount: fee.totalAmount,
      outstanding: 0,
    }
  }

  const amount = Number(form.amount)
  const totalAmount =
    Number.isFinite(amount) && amount > 0
      ? form.adjustmentType === "DISCOUNT"
        ? Math.max(0, fee.totalAmount - amount)
        : amount
      : fee.totalAmount
  const amountPaid = Math.min(fee.amountPaid, totalAmount)

  return {
    totalAmount,
    outstanding: Math.max(0, totalAmount - amountPaid),
  }
}

function SummaryValue({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${className ?? ""}`}>
        {value}
      </p>
    </div>
  )
}

function FeeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-52 w-full" />
    </div>
  )
}

function emptyPaymentForm(): PaymentForm {
  return {
    amount: "",
    paymentDate: utcDateInputValue(),
    referenceNumber: "",
  }
}

function updatePaymentForm(
  field: keyof PaymentForm,
  value: string,
  setForm: React.Dispatch<React.SetStateAction<PaymentForm>>,
  setErrors: React.Dispatch<
    React.SetStateAction<Partial<Record<keyof PaymentForm | "body", string>>>
  >
) {
  setForm((current) => ({ ...current, [field]: value }))
  setErrors((current) => {
    const next = { ...current }
    delete next[field]
    return next
  })
}

function parsePaymentErrors(
  error: string | null
): Partial<Record<keyof PaymentForm | "body", string>> {
  if (error === null) {
    return { body: "Could not record payment" }
  }

  const errors: Partial<Record<keyof PaymentForm | "body", string>> = {}

  for (const entry of error.split(";")) {
    const separator = entry.indexOf(":")

    if (separator === -1) {
      errors.body = entry.trim()
      continue
    }

    const field = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 1).trim()

    if (
      field === "amount" ||
      field === "paymentDate" ||
      field === "referenceNumber"
    ) {
      errors[field] = message
    } else {
      errors.body = message
    }
  }

  return errors
}

function fieldMessage(error: string | null, fallback: string): string {
  if (error === null) {
    return fallback
  }

  const separator = error.indexOf(":")
  return separator === -1 ? error : error.slice(separator + 1).trim()
}

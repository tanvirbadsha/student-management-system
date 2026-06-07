import type { EnrolmentStatus } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const statusStyles: Record<EnrolmentStatus, string> = {
  ENROLLED: "bg-success-bg text-badge-enrolled",
  DEFERRED: "bg-warning-bg text-badge-deferred",
  WITHDRAWN: "bg-danger-bg text-badge-withdrawn",
  COMPLETED: "bg-info-bg text-badge-completed",
}

const statusLabels: Record<EnrolmentStatus, string> = {
  ENROLLED: "Enrolled",
  DEFERRED: "Deferred",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
}

export function StatusBadge({
  status,
  className,
}: {
  status: EnrolmentStatus
  className?: string
}) {
  return (
    <Badge className={cn(statusStyles[status], className)}>
      {statusLabels[status]}
    </Badge>
  )
}

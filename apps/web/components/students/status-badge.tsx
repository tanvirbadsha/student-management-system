import type { EnrolmentStatus } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const statusStyles: Record<EnrolmentStatus, string> = {
  ENROLLED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  DEFERRED: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  WITHDRAWN: "bg-red-500/10 text-red-700 dark:text-red-300",
  COMPLETED: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
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

import type { EnrolmentStatus } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const statusStyles: Record<EnrolmentStatus, string> = {
  ENROLLED: "bg-[#14532d] text-white",
  DEFERRED: "bg-[#7c2d12] text-white",
  WITHDRAWN: "bg-[#7f1d1d] text-white",
  COMPLETED: "bg-[#075985] text-white",
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

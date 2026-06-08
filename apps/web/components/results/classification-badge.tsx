"use client"

import { Classification } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const classificationClasses: Record<Classification, string> = {
  [Classification.FAIL]: "bg-[#7f1d1d] text-white",
  [Classification.PASS]: "bg-[#075985] text-white",
  [Classification.MERIT]: "bg-[#7c2d12] text-white",
  [Classification.DISTINCTION]: "bg-[#14532d] text-white",
}

export function ClassificationBadge({
  classification,
  className,
}: {
  classification: Classification
  className?: string
}) {
  return (
    <Badge className={cn(classificationClasses[classification], className)}>
      {titleCase(classification)}
    </Badge>
  )
}

export function titleCaseClassification(classification: Classification) {
  return titleCase(classification)
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

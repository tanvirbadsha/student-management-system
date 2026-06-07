"use client"

import { Classification } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const classificationClasses: Record<Classification, string> = {
  [Classification.FAIL]: "bg-danger-bg text-grade-fail",
  [Classification.PASS]: "bg-info-bg text-grade-pass",
  [Classification.MERIT]: "bg-warning-bg text-grade-merit",
  [Classification.DISTINCTION]: "bg-success-bg text-grade-distinction",
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

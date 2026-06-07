"use client"

import { Classification } from "@prisma/client"
import { Badge } from "@workspace/ui/components/badge"

import { cn } from "@/lib/utils"

const classificationClasses: Record<Classification, string> = {
  [Classification.FAIL]: "bg-red-500/10 text-red-700 dark:text-red-300",
  [Classification.PASS]: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  [Classification.MERIT]: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  [Classification.DISTINCTION]:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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

import { Suspense } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AssessmentsClient } from "./assessments-client"

export default function AssessmentsPage() {
  return (
    <Suspense fallback={<AssessmentsSkeleton />}>
      <AssessmentsClient />
    </Suspense>
  )
}

function AssessmentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-44" />
      </div>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-52 w-full" />
        ))}
      </div>
    </div>
  )
}

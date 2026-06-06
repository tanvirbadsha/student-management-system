import { Suspense } from "react"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { StudentsClient } from "./students-client"

export default function StudentsPage() {
  return (
    <Suspense fallback={<StudentsPageSkeleton />}>
      <StudentsClient />
    </Suspense>
  )
}

function StudentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

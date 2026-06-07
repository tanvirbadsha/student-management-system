import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

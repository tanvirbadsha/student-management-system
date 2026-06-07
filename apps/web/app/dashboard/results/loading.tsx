import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-52 w-full" />
        ))}
      </div>
    </div>
  )
}

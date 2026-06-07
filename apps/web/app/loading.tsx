import { Skeleton } from "@workspace/ui/components/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <Skeleton className="mx-auto h-10 w-72" />
      <Skeleton className="mx-auto h-5 w-96 max-w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </main>
  )
}

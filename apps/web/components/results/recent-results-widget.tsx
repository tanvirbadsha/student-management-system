"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { ClassificationBadge } from "@/components/results/classification-badge"
import type {
  ApiResponse,
  PaginatedApiResponse,
  ResultWithRelations,
  StudentWithRelations,
} from "@/lib/types"

export function RecentResultsWidget({ userId }: { userId: string }) {
  const [results, setResults] = useState<ResultWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRecentResults() {
      try {
        const studentResponse = await fetch(
          `/api/students?userId=${encodeURIComponent(userId)}&limit=1`,
          { signal: controller.signal }
        )
        const studentPayload =
          (await studentResponse.json()) as PaginatedApiResponse<
            StudentWithRelations[]
          >
        const student = studentPayload.data?.[0]

        if (
          !studentResponse.ok ||
          studentPayload.error !== null ||
          student === undefined
        ) {
          return
        }

        const resultsResponse = await fetch(
          `/api/results/student/${encodeURIComponent(student.id)}`,
          {
            headers: {
              "x-user-id": userId,
              "x-user-role": "STUDENT",
            },
            signal: controller.signal,
          }
        )
        const resultsPayload = (await resultsResponse.json()) as ApiResponse<
          ResultWithRelations[]
        >

        if (!resultsResponse.ok || resultsPayload.error !== null) return

        setResults(
          resultsPayload.data
            .filter((result) => result.isPublished === true)
            .slice(0, 3)
        )
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadRecentResults()
    return () => controller.abort()
  }, [userId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Results</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No results published yet
          </p>
        ) : (
          <div className="divide-y">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <p className="min-w-0 truncate text-sm font-medium">
                  {result.assessment.title}
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold">{result.grade}%</span>
                  <ClassificationBadge classification={result.classification} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" asChild>
          <Link href="/dashboard/results">View all results</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

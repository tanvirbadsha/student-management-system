"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error)
    }
  }, [error])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4">
      <Card className="w-full">
        <CardContent className="py-16 text-center">
          <h1 className="font-heading text-2xl font-semibold">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page could not be loaded. Try again or return home.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button variant="outline" asChild>
              <Link href="/">Go to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

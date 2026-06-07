import Link from "next/link"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4">
      <Card className="w-full">
        <CardContent className="py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="mt-2 font-heading text-2xl font-semibold">
            Page not found
          </h1>
          <Button className="mt-6" asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

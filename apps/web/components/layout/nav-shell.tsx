"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftRightIcon,
  Cancel01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type { UserListItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const staffLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/students", label: "Students" },
  { href: "/dashboard/fees", label: "Fees" },
  { href: "/dashboard/assessments", label: "Assessments" },
  { href: "/dashboard/marksheet", label: "Marksheet" },
]

const studentLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/submissions", label: "My Submissions" },
  { href: "/dashboard/results", label: "My Results" },
  { href: "/dashboard/fees", label: "My Fees" },
]

export function NavShell() {
  const pathname = usePathname()
  const router = useRouter()
  const { role, userId, setRole, setUserId } = useRole()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)

  const links =
    role === "STAFF" ? staffLinks : role === "STUDENT" ? studentLinks : []

  useEffect(() => {
    if (role === null || userId === null) {
      return
    }

    const controller = new AbortController()

    async function loadCurrentUser() {
      try {
        const payload = await fetchApi<UserListItem[]>(
          `/api/users?role=${role}`,
          {
            signal: controller.signal,
          }
        )

        if (payload.error !== null) {
          return
        }

        const currentUser = payload.data.find((user) => user.id === userId)
        setUserName(currentUser?.fullName ?? "User unavailable")
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUserName("User unavailable")
        }
      }
    }

    void loadCurrentUser()

    return () => controller.abort()
  }, [role, userId])

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)
  }

  function switchRole() {
    setRole(null)
    setUserId(null)
    router.replace("/")
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-baseline gap-1.5"
        >
          <span className="font-mono text-base font-semibold tracking-normal text-text-primary">
            SMS
          </span>
          <span className="font-heading text-base font-normal text-text-secondary">
            Registry
          </span>
        </Link>

        <nav className="hidden h-full flex-1 items-center justify-center gap-5 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "flex h-full items-center border-b-2 border-transparent px-0.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary",
                isActive(link.href) && "border-accent text-text-primary"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {role !== null && (
            <Badge
              className={cn(
                role === "STAFF"
                  ? "bg-accent text-accent-foreground"
                  : "bg-success text-accent-foreground"
              )}
            >
              {role === "STAFF" ? "Staff" : "Student"}
            </Badge>
          )}
          {userName === null && role !== null && userId !== null ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <span className="max-w-40 truncate text-sm font-medium text-text-primary">
              {userName}
            </span>
          )}
          <Button
            variant="ghost"
            className="h-8 px-3 text-[13px]"
            onClick={switchRole}
          >
            <HugeiconsIcon icon={ArrowLeftRightIcon} strokeWidth={2} />
            Switch Role
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {role !== null && (
            <Badge
              className={cn(
                role === "STAFF"
                  ? "bg-accent text-accent-foreground"
                  : "bg-success text-accent-foreground"
              )}
            >
              {role === "STAFF" ? "Staff" : "Student"}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <HugeiconsIcon
              icon={mobileMenuOpen ? Cancel01Icon : Menu01Icon}
              strokeWidth={2}
            />
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-border bg-surface px-6 py-4 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "border-l-2 border-transparent px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary",
                  isActive(link.href) && "border-accent text-text-primary"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-4">
              <div className="min-w-0">
                <p className="text-xs text-text-muted">Signed in as</p>
                {userName === null && role !== null && userId !== null ? (
                  <Skeleton className="mt-1 h-5 w-28" />
                ) : (
                  <p className="truncate text-sm font-medium text-text-primary">
                    {userName}
                  </p>
                )}
              </div>
              <Button variant="ghost" onClick={switchRole}>
                <HugeiconsIcon icon={ArrowLeftRightIcon} strokeWidth={2} />
                Switch Role
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

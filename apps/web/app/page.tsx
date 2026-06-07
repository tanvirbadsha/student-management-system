"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight01Icon,
  Loading03Icon,
  StudentIcon,
  TeacherIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import type { RoleToggleState, UserListItem } from "@/lib/types"

const roleOptions = [
  {
    role: "STAFF",
    title: "Staff",
    description: "Manage students, fees, assessments and grades",
    icon: TeacherIcon,
    accent: "bg-info-bg text-info",
  },
  {
    role: "STUDENT",
    title: "Student",
    description: "View your submissions, results and fee balance",
    icon: StudentIcon,
    accent: "bg-success-bg text-success",
  },
] satisfies Array<{
  role: RoleToggleState
  title: string
  description: string
  icon: typeof TeacherIcon
  accent: string
}>

type LoadState = "idle" | "loading" | "success" | "error"

export default function RoleSelectorPage() {
  const router = useRouter()
  const { role, userId, setRole, setUserId } = useRole()
  const [selectedRole, setSelectedRole] = useState<RoleToggleState | null>(null)
  const [selectedUserId, setSelectedUserId] = useState("")
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    if (role !== null && userId !== null) {
      router.replace("/dashboard")
    }
  }, [role, router, userId])

  async function loadUsers(nextRole: RoleToggleState) {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller

    setLoadState("loading")
    setSelectedUserId("")
    setUsers([])

    try {
      const payload = await fetchApi<UserListItem[]>(
        `/api/users?role=${nextRole}`,
        {
          signal: controller.signal,
        }
      )

      if (payload.error !== null) {
        throw new Error(payload.error ?? "Could not load users")
      }

      setUsers(payload.data)
      setLoadState("success")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }

      setLoadState("error")
    }
  }

  function openSelector(nextRole: RoleToggleState) {
    setSelectedRole(nextRole)
    void loadUsers(nextRole)
  }

  function handleDialogChange(open: boolean) {
    if (!open) {
      requestController.current?.abort()
      setSelectedRole(null)
      setSelectedUserId("")
      setUsers([])
      setLoadState("idle")
    }
  }

  function handleConfirm() {
    if (selectedRole === null || selectedUserId === "") {
      return
    }

    setRole(selectedRole)
    setUserId(selectedUserId)
    router.push("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-4xl">
        <div className="mx-auto mb-8 max-w-xl text-center">
          <p className="mb-2 text-xs font-medium tracking-[0.2em] text-text-muted uppercase">
            SMS Registry
          </p>
          <h1 className="font-heading text-3xl font-semibold text-text-primary sm:text-4xl">
            Choose how to continue
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            Select your role, then choose the account you want to use.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roleOptions.map((option) => (
            <button
              key={option.role}
              type="button"
              className="group rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => openSelector(option.role)}
            >
              <Card className="h-full min-h-56 rounded-lg border-border bg-surface p-10 shadow-sm transition-all duration-150 ease-in-out group-hover:scale-[1.01] group-hover:border-accent">
                <CardHeader className="h-full content-between gap-8 p-0">
                  <div
                    className={`flex size-14 items-center justify-center rounded-md ${option.accent}`}
                  >
                    <HugeiconsIcon
                      icon={option.icon}
                      strokeWidth={1.8}
                      className="size-8"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{option.title}</CardTitle>
                    <CardDescription className="mt-2 max-w-sm text-sm text-text-secondary">
                      {option.description}
                    </CardDescription>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium text-accent">
                    Continue as {option.title}
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="size-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </CardHeader>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={selectedRole !== null} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-[400px] rounded-lg bg-surface shadow-md">
          <DialogHeader>
            <DialogTitle>
              Select a {selectedRole === "STAFF" ? "staff" : "student"} account
            </DialogTitle>
            <DialogDescription>
              Choose the user whose view you want to open.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-20">
            {loadState === "loading" && (
              <div className="space-y-3" aria-label="Loading users">
                <div className="flex items-center gap-2 text-text-secondary">
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className="size-4 animate-spin"
                  />
                  <span>Loading users...</span>
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            )}

            {loadState === "error" && (
              <div className="rounded-lg border border-danger/30 bg-danger-bg p-3">
                <p className="text-sm text-danger">
                  Could not load users. Please try again.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => {
                    if (selectedRole !== null) {
                      void loadUsers(selectedRole)
                    }
                  }}
                >
                  Retry
                </Button>
              </div>
            )}

            {loadState === "success" && users.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-secondary">
                No users are available for this role.
              </p>
            )}

            {loadState === "success" && users.length > 0 && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9 w-full" aria-label="Select user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {user.fullName}
                        </span>
                        <span className="truncate text-text-secondary">
                          {user.email}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={selectedUserId === "" || loadState !== "success"}
              onClick={handleConfirm}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

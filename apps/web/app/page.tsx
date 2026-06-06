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
import type { ApiResponse, RoleToggleState, UserListItem } from "@/lib/types"

const roleOptions = [
  {
    role: "STAFF",
    title: "Staff",
    description: "Manage students, fees, assessments and grades",
    icon: TeacherIcon,
    accent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  {
    role: "STUDENT",
    title: "Student",
    description: "View your submissions, results and fee balance",
    icon: StudentIcon,
    accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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
      const response = await fetch(`/api/users?role=${nextRole}`, {
        signal: controller.signal,
      })
      const payload = (await response.json()) as ApiResponse<UserListItem[]>

      if (!response.ok || payload.error !== null) {
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
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12 sm:px-6">
      <div className="w-full max-w-4xl">
        <div className="mx-auto mb-8 max-w-xl text-center">
          <p className="mb-2 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            SMS Registry
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Choose how to continue
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select your role, then choose the account you want to use.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {roleOptions.map((option) => (
            <button
              key={option.role}
              type="button"
              className="group rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => openSelector(option.role)}
            >
              <Card className="h-full min-h-52 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg group-focus-visible:ring-0">
                <CardHeader className="h-full content-between gap-8 p-6">
                  <div
                    className={`flex size-12 items-center justify-center rounded-xl ${option.accent}`}
                  >
                    <HugeiconsIcon
                      icon={option.icon}
                      strokeWidth={1.8}
                      className="size-6"
                    />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{option.title}</CardTitle>
                    <CardDescription className="mt-2 max-w-sm text-sm">
                      {option.description}
                    </CardDescription>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium">
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
        <DialogContent>
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
                <div className="flex items-center gap-2 text-muted-foreground">
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
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">
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
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
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
                        <span className="truncate text-muted-foreground">
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

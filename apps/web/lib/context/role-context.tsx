"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import type { RoleToggleState } from "@/lib/types"

const ROLE_STORAGE_KEY = "sms-role"
const USER_ID_STORAGE_KEY = "sms-user-id"
const STORAGE_CHANGE_EVENT = "sms-role-context-change"

type RoleContextValue = {
  role: RoleToggleState | null
  userId: string | null
  setRole: (role: RoleToggleState | null) => void
  setUserId: (userId: string | null) => void
  isStaff: boolean
  isStudent: boolean
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

function subscribeToStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange)
  }
}

function getRoleSnapshot(): RoleToggleState | null {
  const storedRole = window.localStorage.getItem(ROLE_STORAGE_KEY)

  return storedRole === "STAFF" || storedRole === "STUDENT" ? storedRole : null
}

function getUserIdSnapshot(): string | null {
  return window.localStorage.getItem(USER_ID_STORAGE_KEY)
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore<RoleToggleState | null>(
    subscribeToStorage,
    getRoleSnapshot,
    () => null
  )
  const userId = useSyncExternalStore<string | null>(
    subscribeToStorage,
    getUserIdSnapshot,
    () => null
  )

  const setRole = useCallback((nextRole: RoleToggleState | null) => {
    if (nextRole === null) {
      window.localStorage.removeItem(ROLE_STORAGE_KEY)
    } else {
      window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole)
    }

    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT))
  }, [])

  const setUserId = useCallback((nextUserId: string | null) => {
    if (nextUserId === null) {
      window.localStorage.removeItem(USER_ID_STORAGE_KEY)
    } else {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, nextUserId)
    }

    window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT))
  }, [])

  const value = useMemo<RoleContextValue>(
    () => ({
      role,
      userId,
      setRole,
      setUserId,
      isStaff: role === "STAFF",
      isStudent: role === "STUDENT",
    }),
    [role, setRole, setUserId, userId]
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext)

  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }

  return context
}

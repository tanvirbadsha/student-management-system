"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Add01Icon,
  ArrowLeft01Icon,
  Book02Icon,
  Delete02Icon,
  Edit02Icon,
  UniversityIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { toast } from "sonner"

import { EmptyState } from "@/components/ui/empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { useRole } from "@/lib/context/role-context"
import { fetchApi } from "@/lib/api-client"
import { cn, formatCurrency } from "@/lib/utils"

type MoneyValue = number | string

type ModuleRecord = {
  id: string
  programmeId: string
  title: string
  code: string
  createdAt: string
  updatedAt: string
}

type ProgrammeRecord = {
  id: string
  name: string
  code: string
  feeAmount: MoneyValue
  durationYears: number
  createdAt: string
  updatedAt: string
  modules: ModuleRecord[]
}

type ProgrammeMutationResponse =
  | {
      data: ProgrammeRecord
      error: null
      warning?: string
    }
  | { data: null; error: string }

type ModuleWithAssessmentCount = ModuleRecord & {
  _count: {
    assessments: number
  }
}

type DeleteResponse = {
  deleted: true
}

type ProgrammeForm = {
  name: string
  code: string
  feeAmount: string
  durationYears: string
}

type ModuleForm = {
  title: string
  code: string
}

const emptyProgrammeForm: ProgrammeForm = {
  name: "",
  code: "",
  feeAmount: "",
  durationYears: "3",
}

const emptyModuleForm: ModuleForm = {
  title: "",
  code: "",
}

export default function ProgrammesPage() {
  const router = useRouter()
  const { role, isStaff, isStudent } = useRole()
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([])
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(
    null
  )
  const [showMobileDetail, setShowMobileDetail] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [selectAfterRefresh, setSelectAfterRefresh] = useState<string | null>(
    null
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [moduleOpen, setModuleOpen] = useState(false)
  const [programmeForm, setProgrammeForm] =
    useState<ProgrammeForm>(emptyProgrammeForm)
  const [programmeErrors, setProgrammeErrors] = useState<
    Partial<Record<keyof ProgrammeForm, string>>
  >({})
  const [moduleForm, setModuleForm] = useState<ModuleForm>(emptyModuleForm)
  const [moduleErrors, setModuleErrors] = useState<
    Partial<Record<keyof ModuleForm, string>>
  >({})
  const [isSubmittingProgramme, setIsSubmittingProgramme] = useState(false)
  const [isSubmittingModule, setIsSubmittingModule] = useState(false)
  const [blockedDelete, setBlockedDelete] = useState<{
    code: string
    count: number
  } | null>(null)

  const selectedProgramme = useMemo(
    () =>
      programmes.find((programme) => programme.id === selectedProgrammeId) ??
      null,
    [programmes, selectedProgrammeId]
  )

  useEffect(() => {
    if (isStudent) {
      router.replace("/dashboard")
    } else if (role === null) {
      router.replace("/")
    }
  }, [isStudent, role, router])

  useEffect(() => {
    if (!isStaff) return
    const controller = new AbortController()

    async function loadProgrammes() {
      setIsLoading(true)

      try {
        const payload = await fetchApi<ProgrammeRecord[]>("/api/programmes", {
          signal: controller.signal,
        })

        if (payload.error !== null) {
          throw new Error(payload.error ?? "Could not load programmes")
        }

        setProgrammes(payload.data)
        setLoadError(null)
        setSelectedProgrammeId((current) => {
          if (
            selectAfterRefresh !== null &&
            payload.data.some((programme) => programme.id === selectAfterRefresh)
          ) {
            return selectAfterRefresh
          }

          if (
            current !== null &&
            payload.data.some((programme) => programme.id === current)
          ) {
            return current
          }

          return null
        })
        setSelectAfterRefresh(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setLoadError("Could not load programmes. Please try again.")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadProgrammes()
    return () => controller.abort()
  }, [isStaff, refreshToken, selectAfterRefresh])

  function refreshProgrammes(selectProgrammeId?: string) {
    if (selectProgrammeId !== undefined) {
      setSelectAfterRefresh(selectProgrammeId)
      setShowMobileDetail(true)
    }

    setRefreshToken((token) => token + 1)
  }

  function selectProgramme(programmeId: string) {
    setSelectedProgrammeId(programmeId)
    setShowMobileDetail(true)
  }

  function updateProgrammeForm(field: keyof ProgrammeForm, value: string) {
    setProgrammeForm((current) => ({ ...current, [field]: value }))
    setProgrammeErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function updateModuleForm(field: keyof ModuleForm, value: string) {
    setModuleForm((current) => ({ ...current, [field]: value }))
    setModuleErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function openEditDialog() {
    if (selectedProgramme === null) return

    setProgrammeForm({
      name: selectedProgramme.name,
      code: selectedProgramme.code,
      feeAmount: String(toNumber(selectedProgramme.feeAmount)),
      durationYears: String(selectedProgramme.durationYears),
    })
    setProgrammeErrors({})
    setEditOpen(true)
  }

  async function createProgramme(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateProgrammeForm(programmeForm, true)

    if (Object.keys(validation.errors).length > 0) {
      setProgrammeErrors(validation.errors)
      return
    }

    setIsSubmittingProgramme(true)

    try {
      const payload = await fetchApi<Omit<ProgrammeRecord, "modules">>(
        "/api/programmes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: programmeForm.name.trim(),
            code: programmeForm.code.trim().toUpperCase(),
            feeAmount: validation.feeAmount,
            durationYears: validation.durationYears,
          }),
        }
      )

      if (payload.error !== null) {
        if (payload.error.includes("Programme code already exists")) {
          setProgrammeErrors({
            code: "A programme with this code already exists",
          })
          return
        }

        setProgrammeErrors(parseProgrammeErrors(payload.error))
        return
      }

      setCreateOpen(false)
      setProgrammeForm(emptyProgrammeForm)
      setProgrammeErrors({})
      refreshProgrammes(payload.data.id)
      toast.success("Programme created")
    } catch {
      toast.error("Could not create programme")
    } finally {
      setIsSubmittingProgramme(false)
    }
  }

  async function editProgramme(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedProgramme === null) return

    const validation = validateProgrammeForm(programmeForm, false)

    if (Object.keys(validation.errors).length > 0) {
      setProgrammeErrors(validation.errors)
      return
    }

    setIsSubmittingProgramme(true)

    try {
      const payload = await fetchApi<
        ProgrammeRecord,
        ProgrammeMutationResponse
      >(`/api/programmes/${selectedProgramme.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: programmeForm.name.trim(),
          feeAmount: validation.feeAmount,
          durationYears: validation.durationYears,
        }),
      })

      if (payload.error !== null) {
        setProgrammeErrors(parseProgrammeErrors(payload.error))
        return
      }

      setEditOpen(false)
      refreshProgrammes(payload.data.id)

      if (payload.warning !== undefined) {
        toast.warning(payload.warning)
      } else {
        toast.success("Programme updated")
      }
    } catch {
      toast.error("Could not update programme")
    } finally {
      setIsSubmittingProgramme(false)
    }
  }

  async function addModule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedProgramme === null) return

    const errors: Partial<Record<keyof ModuleForm, string>> = {}
    const title = moduleForm.title.trim()
    const code = moduleForm.code.trim().toUpperCase()

    if (title === "") errors.title = "Module title is required"
    if (code === "") errors.code = "Module code is required"

    if (Object.keys(errors).length > 0) {
      setModuleErrors(errors)
      return
    }

    setIsSubmittingModule(true)

    try {
      const payload = await fetchApi<ModuleRecord>("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programmeId: selectedProgramme.id,
          title,
          code,
        }),
      })

      if (payload.error !== null) {
        if (payload.error.includes("Module code already exists")) {
          setModuleErrors({ code: "This module code already exists" })
          return
        }

        setModuleErrors(parseModuleErrors(payload.error))
        return
      }

      setModuleOpen(false)
      setModuleForm(emptyModuleForm)
      setModuleErrors({})
      refreshProgrammes(selectedProgramme.id)
      toast.success("Module added")
    } catch {
      toast.error("Could not add module")
    } finally {
      setIsSubmittingModule(false)
    }
  }

  async function deleteModule(module: ModuleRecord) {
    try {
      const checkPayload = await fetchApi<ModuleWithAssessmentCount>(
        `/api/modules/${module.id}`
      )

      if (checkPayload.error !== null) {
        toast.error(checkPayload.error)
        return
      }

      if (checkPayload.data._count.assessments > 0) {
        setBlockedDelete({
          code: module.code,
          count: checkPayload.data._count.assessments,
        })
        return
      }

      if (
        !window.confirm(`Delete module ${module.code}? This cannot be undone.`)
      ) {
        return
      }

      const deletePayload = await fetchApi<DeleteResponse>(
        `/api/modules/${module.id}`,
        { method: "DELETE" }
      )

      if (deletePayload.error !== null) {
        toast.error(deletePayload.error)
        return
      }

      refreshProgrammes(selectedProgrammeId ?? undefined)
      toast.success("Module deleted")
    } catch {
      toast.error("Could not delete module")
    }
  }

  if (!isStaff || isLoading) {
    return <ProgrammesSkeleton />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programmes & Modules"
        subtitle="Manage academic programmes and their modules"
      />

      {loadError !== null ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-danger">{loadError}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => refreshProgrammes()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface md:grid md:grid-cols-5">
          <section
            className={cn(
              "min-h-[520px] border-border md:col-span-2 md:block md:border-r",
              showMobileDetail && selectedProgramme !== null && "hidden"
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="font-heading text-base font-semibold">
                  Programme List
                </h2>
                <p className="text-xs text-text-secondary">
                  {programmes.length} programme
                  {programmes.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setProgrammeForm(emptyProgrammeForm)
                  setProgrammeErrors({})
                  setCreateOpen(true)
                }}
              >
                <HugeiconsIcon
                  icon={Add01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                New Programme
              </Button>
            </div>

            {programmes.length === 0 ? (
              <div className="px-4 py-12">
                <EmptyState
                  icon={
                    <HugeiconsIcon
                      icon={UniversityIcon}
                      strokeWidth={1.8}
                      className="size-5"
                    />
                  }
                  title="No programmes yet"
                  description="Create the first programme before enrolling students."
                />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {programmes.map((programme) => (
                  <button
                    key={programme.id}
                    type="button"
                    className={cn(
                      "grid w-full gap-2 border-l-4 border-transparent px-4 py-4 text-left transition-colors hover:bg-row-hover",
                      selectedProgrammeId === programme.id &&
                        "border-l-accent bg-surface-elevated"
                    )}
                    onClick={() => selectProgramme(programme.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-text-primary">
                        {programme.name}
                      </p>
                      <Badge variant="secondary">
                        <span className="font-mono text-sm">
                          {programme.code}
                        </span>
                      </Badge>
                    </div>
                    <div className="grid gap-1 text-sm text-text-secondary sm:grid-cols-3">
                      <span>{formatMoney(programme.feeAmount)}</span>
                      <span>
                        {programme.durationYears} year
                        {programme.durationYears === 1 ? "" : "s"}
                      </span>
                      <span>
                        {programme.modules.length} module
                        {programme.modules.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section
            className={cn(
              "min-h-[520px] md:col-span-3 md:block",
              (!showMobileDetail || selectedProgramme === null) && "hidden"
            )}
          >
            {selectedProgramme === null ? (
              <div className="hidden h-full items-center justify-center p-8 text-center md:flex">
                <EmptyState
                  icon={
                    <HugeiconsIcon
                      icon={UniversityIcon}
                      strokeWidth={1.8}
                      className="size-5"
                    />
                  }
                  title="Select a programme"
                  description="Select a programme to view its modules"
                />
              </div>
            ) : (
              <ProgrammeDetail
                programme={selectedProgramme}
                onBack={() => setShowMobileDetail(false)}
                onEdit={openEditDialog}
                onAddModule={() => {
                  setModuleForm(emptyModuleForm)
                  setModuleErrors({})
                  setModuleOpen(true)
                }}
                onDeleteModule={deleteModule}
              />
            )}
          </section>
        </div>
      )}

      <ProgrammeDialog
        mode="create"
        open={createOpen}
        form={programmeForm}
        errors={programmeErrors}
        isSubmitting={isSubmittingProgramme}
        onOpenChange={(open) => {
          if (!isSubmittingProgramme) setCreateOpen(open)
        }}
        onChange={updateProgrammeForm}
        onSubmit={createProgramme}
      />

      <ProgrammeDialog
        mode="edit"
        open={editOpen}
        form={programmeForm}
        errors={programmeErrors}
        isSubmitting={isSubmittingProgramme}
        onOpenChange={(open) => {
          if (!isSubmittingProgramme) setEditOpen(open)
        }}
        onChange={updateProgrammeForm}
        onSubmit={editProgramme}
      />

      <ModuleDialog
        open={moduleOpen}
        form={moduleForm}
        errors={moduleErrors}
        isSubmitting={isSubmittingModule}
        programme={selectedProgramme}
        onOpenChange={(open) => {
          if (!isSubmittingModule) setModuleOpen(open)
        }}
        onChange={updateModuleForm}
        onSubmit={addModule}
      />

      <Dialog
        open={blockedDelete !== null}
        onOpenChange={(open) => {
          if (!open) setBlockedDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Module cannot be deleted</DialogTitle>
            <DialogDescription>
              Archive linked assessments before deleting this module.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTitle>{blockedDelete?.code}</AlertTitle>
            <AlertDescription>
              This module has {blockedDelete?.count} assessments and cannot be
              deleted. Archive the assessments first.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockedDelete(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ProgrammeDetail({
  programme,
  onBack,
  onEdit,
  onAddModule,
  onDeleteModule,
}: {
  programme: ProgrammeRecord
  onBack: () => void
  onEdit: () => void
  onAddModule: () => void
  onDeleteModule: (module: ModuleRecord) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <Button variant="ghost" className="mb-3 -ml-2 md:hidden" onClick={onBack}>
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Programmes
        </Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-xl font-semibold">
                {programme.name}
              </h2>
              <Badge variant="secondary">
                <span className="font-mono text-sm">{programme.code}</span>
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
              <span>{formatMoney(programme.feeAmount)}</span>
              <span>
                {programme.durationYears} year
                {programme.durationYears === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={onEdit}>
            <HugeiconsIcon
              icon={Edit02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Edit Programme
          </Button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-base font-semibold">Modules</h3>
            <p className="text-xs text-text-secondary">
              {programme.modules.length} module
              {programme.modules.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button size="sm" onClick={onAddModule}>
            <HugeiconsIcon
              icon={Add01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Add Module
          </Button>
        </div>

        {programme.modules.length === 0 ? (
          <EmptyState
            icon={
              <HugeiconsIcon
                icon={Book02Icon}
                strokeWidth={1.8}
                className="size-5"
              />
            }
            title="No modules yet"
            description="Add modules to make assessments available for this programme."
          />
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {programme.modules.map((module) => (
              <div
                key={module.id}
                className="flex items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{module.title}</p>
                  <p className="font-mono text-sm text-text-secondary">
                    {module.code}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-lg"
                  variant="ghost"
                  aria-label={`Delete module ${module.code}`}
                  onClick={() => onDeleteModule(module)}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgrammeDialog({
  mode,
  open,
  form,
  errors,
  isSubmitting,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  mode: "create" | "edit"
  open: boolean
  form: ProgrammeForm
  errors: Partial<Record<keyof ProgrammeForm, string>>
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof ProgrammeForm, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const isEdit = mode === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) event.preventDefault()
        }}
      >
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Programme" : "Create Programme"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update programme details for future enrolments."
                : "Add a new academic programme."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <FormField label="Programme Name" error={errors.name}>
              <Input
                value={form.name}
                disabled={isSubmitting}
                onChange={(event) => onChange("name", event.target.value)}
              />
            </FormField>

            <FormField label="Code" error={errors.code}>
              <Input
                value={form.code}
                placeholder="e.g. BSC-CS"
                readOnly={isEdit}
                disabled={isSubmitting && !isEdit}
                title={
                  isEdit
                    ? "Programme code cannot be changed after creation"
                    : undefined
                }
                className={cn(isEdit && "cursor-not-allowed bg-muted")}
                onBlur={() => onChange("code", form.code.toUpperCase())}
                onChange={(event) => onChange("code", event.target.value)}
              />
            </FormField>

            <FormField label="Fee Amount" error={errors.feeAmount}>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-text-secondary">
                  £
                </span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.feeAmount}
                  disabled={isSubmitting}
                  className="pl-7"
                  onChange={(event) =>
                    onChange("feeAmount", event.target.value)
                  }
                />
              </div>
            </FormField>

            <FormField label="Duration" error={errors.durationYears}>
              <div className="relative">
                <Input
                  type="number"
                  min="1"
                  max="6"
                  step="1"
                  value={form.durationYears}
                  disabled={isSubmitting}
                  className="pr-14"
                  onChange={(event) =>
                    onChange("durationYears", event.target.value)
                  }
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-text-secondary">
                  Years
                </span>
              </div>
            </FormField>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Create Programme"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModuleDialog({
  open,
  form,
  errors,
  isSubmitting,
  programme,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  open: boolean
  form: ModuleForm
  errors: Partial<Record<keyof ModuleForm, string>>
  isSubmitting: boolean
  programme: ProgrammeRecord | null
  onOpenChange: (open: boolean) => void
  onChange: (field: keyof ModuleForm, value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (isSubmitting) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (isSubmitting) event.preventDefault()
        }}
      >
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add Module</DialogTitle>
            <DialogDescription>
              {programme === null
                ? "Add a module."
                : `Add a module to ${programme.code}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <FormField label="Module Title" error={errors.title}>
              <Input
                value={form.title}
                disabled={isSubmitting}
                onChange={(event) => onChange("title", event.target.value)}
              />
            </FormField>
            <FormField label="Module Code" error={errors.code}>
              <Input
                value={form.code}
                placeholder="e.g. CS301"
                disabled={isSubmitting}
                onBlur={() => onChange("code", form.code.toUpperCase())}
                onChange={(event) => onChange("code", event.target.value)}
              />
            </FormField>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error !== undefined && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

function ProgrammesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-0 overflow-hidden rounded-md border border-border bg-surface md:grid-cols-5">
        <div className="space-y-3 border-border p-4 md:col-span-2 md:border-r">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <div className="space-y-4 p-4 md:col-span-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}

function validateProgrammeForm(form: ProgrammeForm, requireCode: boolean) {
  const errors: Partial<Record<keyof ProgrammeForm, string>> = {}
  const feeAmount = Number(form.feeAmount)
  const durationYears = Number(form.durationYears)

  if (form.name.trim() === "") {
    errors.name = "Programme name is required"
  }

  if (requireCode && form.code.trim() === "") {
    errors.code = "Code is required"
  }

  if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
    errors.feeAmount = "Fee amount must be greater than 0"
  }

  if (
    !Number.isInteger(durationYears) ||
    durationYears < 1 ||
    durationYears > 6
  ) {
    errors.durationYears = "Duration must be between 1 and 6 years"
  }

  return { errors, feeAmount, durationYears }
}

function parseProgrammeErrors(
  error: string | null
): Partial<Record<keyof ProgrammeForm, string>> {
  if (error === null) return {}
  const result: Partial<Record<keyof ProgrammeForm, string>> = {}

  for (const entry of error.split(";")) {
    const separator = entry.indexOf(":")
    if (separator === -1) continue
    const field = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 1).trim()

    if (
      field === "name" ||
      field === "code" ||
      field === "feeAmount" ||
      field === "durationYears"
    ) {
      result[field] = message
    }
  }

  return result
}

function parseModuleErrors(
  error: string | null
): Partial<Record<keyof ModuleForm, string>> {
  if (error === null) return {}
  const result: Partial<Record<keyof ModuleForm, string>> = {}

  for (const entry of error.split(";")) {
    const separator = entry.indexOf(":")
    if (separator === -1) continue
    const field = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 1).trim()

    if (field === "title" || field === "code") {
      result[field] = message
    }
  }

  return result
}

function formatMoney(value: MoneyValue): string {
  return formatCurrency(toNumber(value))
}

function toNumber(value: MoneyValue): number {
  return typeof value === "number" ? value : Number(value)
}

import type { ReactNode } from "react"

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-border bg-surface px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-surface-elevated text-text-secondary">
        {icon}
      </div>
      <h2 className="mt-4 font-heading text-base font-semibold text-text-primary">
        {title}
      </h2>
      {description !== undefined && description.length > 0 && (
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          {description}
        </p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  )
}

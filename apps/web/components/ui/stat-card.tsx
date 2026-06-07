import { cn } from "@/lib/utils"

const variantClass = {
  default: "",
  danger: "border-l-[3px] border-l-danger",
  warning: "border-l-[3px] border-l-warning",
  success: "border-l-[3px] border-l-success",
} as const

export function StatCard({
  label,
  value,
  subtext,
  variant = "default",
}: {
  label: string
  value: string | number
  subtext?: string
  variant?: keyof typeof variantClass
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface p-5 shadow-sm",
        variantClass[variant]
      )}
    >
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">
        {label}
      </p>
      <p className="mt-2 font-heading text-[28px] leading-none font-semibold text-text-primary">
        {value}
      </p>
      {subtext !== undefined && subtext.length > 0 && (
        <p className="mt-1 text-[13px] text-text-secondary">{subtext}</p>
      )}
    </div>
  )
}

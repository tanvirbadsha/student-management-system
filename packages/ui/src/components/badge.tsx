import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded border border-transparent px-2 py-0.5 text-xs font-medium tracking-[0.04em] whitespace-nowrap uppercase transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-danger aria-invalid:outline-danger [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground [a]:hover:bg-accent-hover",
        secondary:
          "bg-surface-elevated text-text-primary [a]:hover:bg-row-hover",
        destructive:
          "bg-danger-bg text-danger focus-visible:outline-danger [a]:hover:bg-danger-bg",
        outline:
          "border-border bg-transparent text-text-secondary [a]:hover:bg-surface-elevated [a]:hover:text-text-primary",
        ghost:
          "hover:bg-surface-elevated hover:text-text-primary",
        link: "text-accent underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

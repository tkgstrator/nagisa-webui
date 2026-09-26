import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/app/lib/utils"
import { type Tone, toneClassName } from "./tone"

/**
 * `docs/mock-diff/src/comp/status-badge-astra.css` の `.a-status`。
 * 既定 (soft) は `--tone-soft` / `--tone-ink`、`solid` は `--tone-bg` / `--tone-fg`、
 * `outline` は透明地に `--tone-border` の枠だけを乗せる。
 */
const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-[5px] rounded-full border border-transparent bg-(--tone-soft) font-semibold whitespace-nowrap text-(--tone-ink) [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        soft: "",
        solid: "border-transparent bg-(--tone-bg) text-(--tone-fg)",
        outline: "border-(--tone-border) bg-transparent text-(--tone-ink)",
      },
      size: {
        default: "h-6 px-[9px] text-xs",
        sm: "h-5 px-[7px] text-[11px]",
        lg: "h-7 px-[11px] text-[13px]",
      },
    },
    defaultVariants: {
      variant: "soft",
      size: "default",
    },
  }
)

function StatusBadge({
  className,
  tone = "muted",
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants> & { tone?: Tone }) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ variant, size }), toneClassName[tone], className)}
      {...props}
    />
  )
}

export { StatusBadge, statusBadgeVariants }

import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/app/lib/utils"
import { type Tone, toneClassName } from "./tone"

/**
 * `docs/mock-diff/src/comp/status-dot-astra.css` の `.a-dot`。
 * 色は `tone` の `--tone-dot` 任せ、`pulse` で `astraAtomPulse` を付与する。
 */
const statusDotVariants = cva("inline-block shrink-0 rounded-full bg-(--tone-dot)", {
  variants: {
    size: {
      default: "size-[7px]",
      sm: "size-[5px]",
      lg: "size-2.5",
    },
    pulse: {
      true: "animate-astra-pulse motion-reduce:animate-none",
      false: "",
    },
  },
  defaultVariants: {
    size: "default",
    pulse: false,
  },
})

function StatusDot({
  className,
  tone = "muted",
  size,
  pulse,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusDotVariants> & { tone?: Tone }) {
  return (
    <span
      data-slot="status-dot"
      className={cn(statusDotVariants({ size, pulse }), toneClassName[tone], className)}
      {...props}
    />
  )
}

export { StatusDot, statusDotVariants }

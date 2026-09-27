import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/app/lib/utils"

/**
 * `docs/mock-diff/src/comp/kbd-astra.css` の `.a-key`。
 * 操作部品ではないため focus / disabled は持たず、サイズと `active` (押下中の説明用) のみを扱う。
 */
const kbdVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded border border-b-2 border-border bg-muted px-1.5 font-mono text-muted-foreground [&_svg]:size-4",
  {
    variants: {
      size: {
        default: "h-6 min-w-6 text-xs",
        sm: "h-5 min-w-5 text-[10px]",
        lg: "h-7 min-w-7 text-sm",
      },
      active: {
        true: "border-primary bg-accent text-accent-foreground",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      active: false,
    },
  }
)

function Kbd({
  className,
  size,
  active,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(kbdVariants({ size, active }), className)}
      {...props}
    />
  )
}

export { Kbd, kbdVariants }

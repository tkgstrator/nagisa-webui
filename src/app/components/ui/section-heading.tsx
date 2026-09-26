import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/app/lib/utils"

/**
 * `docs/mock-diff/src/comp/section-heading-astra.css` の `.a-heading`。
 * 子要素の `h2`/`h3`・`p`・`a` は要素セレクタでスタイルするので、呼び出し側は
 * 見出し・補助文・右側アクション (リンク or `SectionHeadingCount` など) をそのまま入れ子にすればよい。
 */
const sectionHeadingVariants = cva(
  "flex w-full flex-wrap items-center justify-between gap-2.5 rounded-r-md border-l-[3px] border-l-primary py-1 pr-2 pl-3.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_:is(h2,h3)]:font-bold [&_:is(h2,h3)]:text-[18px] [&_a]:inline-flex [&_a]:items-center [&_a]:gap-[3px] [&_a]:text-xs [&_a]:text-primary [&_a]:aria-disabled:cursor-not-allowed [&_a]:aria-disabled:text-muted-foreground [&_a]:aria-disabled:opacity-45 [&_a:hover]:bg-muted [&_a:hover]:text-foreground [&_p]:text-xs [&_p]:text-muted-foreground [&_svg]:size-4",
  {
    variants: {
      compact: {
        true: "[&_:is(h2,h3)]:text-[16px]",
        false: "",
      },
      appearance: {
        accented: "",
        plain: "rounded-none border-l-0 py-0 pr-0 pl-0 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      compact: false,
      appearance: "accented",
    },
  }
)

function SectionHeading({
  className,
  compact,
  appearance,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof sectionHeadingVariants>) {
  return (
    <div
      data-slot="section-heading"
      className={cn(sectionHeadingVariants({ compact, appearance }), className)}
      {...props}
    />
  )
}

function SectionHeadingCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="section-heading-count"
      className={cn("text-xs text-muted-foreground tabular-nums", className)}
      {...props}
    />
  )
}

export { SectionHeading, SectionHeadingCount, sectionHeadingVariants }

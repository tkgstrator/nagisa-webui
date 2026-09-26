import { Button as ButtonPrimitive } from "@base-ui/react/button"

import { cn } from "@/app/lib/utils"
import { type Tone, toneClassName } from "./tone"

/**
 * `docs/mock-diff/src/comp/chip-astra.css` の `.a-chip`。
 * `aria-pressed` で選択状態を表し、色は `tone` の CSS 変数 (`--tone-soft` / `--tone-ink` / `--tone-border`) 任せにする。
 */
function Chip({ className, tone = "muted", ...props }: ButtonPrimitive.Props & { tone?: Tone }) {
  return (
    <ButtonPrimitive
      data-slot="chip"
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-xs whitespace-nowrap text-muted-foreground outline-none transition-colors select-none hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 aria-pressed:border-(--tone-border) aria-pressed:bg-(--tone-soft) aria-pressed:font-semibold aria-pressed:text-(--tone-ink) [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  )
}

export { Chip }

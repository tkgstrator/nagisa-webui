"use client"

import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"

import { cn } from "@/app/lib/utils"

/** `docs/mock-diff/src/comp/toggle-astra.css` の `.a-segments`。 */
function ToggleGroup<Value extends string>({
  className,
  ...props
}: ToggleGroupPrimitive.Props<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("inline-flex gap-[3px] rounded-full bg-muted p-[3px]", className)}
      {...props}
    />
  )
}

function ToggleGroupItem<Value extends string>({
  className,
  ...props
}: Toggle.Props<Value>) {
  return (
    <Toggle
      data-slot="toggle-group-item"
      className={cn(
        "h-[26px] rounded-full bg-transparent px-3 text-[12.5px] text-muted-foreground outline-none transition-none hover:text-foreground active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-bold disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }

"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/app/lib/utils"

/** `docs/mock-diff/src/comp/toggle-astra.css` の `.a-switch`。 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative h-[23px] w-10 shrink-0 rounded-full bg-input p-0 outline-none transition-none hover:outline-2 hover:outline-offset-2 hover:outline-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-checked:bg-primary data-disabled:pointer-events-none data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-[19px] translate-x-0.5 rounded-full bg-background transition-transform data-checked:translate-x-[17px] data-checked:bg-primary-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

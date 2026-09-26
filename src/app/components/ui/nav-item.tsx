import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/app/lib/utils"

const navItemVariants = cva(
  "flex items-center gap-2.5 rounded-r-lg border-l-[3px] border-l-transparent px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&.active]:border-l-primary [&.active]:bg-accent [&.active]:font-semibold [&.active]:text-accent-foreground aria-[current=page]:border-l-primary aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground max-sm:w-[42px] max-sm:rounded-lg max-sm:border-l-0 max-sm:p-[7px]",
  {
    variants: {
      active: {
        true: "border-l-primary bg-accent font-semibold text-accent-foreground",
        false: "",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
)

function NavItem({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof navItemVariants>) {
  return (
    <button
      data-slot="nav-item"
      className={cn(navItemVariants({ active }), className)}
      {...props}
    />
  )
}

function NavItemText({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="nav-item-text" className={cn("nav-item-text", className)} {...props} />
}

function NavItemCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="nav-item-count"
      className={cn(
        "nav-item-count ml-auto rounded-full bg-secondary px-1.5 py-px text-[10px] text-secondary-foreground",
        className
      )}
      {...props}
    />
  )
}

const navLinkVariants = cva(
  "flex items-center gap-3 rounded-r-[10px] border-l-[3px] border-l-primary px-4 py-3.5 outline-none transition-[background,transform] duration-[180ms] ease-in-out hover:translate-x-[3px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-primary",
  {
    variants: {
      tone: {
        primary: "",
        destructive: "border-l-destructive [&_svg]:text-destructive",
      },
    },
    defaultVariants: {
      tone: "primary",
    },
  }
)

function NavLink({
  className,
  tone,
  ...props
}: React.ComponentProps<"a"> & VariantProps<typeof navLinkVariants>) {
  return <a data-slot="nav-link" className={cn(navLinkVariants({ tone }), className)} {...props} />
}

function NavLinkTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="nav-link-title" className={cn("text-[13px] font-bold", className)} {...props} />
}

function NavLinkSubtitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="nav-link-subtitle" className={cn("mt-0.5 text-[11.5px] text-muted-foreground", className)} {...props} />
}

export {
  NavItem,
  NavItemCount,
  NavItemText,
  NavLink,
  NavLinkSubtitle,
  NavLinkTitle,
  navItemVariants,
  navLinkVariants,
}

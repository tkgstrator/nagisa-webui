import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/app/lib/utils"

/**
 * Input と SelectTrigger が共有する見た目 (モック .a-field / .a-select)。
 * size は 2 種類だけ: default = 36px・角 8px・14px (フォーム用) / sm = 34px・pill・12.5px (ツールバー用)。
 */
export const fieldVariants = cva(
  "w-full min-w-0 border border-input bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-45 aria-invalid:border-destructive",
  {
    variants: {
      size: {
        default: "h-9 rounded-[8px] px-2.5 text-sm",
        sm: "h-[34px] rounded-full px-3 text-[12.5px]",
      },
    },
    defaultVariants: { size: "default" },
  }
)

/** 検索アイコン (絶対配置) の分だけ左 padding を空ける。各所でコピーしない。 */
const searchPadding = { default: "pl-9", sm: "pl-8" } as const

type InputProps = Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof fieldVariants> & {
    /** 左に検索アイコンを置く画面向け。padding-left だけ共通化し、アイコン自体は呼び出し側で absolute 配置する。 */
    search?: boolean
  }

function Input({ className, type, size, search = false, ...props }: InputProps) {
  const resolved = size ?? "default"
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={resolved}
      className={cn(
        fieldVariants({ size: resolved }),
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        search && searchPadding[resolved],
        className
      )}
      {...props}
    />
  )
}

export { Input }

import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/**
 * 決定稿の `.pg`。全ページの横幅と余白をここ一箇所で決める。
 * 幅の上限は持たず、サイドバーを除いた残りを全部使う。
 * 下余白の 90px は本来の 46px + 固定フッター (`<AppFooter />`) の高さ 44px。
 * 縦のリズム (gap) だけはページごとに違うので `className` で足す。
 * `narrow` は決定稿の `.pg-narrow` (管理系の読み物ページ) で、1060px で中央に寄せる。
 */
export const PageContainer = ({
  className,
  narrow,
  children
}: {
  className?: string
  narrow?: boolean
  children: ReactNode
}) => {
  return (
    <div
      className={cn(
        'flex w-full flex-1 flex-col px-9 pt-[26px] pb-[90px] max-sm:px-4 max-sm:pt-[18px] max-sm:pb-[76px]',
        narrow && 'mx-auto max-w-[1060px]',
        className
      )}
    >
      {children}
    </div>
  )
}

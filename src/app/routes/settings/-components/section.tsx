import type { ReactNode } from 'react'
import { PageSection } from '@/app/components/page-section'
import { ChevronRightIcon } from './icons'

/** 設定ページのセクション。見出しと余白は共有の PageSection に揃える。 */
export const PgSec = PageSection

/** 見出し右の「◯◯を開く ›」。Link を子に取ってスタイルだけを与える。 */
export const secMoreClass =
  'inline-flex items-center gap-[3px] text-xs text-muted-foreground transition-colors hover:text-foreground'

export const SecMoreLabel = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <ChevronRightIcon />
  </>
)

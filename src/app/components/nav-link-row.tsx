import { Link, type LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils'

/**
 * 決定稿の `.a-nav-link`。左の 3px バーとアイコンで行き先を示す 1 行リンク。
 * `warn` は要対応の行 (未識別タイトルなど) を destructive 色にする。
 */
export const NavLinkRow = ({
  to,
  icon: Icon,
  title,
  sub,
  warn = false
}: {
  to: LinkProps['to']
  icon: LucideIcon
  title: string
  sub: string
  warn?: boolean
}) => (
  <Link
    to={to}
    className={cn(
      'flex items-center gap-3 rounded-r-[10px] border-l-[3px] px-4 py-3.5 transition-[background-color,transform] hover:translate-x-[3px] hover:bg-muted',
      warn ? 'border-destructive' : 'border-primary'
    )}
  >
    <Icon className={cn('size-5 flex-none', warn ? 'text-destructive' : 'text-primary')} strokeWidth={2} />
    <div className='min-w-0'>
      <p className='text-[13px] font-bold'>{title}</p>
      <p className='mt-0.5 text-[11.5px] text-muted-foreground'>{sub}</p>
    </div>
  </Link>
)

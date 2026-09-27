import { Link, type LinkProps } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { NavLinkSubtitle, NavLinkTitle, navLinkVariants } from '@/app/components/ui/nav-item'

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
  <Link to={to} className={navLinkVariants({ tone: warn ? 'destructive' : 'primary' })}>
    <Icon strokeWidth={2} />
    <div className='min-w-0'>
      <NavLinkTitle>{title}</NavLinkTitle>
      <NavLinkSubtitle className='block'>{sub}</NavLinkSubtitle>
    </div>
  </Link>
)

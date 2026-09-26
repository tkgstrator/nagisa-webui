import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIntlayer } from 'react-intlayer'
import { GlobalSearchHotkey } from '@/app/components/global-search-bar'
import { NavItemCount, navItemVariants } from '@/app/components/ui/nav-item'
import { StatusDot } from '@/app/components/ui/status-dot'
import { recorderStatusAtom } from '@/app/lib/atoms'
import { scheduledCountQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'

const SIDEBAR_SLOT_ID = 'app-sidebar-slot'

/**
 * サイドバーのナビとステータス行の間にページ固有の内容を差し込むためのポータル。
 * ページ側は `<SidebarSlot>` で囲むだけでよい。
 */
export const SidebarSlot = ({ children }: { children: ReactNode }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById(SIDEBAR_SLOT_ID))
  }, [])

  if (slot === null) return null
  return createPortal(children, slot)
}

const iconClass = 'block size-4 shrink-0 max-sm:size-[18px]'

const HomeIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className={iconClass} aria-hidden='true'>
    <path d='M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' />
  </svg>
)

const BrowseIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className={iconClass} aria-hidden='true'>
    <rect x='3' y='3' width='7' height='7' rx='1' />
    <rect x='14' y='3' width='7' height='7' rx='1' />
    <rect x='3' y='14' width='7' height='7' rx='1' />
    <rect x='14' y='14' width='7' height='7' rx='1' />
  </svg>
)

const RecordingsIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className={iconClass} aria-hidden='true'>
    <circle cx='12' cy='12' r='9' />
    <circle cx='12' cy='12' r='3' fill='currentColor' stroke='none' />
  </svg>
)

const SettingsIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className={iconClass} aria-hidden='true'>
    <circle cx='12' cy='12' r='3' />
    <path d='M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' />
  </svg>
)

const navLinkClass = navItemVariants()

/** 録画予約件数。0 件のときは何も描画しない。 */
const RecordingsCount = () => {
  const { data: count } = useQuery(scheduledCountQueryOptions())
  if (!count || count <= 0) return null
  return <NavItemCount className='tabular-nums max-sm:hidden'>{count}</NavItemCount>
}

const footLinkClass =
  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:bg-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent-foreground'

const footIconClass = 'block size-[13px] shrink-0'

const LogsIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={footIconClass}
    aria-hidden='true'
  >
    <path d='M4 6h16M4 12h16M4 18h10' />
  </svg>
)

const AdminIcon = () => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={footIconClass}
    aria-hidden='true'
  >
    <path d='M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' />
  </svg>
)

/** サイドバー最下段。疎通表示 (ステータス画面へのリンク)・ログ・管理の順に並べる。 */
const SidebarFoot = ({ pathname }: { pathname: string }) => {
  const content = useIntlayer('app-sidebar')
  const { data: status, isPending, isError } = useAtomValue(recorderStatusAtom)
  const isDown = isError || !status

  const dotTone = isPending ? 'warning' : isDown ? 'destructive' : 'success'
  const label = isPending
    ? content.status.connecting.value
    : isDown
      ? content.status.down.value
      : content.status.up.value

  const statusActive = pathname.startsWith('/admin/status')
  const logsActive = pathname.startsWith('/admin/logs')
  const adminActive = pathname.startsWith('/admin') && !statusActive && !logsActive

  return (
    <div className='mt-auto flex flex-col gap-0.5 max-sm:hidden'>
      <Link
        to='/admin/status'
        className={cn(footLinkClass, isDown && !isPending ? 'text-destructive' : 'text-muted-foreground')}
        aria-current={statusActive ? 'page' : undefined}
      >
        <StatusDot aria-hidden='true' tone={dotTone} pulse={!isDown || isPending} />
        {label}
      </Link>
      <Link
        to='/admin/logs'
        className={cn(footLinkClass, 'text-muted-foreground')}
        aria-current={logsActive ? 'page' : undefined}
      >
        <LogsIcon />
        {content.foot.logs}
      </Link>
      <Link
        to='/admin'
        className={cn(footLinkClass, 'text-muted-foreground')}
        aria-current={adminActive ? 'page' : undefined}
      >
        <AdminIcon />
        {content.foot.admin}
      </Link>
    </div>
  )
}

export const AppSidebar = () => {
  const content = useIntlayer('app-sidebar')
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  /** 作品詳細はアニメ一覧配下として扱う。パンくずの「アニメ一覧 / 作品名」と揃える。 */
  const browseActive = pathname.startsWith('/anime/')

  return (
    <aside className='sticky top-0 z-20 flex h-screen w-[236px] shrink-0 flex-col gap-4 self-start overflow-y-auto border-r border-border bg-sidebar px-3.5 pt-[18px] pb-4 max-sm:h-auto max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:gap-2.5 max-sm:overflow-visible max-sm:border-r-0 max-sm:border-b max-sm:px-3.5 max-sm:py-2.5'>
      <div className='flex items-center gap-2 px-1.5 pt-0.5 pb-1 max-sm:p-0'>
        <Link
          to='/'
          className='flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em] max-sm:text-sm'
          activeOptions={{ exact: true }}
        >
          <span className='grid size-6 shrink-0 place-items-center rounded-[7px] bg-primary text-primary-foreground'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='block size-[13px]'
              aria-hidden='true'
            >
              <path d='M5 12h14M12 5l7 7-7 7' />
            </svg>
          </span>
          Nagisa
        </Link>
      </div>

      <nav className='flex flex-col gap-0.5 max-sm:ml-auto max-sm:flex-row' aria-label={content.navAriaLabel.value}>
        <Link to='/' className={navLinkClass} activeOptions={{ exact: true }}>
          <HomeIcon />
          <span className='max-sm:sr-only'>{content.nav.home}</span>
        </Link>
        <Link
          to='/browse'
          className={cn(navLinkClass, browseActive && 'active')}
          aria-current={browseActive ? 'page' : undefined}
        >
          <BrowseIcon />
          <span className='max-sm:sr-only'>{content.nav.browse}</span>
        </Link>
        <Link to='/recordings' className={navLinkClass}>
          <RecordingsIcon />
          <span className='max-sm:sr-only'>{content.nav.recordings}</span>
          <RecordingsCount />
        </Link>
        <Link to='/settings' className={navLinkClass}>
          <SettingsIcon />
          <span className='max-sm:sr-only'>{content.nav.settings}</span>
        </Link>
      </nav>

      <GlobalSearchHotkey />

      <div id={SIDEBAR_SLOT_ID} className='contents' />

      <SidebarFoot pathname={pathname} />
    </aside>
  )
}

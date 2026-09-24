import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIntlayer } from 'react-intlayer'
import { GlobalSearchHotkey } from '@/app/components/global-search-bar'
import { ServerStatusDialog } from '@/app/components/server-status-dialog'
import { recorderStatusAtom } from '@/app/lib/atoms'
import { scheduledCountQueryOptions } from '@/app/lib/query-options'

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

const navLinkClass =
  'flex items-center gap-2.5 rounded-r-lg border-l-[3px] border-l-transparent px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:border-l-primary [&.active]:bg-accent [&.active]:font-semibold [&.active]:text-accent-foreground max-sm:w-[42px] max-sm:rounded-lg max-sm:border-l-0 max-sm:p-[7px]'

/** 録画予約件数。0 件のときは何も描画しない。 */
const RecordingsCount = () => {
  const { data: count } = useQuery(scheduledCountQueryOptions())
  if (!count || count <= 0) return null
  return (
    <span className='ml-auto rounded-full bg-secondary px-1.5 py-px text-[10px] tabular-nums text-secondary-foreground max-sm:hidden'>
      {count}
    </span>
  )
}

/** サイドバー最下段の疎通表示。行そのものが詳細ダイアログのトリガーを兼ねる。 */
const ServerStatusLine = () => {
  const content = useIntlayer('app-sidebar')
  const { data: status, isPending, isError } = useAtomValue(recorderStatusAtom)
  const isDown = isError || !status

  const dotClass = isPending ? 'animate-pulse bg-warning' : isDown ? 'bg-destructive' : 'animate-pulse bg-success'
  const label = isPending
    ? content.status.connecting.value
    : isDown
      ? content.status.down.value
      : content.status.up.value

  return (
    <ServerStatusDialog
      trigger={
        <button
          type='button'
          className={`mt-auto flex items-center gap-1.5 rounded-md px-2.5 text-left text-[11px] transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-sm:hidden ${isDown ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          <span aria-hidden='true' className={`size-[7px] shrink-0 rounded-full ${dotClass}`} />
          {label}
        </button>
      }
    />
  )
}

export const AppSidebar = () => {
  const content = useIntlayer('app-sidebar')
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  /** 作品詳細はアニメ一覧配下として扱う。パンくずの「アニメ一覧 / 作品名」と揃える。 */
  const browseActive = pathname.startsWith('/anime/')

  return (
    <aside className='flex w-[236px] shrink-0 flex-col gap-4 border-r border-border bg-sidebar px-3.5 pt-[18px] pb-4 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:gap-2.5 max-sm:border-r-0 max-sm:border-b max-sm:px-3.5 max-sm:py-2.5'>
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
          className={browseActive ? `${navLinkClass} active` : navLinkClass}
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

      <ServerStatusLine />
    </aside>
  )
}

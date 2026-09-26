import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { CircleDot, Grid2X2, House, List, Settings, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIntlayer } from 'react-intlayer'
import { GlobalSearchHotkey } from '@/app/components/global-search-bar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from '@/app/components/ui/sidebar'
import { StatusDot } from '@/app/components/ui/status-dot'
import { recorderStatusAtom } from '@/app/lib/atoms'
import { scheduledCountQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'

const SIDEBAR_SLOT_ID = 'app-sidebar-slot'

/** ページごとのフィルタや放送予定を、共通のナビの下へ差し込む。 */
export const SidebarSlot = ({ children }: { children: ReactNode }) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById(SIDEBAR_SLOT_ID))
  }, [])

  if (slot === null) return null
  return createPortal(children, slot)
}

const logo = (
  <span className='grid size-6 shrink-0 place-items-center rounded-[7px] bg-primary text-primary-foreground'>
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='size-[13px]'
      aria-hidden='true'
    >
      <path d='M5 12h14M12 5l7 7-7 7' />
    </svg>
  </span>
)

const navItems = [
  { to: '/' as const, key: 'home' as const, icon: House },
  { to: '/browse' as const, key: 'browse' as const, icon: Grid2X2 },
  { to: '/recordings' as const, key: 'recordings' as const, icon: CircleDot },
  { to: '/settings' as const, key: 'settings' as const, icon: Settings }
]

const useNavigationState = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const active = (to: string) => {
    if (to === '/') return pathname === '/'
    if (to === '/browse') return pathname.startsWith('/browse') || pathname.startsWith('/anime/')
    return pathname === to || pathname.startsWith(`${to}/`)
  }
  return { pathname, active }
}

const RecordingsCount = () => {
  const { data: count } = useQuery(scheduledCountQueryOptions())
  if (!count || count <= 0) return null
  return (
    <SidebarMenuBadge className='rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground'>
      {count}
    </SidebarMenuBadge>
  )
}

const SidebarNavigation = () => {
  const content = useIntlayer('app-sidebar')
  const { active } = useNavigationState()

  return (
    <nav aria-label={content.navAriaLabel.value}>
      <SidebarMenu className='gap-0.5'>
        {navItems.map(({ to, key, icon: Icon }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              render={<Link to={to} activeOptions={{ exact: to === '/' }} />}
              isActive={active(to)}
              aria-current={active(to) ? 'page' : undefined}
              tooltip={content.nav[key].value}
              className='h-9 gap-2.5 rounded-r-lg rounded-l-none border-l-[3px] border-l-transparent px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground data-active:border-l-primary data-active:bg-accent data-active:font-semibold data-active:text-accent-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-l-0 group-data-[collapsible=icon]:p-2!'
            >
              <Icon className='size-4' aria-hidden='true' />
              <span className='group-data-[collapsible=icon]:sr-only'>{content.nav[key]}</span>
            </SidebarMenuButton>
            {key === 'recordings' && <RecordingsCount />}
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  )
}

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
  const links = [
    {
      to: '/admin/status' as const,
      label,
      icon: <StatusDot aria-hidden='true' tone={dotTone} pulse={!isDown || isPending} />
    },
    {
      to: '/admin/logs' as const,
      label: content.foot.logs.value,
      icon: <List className='size-[13px]' aria-hidden='true' />
    },
    {
      to: '/admin' as const,
      label: content.foot.admin.value,
      icon: <Wrench className='size-[13px]' aria-hidden='true' />
    }
  ]
  const current = pathname.startsWith('/admin/status')
    ? '/admin/status'
    : pathname.startsWith('/admin/logs')
      ? '/admin/logs'
      : pathname.startsWith('/admin')
        ? '/admin'
        : null

  return (
    <SidebarFooter className='gap-0.5 px-0 py-0'>
      <SidebarMenu className='gap-0.5'>
        {links.map(({ to, label: text, icon }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton
              render={<Link to={to} />}
              isActive={current === to}
              aria-current={current === to ? 'page' : undefined}
              tooltip={text}
              className={cn(
                'h-8 gap-1.5 px-2.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground data-active:bg-accent data-active:font-semibold data-active:text-accent-foreground group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:p-2!',
                to === '/admin/status' && isDown && !isPending && 'text-destructive'
              )}
            >
              {icon}
              <span className='group-data-[collapsible=icon]:sr-only'>{text}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarFooter>
  )
}

const DesktopSidebar = () => {
  const content = useIntlayer('app-sidebar')
  const { pathname } = useNavigationState()
  const { open } = useSidebar()

  return (
    <Sidebar collapsible='icon' className='border-border'>
      <SidebarHeader className='px-3.5 pt-[18px] pb-3 group-data-[collapsible=icon]:px-2'>
        <div className='flex items-center gap-1'>
          <Link
            to='/'
            aria-label='Nagisa'
            className='flex min-w-0 flex-1 items-center gap-2 px-1.5 text-[15px] font-bold tracking-[-0.01em] group-data-[collapsible=icon]:hidden'
          >
            {logo}
            <span className='group-data-[collapsible=icon]:sr-only'>Nagisa</span>
          </Link>
          <SidebarTrigger
            aria-label={open ? content.collapseLabel.value : content.expandLabel.value}
            title={open ? content.collapseLabel.value : content.expandLabel.value}
            className='shrink-0 text-muted-foreground group-data-[collapsible=icon]:mx-auto'
          />
        </div>
      </SidebarHeader>
      <SidebarContent className='gap-4 px-3.5 group-data-[collapsible=icon]:px-1'>
        <SidebarNavigation />
        <div id={SIDEBAR_SLOT_ID} className='group-data-[collapsible=icon]:hidden' />
      </SidebarContent>
      <SidebarFoot pathname={pathname} />
    </Sidebar>
  )
}

const MobileNavigation = () => {
  const content = useIntlayer('app-sidebar')
  const { active } = useNavigationState()
  return (
    <header className='sticky top-0 z-20 flex h-[49px] items-center gap-2.5 border-b border-border bg-sidebar px-3.5 sm:hidden'>
      <Link to='/' className='flex items-center gap-2 text-sm font-bold'>
        {logo}Nagisa
      </Link>
      <nav aria-label={content.navAriaLabel.value} className='ml-auto flex gap-0.5'>
        {navItems.map(({ to, key, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/' }}
            aria-label={content.nav[key].value}
            aria-current={active(to) ? 'page' : undefined}
            className={cn(
              'grid size-[34px] place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground',
              active(to) && 'bg-accent text-accent-foreground'
            )}
          >
            <Icon className='size-[18px]' aria-hidden='true' />
          </Link>
        ))}
      </nav>
    </header>
  )
}

export const AppSidebar = () => (
  <>
    <div className='hidden sm:block'>
      <DesktopSidebar />
    </div>
    <MobileNavigation />
    <GlobalSearchHotkey />
  </>
)

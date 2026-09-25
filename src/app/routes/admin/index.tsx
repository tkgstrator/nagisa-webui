import { createFileRoute } from '@tanstack/react-router'
import { AlignLeft, KeyRound, SearchAlert, Send, Server } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { NavLinkRow } from '@/app/components/nav-link-row'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'

export const Route = createFileRoute('/admin/')({
  component: AdminHubPage
})

const ADMIN_ITEMS = [
  { to: '/admin/unidentified', key: 'unidentified', icon: SearchAlert, warn: true },
  { to: '/admin/recorder', key: 'nagisa', icon: Send },
  { to: '/admin/abema', key: 'abema', icon: KeyRound },
  { to: '/admin/logs', key: 'logs', icon: AlignLeft },
  { to: '/admin/status', key: 'status', icon: Server }
] as const

function AdminHubPage() {
  const content = useIntlayer('admin')
  return (
    <PageContainer narrow className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.eyebrow.value} current={content.title.value} />}
        title={content.title.value}
        sub={content.description.value}
      />

      <div className='grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1'>
        {ADMIN_ITEMS.map((item) => {
          const itemContent = content.items[item.key]
          return (
            <NavLinkRow
              key={item.to}
              to={item.to}
              icon={item.icon}
              title={itemContent.title.value}
              sub={itemContent.description.value}
              warn={'warn' in item && item.warn}
            />
          )
        })}
      </div>
    </PageContainer>
  )
}

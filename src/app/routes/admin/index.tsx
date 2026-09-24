import { createFileRoute, Link } from '@tanstack/react-router'
import { Activity, FileQuestion, KeyRound, ScrollText, Send } from 'lucide-react'
import { useIntlayer } from 'react-intlayer'
import { PageContainer } from '@/app/components/page-container'

export const Route = createFileRoute('/admin/')({
  component: AdminHubPage
})

const ADMIN_ITEMS: {
  to: '/admin/unidentified' | '/admin/nagisa' | '/admin/abema' | '/admin/logs' | '/admin/status'
  key: 'unidentified' | 'nagisa' | 'abema' | 'logs' | 'status'
  icon: typeof FileQuestion
}[] = [
  { to: '/admin/unidentified', key: 'unidentified', icon: FileQuestion },
  { to: '/admin/nagisa', key: 'nagisa', icon: Send },
  { to: '/admin/abema', key: 'abema', icon: KeyRound },
  { to: '/admin/logs', key: 'logs', icon: ScrollText },
  { to: '/admin/status', key: 'status', icon: Activity }
]

function AdminHubPage() {
  const content = useIntlayer('admin')
  return (
    <PageContainer className='gap-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{content.title.value}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{content.description.value}</p>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        {ADMIN_ITEMS.map((item) => {
          const Icon = item.icon
          const itemContent = content.items[item.key]
          return (
            <Link
              key={item.to}
              to={item.to}
              className='group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted'
            >
              <div className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground'>
                <Icon className='size-4' />
              </div>
              <div className='min-w-0 flex-1 space-y-0.5'>
                <h2 className='text-sm font-semibold'>{itemContent.title.value}</h2>
                <p className='text-xs text-muted-foreground'>{itemContent.description.value}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </PageContainer>
  )
}

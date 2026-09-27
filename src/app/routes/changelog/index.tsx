import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { LoadingSpinner } from '@/app/components/loading-spinner'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { type ChangelogEntry, changelogQueryOptions } from '@/app/lib/query-options'

export const Route = createFileRoute('/changelog/')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(changelogQueryOptions()),
  pendingComponent: LoadingSpinner,
  component: ChangelogPage
})

function ChangelogPage() {
  const { data: commits } = useSuspenseQuery(changelogQueryOptions())

  const grouped = commits.reduce<Record<string, ChangelogEntry[]>>((acc, c) => {
    if (!acc[c.date]) acc[c.date] = []
    acc[c.date].push(c)
    return acc
  }, {})

  return (
    <PageContainer narrow className='gap-[22px]'>
      <PageHeader eyebrow={<PageEyebrowTrail parent='管理' current='Changelog' />} title='Changelog' />
      <div className='flex flex-col gap-[30px]'>
        {Object.entries(grouped).map(([date, entries]) => (
          <section key={date}>
            <h2 className='mb-2.5 border-border border-b pb-1.5 text-[13px] font-bold'>{date}</h2>
            <ul className='flex flex-col'>
              {entries.map((entry) => (
                <li
                  key={entry.hash}
                  className='flex items-baseline gap-2.5 border-border border-b py-[7px] text-[13px] last:border-b-0'
                >
                  <code className='flex-none rounded bg-muted px-1.5 py-0.5 font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-[11px] text-muted-foreground'>
                    {entry.hash}
                  </code>
                  <span className='min-w-0'>{entry.message}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageContainer>
  )
}

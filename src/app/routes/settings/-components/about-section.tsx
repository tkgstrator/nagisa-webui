import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useIntlayer } from 'react-intlayer'
import { animeListQueryOptions, scheduledCountQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'
import { PgSec, SecMoreLabel, secMoreClass } from './section'

const Meta = ({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) => (
  <div className='min-w-0 bg-background py-3.5 pr-4 pl-[19px]'>
    <dt className='text-[11px] text-muted-foreground'>{label}</dt>
    <dd
      className={cn(
        'mt-[5px] tabular-nums',
        mono ? 'font-mono text-sm font-bold' : 'text-[19px] font-extrabold tracking-[-0.02em] max-sm:text-[17px]'
      )}
    >
      {value}
    </dd>
  </div>
)

export const AboutSection = () => {
  const { data: animeList } = useQuery(animeListQueryOptions({ page: 1, limit: 1 }))
  const { data: scheduled } = useQuery(scheduledCountQueryOptions())
  const content = useIntlayer('settings-about-section')

  return (
    <PgSec
      id='s-about'
      title={content.title.value}
      more={
        <Link to='/changelog' className={secMoreClass}>
          <SecMoreLabel>{content.changelogLabel}</SecMoreLabel>
        </Link>
      }
    >
      <dl className='grid grid-cols-4 gap-px overflow-hidden rounded-[14px] bg-border max-sm:grid-cols-2'>
        <Meta label={content.meta.version.value} value={`v${__APP_VERSION__}`} />
        <Meta label={content.meta.build.value} value={__GIT_HASH__} mono />
        <Meta label={content.meta.animeCount.value} value={animeList?.total?.toLocaleString('ja-JP') ?? '—'} />
        <Meta label={content.meta.scheduledCount.value} value={scheduled?.toLocaleString('ja-JP') ?? '—'} />
      </dl>
    </PgSec>
  )
}

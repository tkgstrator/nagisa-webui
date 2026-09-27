import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useIntlayer } from 'react-intlayer'
import { unidentifiedListQueryOptions } from '@/app/lib/query-options'
import { cn } from '@/app/lib/utils'
import { ChangelogIcon, JobIcon, UnidentifiedIcon } from './icons'
import { PgSec, SecMoreLabel, secMoreClass } from './section'

const linkClass =
  'flex items-center gap-3 rounded-r-[10px] border-l-[3px] border-l-primary px-4 py-3.5 transition-[background-color,transform] duration-200 hover:translate-x-[3px] hover:bg-muted [&_svg]:text-primary'

type AdminPath = '/admin/unidentified' | '/admin/recorder' | '/changelog'

/** 目次の件数表示に使う。実ルートがあるリンクだけを数える。 */
export const ADMIN_LINK_COUNT = 3

interface AdminLinkProps {
  to: AdminPath
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  warn?: boolean
}

const AdminLink = ({ to, icon, title, description, warn = false }: AdminLinkProps) => (
  <Link to={to} className={cn(linkClass, warn && 'border-l-destructive [&_svg]:text-destructive')}>
    {icon}
    <div className='min-w-0'>
      <p className='text-[13px] font-bold'>{title}</p>
      <p className='mt-0.5 text-[11.5px] text-muted-foreground'>{description}</p>
    </div>
  </Link>
)

export const AdminSection = () => {
  const { data: unidentified } = useQuery(unidentifiedListQueryOptions({ page: 1, limit: 1 }))
  const content = useIntlayer('settings-admin-section')

  return (
    <PgSec
      id='s-admin'
      title={content.title.value}
      more={
        <Link to='/admin' className={secMoreClass}>
          <SecMoreLabel>{content.moreLabel}</SecMoreLabel>
        </Link>
      }
    >
      <div className='grid grid-cols-2 gap-3.5 max-lg:grid-cols-1'>
        <AdminLink
          to='/admin/unidentified'
          warn
          icon={<UnidentifiedIcon />}
          title={
            <>
              {content.unidentified.titlePrefix}
              <span className='tabular-nums'>{unidentified?.total ?? '—'}</span>
              {content.unidentified.titleSuffix}
            </>
          }
          description={content.unidentified.description}
        />
        <AdminLink
          to='/admin/recorder'
          icon={<JobIcon />}
          title={content.nagisaJob.title}
          description={content.nagisaJob.description}
        />
        <AdminLink
          to='/changelog'
          icon={<ChangelogIcon />}
          title={content.changelog.title}
          description={content.changelog.description}
        />
      </div>
    </PgSec>
  )
}

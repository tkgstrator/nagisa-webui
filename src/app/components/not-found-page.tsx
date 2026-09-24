import { Link, useRouterState } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Disc, Home, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { PageContainer } from '@/app/components/page-container'
import { StatusHero, StatusMeta, type StatusMetaRow, StatusSection } from '@/app/components/status-page'

/** `notFound({ data: { animeId } })` で渡ってきた作品 ID を取り出す。 */
function getAnimeId(data: unknown): string | undefined {
  if (data && typeof data === 'object') {
    const id = (data as { animeId?: unknown }).animeId
    if (typeof id === 'string' && id.trim().length > 0) return id
  }
  return undefined
}

const NextLink = ({
  to,
  icon: Icon,
  title,
  description
}: {
  to: '/' | '/browse' | '/recordings'
  icon: typeof Home
  title: string
  description: string
}) => (
  <Link
    to={to}
    className='flex items-center gap-3 rounded-r-lg border-primary border-l-[3px] px-4 py-3.5 transition-[background-color,transform] duration-200 hover:translate-x-[3px] hover:bg-muted'
  >
    <Icon className='size-5 flex-none text-primary' />
    <div className='min-w-0'>
      <div className='font-bold text-[13px]'>{title}</div>
      <div className='mt-0.5 text-[11.5px] text-muted-foreground'>{description}</div>
    </div>
  </Link>
)

/**
 * ルート未一致と、`notFound()` を投げたローダーの両方を受ける 404 画面。
 * 作品 ID が渡ってきたときだけ「作品が無い」文面に切り替える。
 */
export function NotFoundPage({ data }: { data?: unknown }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  // 描画のたびに動くと落ち着かないので、マウント時刻で固定する
  const [occurredAt] = useState(() => dayjs().format('YYYY-MM-DD HH:mm:ss'))
  const animeId = getAnimeId(data)
  const content = useIntlayer('not-found-page')
  const variant = animeId ? content.anime : content.page

  const rows: StatusMetaRow[] = [
    { label: content.meta.request.value, value: content.meta.requestValue({ pathname }).value },
    ...(animeId ? [{ label: content.meta.animeId.value, value: animeId, tone: 'danger' as const }] : []),
    { label: content.meta.occurredAt.value, value: occurredAt }
  ]

  const causes = variant.causes.map((cause) => cause.value)

  return (
    <PageContainer>
      <div className='w-full max-w-[720px] pt-[22px]'>
        <StatusHero
          tone='danger'
          eyebrow='404 NOT FOUND'
          title={variant.title.value}
          description={variant.description.value}
        />

        <StatusMeta rows={rows} />

        <StatusSection title={content.causesTitle.value}>
          <ul className='mt-2.5'>
            {causes.map((cause) => (
              <li
                key={cause}
                className='relative pl-[18px] text-[12.5px] text-muted-foreground leading-[1.5] before:absolute before:top-2 before:left-1 before:size-1 before:rounded-full before:bg-muted-foreground before:opacity-60 before:content-[""] [&+li]:mt-2'
              >
                {cause}
              </li>
            ))}
          </ul>
        </StatusSection>

        <StatusSection title={content.nextTitle.value}>
          <div className='mt-2.5 flex flex-col gap-0.5'>
            <NextLink
              to='/browse'
              icon={LayoutGrid}
              title={content.next.browse.title.value}
              description={content.next.browse.description.value}
            />
            <NextLink
              to='/recordings'
              icon={Disc}
              title={content.next.recordings.title.value}
              description={content.next.recordings.description.value}
            />
            <NextLink
              to='/'
              icon={Home}
              title={content.next.home.title.value}
              description={content.next.home.description.value}
            />
          </div>
        </StatusSection>
      </div>
    </PageContainer>
  )
}

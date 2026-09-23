import { Link, useRouterState } from '@tanstack/react-router'
import dayjs from 'dayjs'
import { Disc, Home, LayoutGrid } from 'lucide-react'
import { useState } from 'react'
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

  const rows: StatusMetaRow[] = [
    { label: 'リクエスト', value: `GET ${pathname}` },
    ...(animeId ? [{ label: '作品 ID', value: animeId, tone: 'danger' as const }] : []),
    { label: '発生時刻', value: occurredAt }
  ]

  const causes = animeId
    ? ['作品が削除され、参照だけが残っている', '古いブックマークや共有リンクから開いた', 'URL の ID を手で書き換えた']
    : ['URL を打ち間違えた', 'ページが移動または削除された', '古いブックマークや共有リンクから開いた']

  return (
    <PageContainer>
      <div className='w-full max-w-[720px] pt-[22px]'>
        <StatusHero
          tone='danger'
          eyebrow='404 NOT FOUND'
          title={animeId ? 'この作品は見つかりませんでした' : 'ページが見つかりません'}
          description={
            animeId
              ? '指定された ID に一致する作品がデータベースにありません。削除されたか、URL が間違っている可能性があります。'
              : 'お探しのページは存在しないか、移動した可能性があります。URL をご確認ください。'
          }
        />

        <StatusMeta rows={rows} />

        <StatusSection title='考えられる原因'>
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

        <StatusSection title='次にできること'>
          <div className='mt-2.5 flex flex-col gap-0.5'>
            <NextLink
              to='/browse'
              icon={LayoutGrid}
              title='アニメ一覧から探す'
              description='登録済みの作品をすべて表示します'
            />
            <NextLink
              to='/recordings'
              icon={Disc}
              title='録画を確認する'
              description='予約済み・録画済みの一覧を表示します'
            />
            <NextLink to='/' icon={Home} title='ホームに戻る' description='今期の更新状況を確認します' />
          </div>
        </StatusSection>
      </div>
    </PageContainer>
  )
}

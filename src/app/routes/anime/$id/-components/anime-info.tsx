import dayjs from 'dayjs'
import { providerLabel } from '@/app/lib/constants'
import type { AnimeInfoSchema } from '@/schemas/anime.dto'
import { getProviderTitleUrl } from '../-lib/format'

const Row = ({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) => (
  <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-b-border/60 py-[7px] text-[13px] last:border-b-0'>
    <span className='text-muted-foreground'>{label}</span>
    <span className={`text-right font-semibold ${mono === true ? 'font-mono text-xs leading-[18px]' : ''}`}>
      {children}
    </span>
  </div>
)

export function AnimeInfo({ anime }: { anime: AnimeInfoSchema }) {
  const titleUrl = getProviderTitleUrl(anime.provider, anime.contentId)

  return (
    <section aria-labelledby='info-heading'>
      <h3
        id='info-heading'
        className='mb-2 flex items-center gap-2 text-xs leading-[18px] text-muted-foreground tabular-nums'
      >
        作品情報
      </h3>
      <div className='border-l-[3px] border-border px-3 py-1'>
        {anime.aniListId > 0 && (
          <Row label='AniList'>
            <a
              href={`https://anilist.co/anime/${anime.aniListId}`}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary tabular-nums'
            >
              #{anime.aniListId}
            </a>
          </Row>
        )}
        <Row label='配信元'>
          {titleUrl === null ? (
            providerLabel[anime.provider]
          ) : (
            <a href={titleUrl} target='_blank' rel='noopener noreferrer' className='text-primary'>
              {providerLabel[anime.provider]}
            </a>
          )}
        </Row>
        {anime.expiredAt !== null && (
          <Row label='配信終了'>
            <span className='tabular-nums'>{dayjs(anime.expiredAt).format('YYYY/MM/DD')}</span>
          </Row>
        )}
        <Row label='最終更新'>
          <span className='tabular-nums'>{dayjs(anime.updatedAt).format('YYYY/MM/DD')}</span>
        </Row>
        <Row label='コンテンツID' mono>
          {anime.contentId}
        </Row>
      </div>
    </section>
  )
}

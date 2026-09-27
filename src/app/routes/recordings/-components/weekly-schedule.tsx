import dayjs from 'dayjs'
import { getIntlayer } from 'intlayer'
import { useIntlayer } from 'react-intlayer'
import { StatusBadge } from '@/app/components/ui/status-badge'
import { providerColor, providerLabel } from '@/app/lib/constants'
import { appLocale } from '@/app/lib/locale'
import { cn } from '@/app/lib/utils'
import type { AnimeSchema } from '@/schemas/anime.dto'
import { formatDate } from './format'

const moduleContent = getIntlayer('recordings-weekly-schedule', appLocale)

/** モックに合わせて月曜始まり。`dayjs().day()` は日曜=0 なので +6 して回す。 */
const DAY_NAMES = moduleContent.dayNames
const dayIndex = (date: string) => (dayjs(date).day() + 6) % 7

type Slot = { anime: AnimeSchema; time: string; note: string | null; tone: 'hiatus' | 'upcoming' | null }

const toneBorder = {
  hiatus: 'border-l-status-hiatus',
  upcoming: 'border-l-status-not-yet'
} as const

const toneNote = {
  hiatus: 'font-medium text-status-hiatus-foreground',
  upcoming: 'font-medium text-status-not-yet-foreground'
} as const

const toSlot = (anime: AnimeSchema): Slot | null => {
  if (anime.nextEpisodeDate === null) return null
  const next = dayjs(anime.nextEpisodeDate)
  if (!next.isValid()) return null
  if (anime.status === 'HIATUS') {
    return { anime, time: next.format('HH:mm'), note: moduleContent.hiatusNote, tone: 'hiatus' }
  }
  if (anime.status === 'NOT_YET_RELEASED') {
    return {
      anime,
      time: next.format('HH:mm'),
      note: moduleContent.upcomingNote({ date: formatDate(anime.nextEpisodeDate) }),
      tone: 'upcoming'
    }
  }
  return { anime, time: next.format('HH:mm'), note: null, tone: null }
}

const SlotItem = ({ slot }: { slot: Slot }) => (
  <div
    className={cn(
      'flex flex-col gap-[3px] border-l-[3px] py-1.5 pl-2.5',
      slot.tone === null ? 'border-l-border' : toneBorder[slot.tone]
    )}
  >
    <span className='text-[11px] text-muted-foreground tabular-nums'>{slot.time}</span>
    <span className='text-[12.5px] leading-[1.35] font-semibold'>{slot.anime.title}</span>
    {slot.note === null ? null : (
      <span className={cn('text-[11px]', slot.tone === null ? 'text-muted-foreground' : toneNote[slot.tone])}>
        {slot.note}
      </span>
    )}
    <span className='mt-px flex flex-wrap gap-1'>
      <StatusBadge size='sm' className={providerColor[slot.anime.provider] ?? 'bg-muted text-muted-foreground'}>
        {providerLabel[slot.anime.provider] ?? slot.anime.provider}
      </StatusBadge>
    </span>
  </div>
)

export const WeeklySchedule = ({ items }: { items: AnimeSchema[] }) => {
  const content = useIntlayer('recordings-weekly-schedule')
  const byDay: Slot[][] = [[], [], [], [], [], [], []]
  for (const anime of items) {
    const slot = toSlot(anime)
    if (slot === null) continue
    byDay[dayIndex(anime.nextEpisodeDate as string)].push(slot)
  }
  for (const slots of byDay) slots.sort((a, b) => a.time.localeCompare(b.time))

  return (
    <section aria-label={content.ariaLabel.value}>
      <p className='mb-3 text-xs text-muted-foreground'>{content.description}</p>
      {/* 曜日は左端の固定列。右側はその日の作品を折り返して並べる。 */}
      <div className='border-y border-border'>
        {byDay.map((slots, day) => {
          const weekend = day >= 5
          return (
            <div
              key={DAY_NAMES[day]}
              className={cn(
                'grid grid-cols-[72px_minmax(0,1fr)] border-b border-border py-2.5 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-2 max-sm:border-l-[3px] max-sm:px-1 max-sm:pt-2.5 max-sm:pb-3.5 max-sm:last:border-b',
                weekend ? 'max-sm:border-l-accent' : 'max-sm:border-l-border'
              )}
            >
              <div className='flex items-baseline gap-1.5 pt-1 pr-3 pl-0.5 max-sm:border-b max-sm:border-border max-sm:p-0 max-sm:pb-2'>
                <span className={cn('text-xs font-bold', weekend ? 'text-accent-foreground' : 'text-muted-foreground')}>
                  {DAY_NAMES[day]}
                </span>
                <span className='text-[11px] text-muted-foreground opacity-70 tabular-nums'>{slots.length}</span>
              </div>
              {slots.length === 0 ? (
                <p className='py-1.5 text-[11px] text-muted-foreground opacity-65'>{content.empty}</p>
              ) : (
                <div className='grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-x-3.5 gap-y-2 max-sm:grid-cols-1'>
                  {slots.map((slot) => (
                    <SlotItem key={slot.anime.id} slot={slot} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

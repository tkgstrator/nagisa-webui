import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/**
 * エラー系ページ (404 / ErrorBoundary) の共通パーツ。
 * 決定稿は囲み箱を持たず、左罫のアクセントと横罫だけで構造を出す。
 */

/** 深刻度。左罫と eyebrow の色だけで表す。 */
export type StatusTone = 'danger' | 'warn' | 'mute'

/**
 * 決定稿は 2 枚あり、寸法だけが違う。
 * `page` は not-found (単独ページ想定で一回り大きい)、`compact` は error-state。
 */
export type StatusSize = 'page' | 'compact'

const toneBorder: Record<StatusTone, string> = {
  danger: 'border-destructive',
  warn: 'border-warning',
  mute: 'border-muted-foreground'
}

/**
 * ライトの `--warning` (L 0.72) は白地の細い太字には明るすぎるので、
 * ライトだけ一段暗い値を直接指定する。ダークは白固定のトークンをそのまま使う。
 */
const toneText: Record<StatusTone, string> = {
  danger: 'text-destructive',
  warn: 'text-[oklch(0.52_0.14_75)] dark:text-warning',
  mute: 'text-muted-foreground'
}

const heroSize: Record<StatusSize, { root: string; eyebrow: string; title: string; description: string }> = {
  page: {
    root: 'pl-5',
    eyebrow: 'text-[11.5px]',
    title: 'text-[24px] leading-[1.25] max-sm:text-[20px]',
    description: 'text-[13px]'
  },
  compact: {
    root: 'pl-[18px]',
    eyebrow: 'text-[11px]',
    title: 'text-[19px] leading-[1.3] max-sm:text-[17px]',
    description: 'text-[12.5px]'
  }
}

export const StatusHero = ({
  tone,
  eyebrow,
  title,
  description,
  size = 'page'
}: {
  tone: StatusTone
  eyebrow: string
  title: string
  description: string
  size?: StatusSize
}) => {
  const sizes = heroSize[size]

  return (
    <div className={cn('border-l-[3px] py-0.5', sizes.root, toneBorder[tone])}>
      <span
        className={cn(
          'flex items-center gap-2 font-bold tracking-[0.08em] tabular-nums',
          sizes.eyebrow,
          toneText[tone]
        )}
      >
        <span className='size-1.5 flex-none rounded-full bg-current' />
        {eyebrow}
      </span>
      <h1 className={cn('mt-2 font-bold tracking-[-0.02em]', sizes.title)}>{title}</h1>
      <p className={cn('mt-2 text-muted-foreground leading-[1.75]', sizes.description)}>{description}</p>
    </div>
  )
}

export type StatusMetaRow = { label: string; value: string; tone?: StatusTone }

const metaSize: Record<StatusSize, { root: string; row: string; label: string }> = {
  page: { root: 'mt-6', row: 'py-2.5', label: 'w-24' },
  compact: { root: 'mt-5', row: 'py-[9px]', label: 'w-[88px]' }
}

/** 罫線だけの明細。値は長くなりがちなので等幅 + 横スクロールで逃がす。 */
export const StatusMeta = ({ rows, size = 'page' }: { rows: StatusMetaRow[]; size?: StatusSize }) => {
  const sizes = metaSize[size]

  return (
    <dl className={cn('border-border border-t', sizes.root)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'flex items-center gap-4 border-border border-b px-0.5 text-[12px] leading-[1.5] max-sm:flex-col max-sm:items-start max-sm:gap-1',
            sizes.row
          )}
        >
          <dt className={cn('flex-none text-muted-foreground max-sm:w-auto', sizes.label)}>{row.label}</dt>
          <dd
            className={cn(
              'min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[11.5px] tabular-nums max-sm:max-w-full',
              row.tone && cn('font-bold', toneText[row.tone])
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export const StatusSection = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <section className='mt-[30px]'>
      <h2 className='font-bold text-[13px] tracking-[-0.01em]'>{title}</h2>
      {children}
    </section>
  )
}

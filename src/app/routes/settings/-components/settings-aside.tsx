import { useEffect, useState } from 'react'
import { cn } from '@/app/lib/utils'
import { PROVIDER_KEYS, useSettings } from '../-lib/settings'

const SECTIONS = [
  { id: 's-view', label: '表示' },
  { id: 's-provider', label: '配信プロバイダ' },
  { id: 's-rec', label: '録画' },
  { id: 's-admin', label: '管理' },
  { id: 's-data', label: 'データ' },
  { id: 's-about', label: 'アプリ情報' }
] as const

/** 画面内で一番上に見えている節を現在地として返す。 */
const useActiveSection = () => {
  const [active, setActive] = useState<string>(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    )
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])

  return active
}

export const SettingsAside = ({ adminLinkCount }: { adminLinkCount: number }) => {
  const active = useActiveSection()
  const { settings } = useSettings()
  const enabled = PROVIDER_KEYS.filter((key) => settings.providers[key]).length

  const counts: Record<string, string | undefined> = {
    's-view': '5',
    's-provider': `${enabled} / ${PROVIDER_KEYS.length}`,
    's-rec': '5',
    's-admin': String(adminLinkCount),
    's-data': '3',
    's-about': undefined
  }

  return (
    <aside className='sticky top-6 flex flex-col gap-6 max-lg:static max-lg:order-first max-lg:gap-0'>
      <nav
        aria-label='設定の節'
        className='flex flex-col gap-0.5 max-lg:flex-row max-lg:gap-1.5 max-lg:overflow-x-auto max-lg:pb-0.5 max-lg:[scrollbar-width:none]'
      >
        <h3 className='px-3 pb-2 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase max-lg:hidden'>
          この画面の中身
        </h3>
        {SECTIONS.map((section) => {
          const current = active === section.id
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={current ? 'true' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-r-[9px] border-l-[3px] border-l-transparent px-3 py-2 text-[12.5px] text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground',
                'max-lg:shrink-0 max-lg:rounded-full max-lg:border-l-0 max-lg:bg-muted max-lg:px-3.5 max-lg:py-[7px]',
                current &&
                  'border-l-primary bg-accent font-bold text-accent-foreground max-lg:bg-primary max-lg:text-primary-foreground'
              )}
            >
              {section.label}
              {counts[section.id] !== undefined && (
                <span
                  className={cn(
                    'ml-auto text-[10.5px] tabular-nums text-muted-foreground',
                    current && 'max-lg:text-primary-foreground'
                  )}
                >
                  {counts[section.id]}
                </span>
              )}
            </a>
          )
        })}
      </nav>

      <p className='rounded-r-[11px] border-l-[3px] border-l-border bg-muted px-4 py-3.5 text-[11.5px] leading-[1.6] text-muted-foreground max-lg:hidden'>
        ここの設定は<b className='font-bold text-foreground'>このブラウザにだけ</b>
        保存される。別の端末やシークレットウィンドウには引き継がれない。持ち運ぶときは
        <b className='font-bold text-foreground'>データ</b>の「書き出す」を使う。
      </p>
    </aside>
  )
}

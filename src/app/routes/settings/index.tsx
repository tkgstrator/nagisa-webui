import { createFileRoute } from '@tanstack/react-router'
import { getDefaultStore } from 'jotai'
import { useEffect, useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { PageContainer } from '@/app/components/page-container'
import { cn } from '@/app/lib/utils'
import { AboutSection } from './-components/about-section'
import { ADMIN_LINK_COUNT, AdminSection } from './-components/admin-section'
import { DataSection } from './-components/data-section'
import { DisplaySection } from './-components/display-section'
import { CheckIcon } from './-components/icons'
import { LibrarySyncSection } from './-components/library-sync-section'
import { ProviderSection } from './-components/provider-section'
import { RecordingSection } from './-components/recording-section'
import { SettingsAside } from './-components/settings-aside'
import { settingsAtom, useSettings } from './-lib/settings'

/** 最後に設定が書き込まれた時刻。保存ボタンを持たないので、これが唯一の保存の合図になる。 */
const useLastSavedAt = () => {
  const [savedAt, setSavedAt] = useState(() => new Date())

  useEffect(() => getDefaultStore().sub(settingsAtom, () => setSavedAt(new Date())), [])

  return savedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

const SettingsPage = () => {
  const savedAt = useLastSavedAt()
  const { settings } = useSettings()
  const animations = settings.animations
  const content = useIntlayer('settings')

  const enter = (delay: number) =>
    animations
      ? cn(
          'fill-mode-both animate-in fade-in-0 slide-in-from-bottom-2 duration-500 motion-reduce:animate-none',
          delay === 0 ? '' : 'delay-[60ms]'
        )
      : undefined

  return (
    <PageContainer>
      <div className={cn('flex flex-wrap items-end justify-between gap-5', enter(0))}>
        <div>
          <p className='flex items-center gap-2 text-xs text-muted-foreground tabular-nums'>
            {content.savedNotice.lead}
            <b className='font-semibold text-foreground'>{content.savedNotice.scope}</b>
            {content.savedNotice.tail}
          </p>
          <h1 className='mt-1 text-2xl font-bold leading-[1.2] tracking-[-0.02em] max-sm:text-xl'>{content.title}</h1>
          <p className='mt-1 text-xs text-muted-foreground'>{content.description}</p>
        </div>
        <div className='flex items-center gap-2.5 max-sm:w-full max-sm:flex-wrap'>
          <span
            aria-live='polite'
            className='inline-flex h-7 items-center gap-[7px] rounded-full bg-success/15 px-3 text-[11.5px] font-bold text-success dark:text-foreground'
          >
            <CheckIcon />
            {content.savedLabel}
            <span className='tabular-nums'>{savedAt}</span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          'mt-[30px] grid grid-cols-[minmax(0,1fr)_280px] items-start gap-8 [&>*]:min-w-0 max-lg:grid-cols-[minmax(0,1fr)] max-lg:gap-7',
          enter(1)
        )}
      >
        <div>
          <DisplaySection />
          <ProviderSection />
          <RecordingSection />
          <LibrarySyncSection />
          <AdminSection />
          <DataSection />
          <AboutSection />
        </div>

        <SettingsAside adminLinkCount={ADMIN_LINK_COUNT} />
      </div>

      <div className='mt-10'></div>
    </PageContainer>
  )
}

export const Route = createFileRoute('/settings/')({
  component: SettingsPage
})

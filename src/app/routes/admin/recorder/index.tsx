import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { FormField, FormHint, FormRow, formControlClass, MonoText, PreBlock } from '@/app/components/form-field'
import { PageContainer } from '@/app/components/page-container'
import { PageEyebrowTrail, PageHeader } from '@/app/components/page-header'
import { PageSection } from '@/app/components/page-section'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Input } from '@/app/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import api from '@/app/lib/api'
import { providerLabel } from '@/app/lib/constants'
import { useSettings } from '@/app/routes/settings/-lib/settings'
import type { NagisaEnqueueRequest, NagisaEnqueueResponse } from '@/schemas/nagisa.dto'

export const Route = createFileRoute('/admin/recorder/')({
  component: NagisaJobEditorPage
})

type Provider = NagisaEnqueueRequest['provider']
type Marketplace = NonNullable<NagisaEnqueueRequest['marketplace']>
type Language = NonNullable<NagisaEnqueueRequest['language']>

const PROVIDERS: Provider[] = ['amazon', 'crunchyroll', 'hulu', 'abema']

/** Select の value で「未指定」を表すセンチネル（空文字は base-ui で扱いづらい） */
const UNSET = '__unset__'

/** Select の trigger に表示するラベルを value から引く */
const providerValueLabel = (v: unknown) => (typeof v === 'string' ? (providerLabel[v] ?? v) : '')

function NagisaJobEditorPage() {
  const content = useIntlayer('admin-nagisa')
  const { settings } = useSettings()
  const [provider, setProvider] = useState<Provider>('amazon')
  const [contentId, setContentId] = useState('')
  const [seasonNumberText, setSeasonNumberText] = useState('')
  const [episodesText, setEpisodesText] = useState('')
  const [marketplace, setMarketplace] = useState<Marketplace | typeof UNSET>(UNSET)
  const [language, setLanguage] = useState<Language | typeof UNSET>(settings.defaultLanguage)
  const [force, setForce] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const MARKETPLACES: { value: Marketplace; label: string }[] = [
    { value: 'jp', label: content.marketplaces.jp.value },
    { value: 'us', label: content.marketplaces.us.value }
  ]
  const LANGUAGES: { value: Language; label: string }[] = [
    { value: 'sub', label: content.languages.sub.value },
    { value: 'dub', label: content.languages.dub.value }
  ]

  const marketplaceValueLabel = (v: unknown) =>
    v === UNSET || v == null ? content.unset.value : (MARKETPLACES.find((m) => m.value === v)?.label ?? String(v))
  const languageValueLabel = (v: unknown) =>
    v === UNSET || v == null ? content.unset.value : (LANGUAGES.find((l) => l.value === v)?.label ?? String(v))

  const mutation = useMutation<NagisaEnqueueResponse, Error, NagisaEnqueueRequest>({
    mutationFn: (body) => api.enqueueRecordingJob(body)
  })

  const parseEpisodes = (): number[] | null | { error: string } => {
    const trimmed = episodesText.trim()
    if (!trimmed) {
      return null
    }
    const parts = trimmed.split(/[\s,]+/).filter((s) => s.length > 0)
    const nums: number[] = []
    for (const p of parts) {
      const n = Number(p)
      if (!Number.isInteger(n) || n <= 0) {
        return { error: content.validation.episodeNumberInvalid({ value: p }).value }
      }
      nums.push(n)
    }
    return nums
  }

  const parseSeasonNumber = (): number | null | { error: string } => {
    const trimmed = seasonNumberText.trim()
    if (!trimmed) {
      return null
    }
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n <= 0) {
      return { error: content.validation.seasonNumberInvalid({ value: trimmed }).value }
    }
    return n
  }

  const buildBody = (): NagisaEnqueueRequest | { error: string } => {
    const id = contentId.trim()
    if (!id) {
      return { error: content.validation.contentIdRequired.value }
    }
    const seasonNumber = parseSeasonNumber()
    if (seasonNumber && typeof seasonNumber === 'object' && 'error' in seasonNumber) {
      return seasonNumber
    }
    const episodes = parseEpisodes()
    if (episodes && typeof episodes === 'object' && 'error' in episodes) {
      return episodes
    }
    // episodes だけ指定されていて season_number が無いのは Nagisa 側でどう扱われるか不明なので弾く
    if (Array.isArray(episodes) && episodes.length > 0 && typeof seasonNumber !== 'number') {
      return { error: content.validation.episodesRequireSeasonNumber.value }
    }
    const seasons =
      typeof seasonNumber === 'number'
        ? [
            {
              season_number: seasonNumber,
              ...(Array.isArray(episodes) && episodes.length > 0 ? { episodes } : {})
            }
          ]
        : undefined
    return {
      provider,
      items: [{ content_id: id, ...(seasons ? { seasons } : {}) }],
      ...(marketplace !== UNSET ? { marketplace } : {}),
      ...(language !== UNSET ? { language } : {}),
      ...(force ? { force: true } : {})
    }
  }

  const onSubmit = () => {
    const built = buildBody()
    if ('error' in built) {
      setValidationError(built.error)
      return
    }
    setValidationError(null)
    mutation.mutate(built)
  }

  const preview = (() => {
    const built = buildBody()
    if ('error' in built) {
      return null
    }
    return built
  })()

  return (
    <PageContainer narrow className='gap-[22px]'>
      <PageHeader
        eyebrow={<PageEyebrowTrail parent={content.eyebrow.value} current={content.title.value} />}
        title={content.title.value}
        sub={
          <>
            {content.description.prefix.value} <MonoText>/api/queues</MonoText> {content.description.suffix.value}
          </>
        }
      />

      <div>
        <div className='flex max-w-[580px] flex-col gap-[18px]'>
          <FormField label='provider' htmlFor='provider'>
            <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
              <SelectTrigger id='provider' className={formControlClass}>
                <SelectValue>{providerValueLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {providerLabel[p] ?? p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label='content_id' htmlFor='contentId'>
            <Input
              id='contentId'
              className={formControlClass}
              placeholder={content.placeholders.contentId.value}
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
            />
          </FormField>

          <FormRow>
            <FormField label={content.labels.seasonNumber.value} htmlFor='seasonNumber'>
              <Input
                id='seasonNumber'
                className={formControlClass}
                placeholder={content.placeholders.seasonNumber.value}
                value={seasonNumberText}
                onChange={(e) => setSeasonNumberText(e.target.value)}
              />
            </FormField>
            <FormField label={content.labels.episodes.value} htmlFor='episodes' hint={content.episodesHint.value}>
              <Input
                id='episodes'
                className={formControlClass}
                placeholder={content.placeholders.episodes.value}
                value={episodesText}
                onChange={(e) => setEpisodesText(e.target.value)}
              />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField label={content.labels.marketplace.value} htmlFor='marketplace'>
              <Select value={marketplace} onValueChange={(v) => setMarketplace(v as Marketplace | typeof UNSET)}>
                <SelectTrigger id='marketplace' className={formControlClass}>
                  <SelectValue>{marketplaceValueLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{content.unset.value}</SelectItem>
                  {MARKETPLACES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={content.labels.language.value} htmlFor='language'>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language | typeof UNSET)}>
                <SelectTrigger id='language' className={formControlClass}>
                  <SelectValue>{languageValueLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNSET}>{content.unset.value}</SelectItem>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormRow>

          <label htmlFor='force' className='flex items-start gap-2'>
            <Checkbox
              id='force'
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
              className='size-[18px]'
            />
            <FormHint className='mt-0.5'>
              <b className='font-bold'>force</b> {content.forceHint.prefix.value} <MonoText>-F</MonoText>{' '}
              {content.forceHint.suffix.value}
            </FormHint>
          </label>

          {validationError && <p className='text-xs text-destructive'>{validationError}</p>}

          <div className='flex flex-wrap items-center gap-3'>
            <Button size='pill' onClick={onSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className='animate-spin' /> : <Send />}
              {content.submit.value}
            </Button>
            {mutation.isPending && <span className='text-xs text-muted-foreground'>{content.submitting.value}</span>}
          </div>
        </div>

        {preview && (
          <PageSection title={content.previewTitle.value}>
            <PreBlock>{JSON.stringify(preview, null, 2)}</PreBlock>
          </PageSection>
        )}

        {mutation.isError && (
          <PageSection title={content.errorTitle.value}>
            <PreBlock error>{mutation.error.message}</PreBlock>
          </PageSection>
        )}

        {mutation.isSuccess && (
          <>
            <PageSection title={content.enqueuedCount({ count: mutation.data.count })}>
              <div className='flex flex-col gap-2.5'>
                {mutation.data.jobs.map((job) => (
                  <div
                    key={job.job_id}
                    className='flex flex-col gap-[3px] rounded-r-lg border-l-[3px] border-success bg-background px-3 py-2.5'
                  >
                    <p className='text-[13px] font-bold'>
                      {job.name} ({job.status}) — {job.job_id}
                    </p>
                    {job.preview && (
                      <>
                        <div className='text-[11.5px] text-muted-foreground'>{job.preview.title}</div>
                        {job.preview.title_en && (
                          <div className='text-[11.5px] text-muted-foreground'>{job.preview.title_en}</div>
                        )}
                        <div className='text-[11.5px] text-muted-foreground tabular-nums'>
                          {content.jobPreviewMeta({
                            contentType: job.preview.content_type,
                            selected: job.preview.selected_episodes,
                            total: job.preview.total_episodes,
                            marketplace: job.preview.marketplace
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </PageSection>
            <PageSection title={content.responseTitle.value}>
              <PreBlock>{JSON.stringify(mutation.data, null, 2)}</PreBlock>
            </PageSection>
          </>
        )}
      </div>
    </PageContainer>
  )
}

import { useMutation } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { useIntlayer } from 'react-intlayer'
import { PageContainer } from '@/app/components/page-container'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import api from '@/app/lib/api'
import { providerLabel } from '@/app/lib/constants'
import { useSettings } from '@/app/routes/settings/-lib/settings'
import type { NagisaEnqueueRequest, NagisaEnqueueResponse } from '@/schemas/nagisa.dto'

export const Route = createFileRoute('/admin/nagisa/')({
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
    mutationFn: (body) => api.enqueueNagisaJob(body)
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
    <PageContainer className='gap-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>{content.title.value}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {content.description.prefix.value} <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>/api/queues</code>{' '}
          {content.description.suffix.value}
        </p>
      </div>

      <div className='space-y-4'>
        <div className='space-y-1.5'>
          <Label htmlFor='provider'>provider</Label>
          <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <SelectTrigger id='provider' className='w-full'>
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
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='contentId'>content_id</Label>
          <Input
            id='contentId'
            placeholder={content.placeholders.contentId.value}
            value={contentId}
            onChange={(e) => setContentId(e.target.value)}
          />
        </div>

        <div className='grid gap-4 sm:grid-cols-[1fr_2fr]'>
          <div className='space-y-1.5'>
            <Label htmlFor='seasonNumber'>{content.labels.seasonNumber.value}</Label>
            <Input
              id='seasonNumber'
              placeholder={content.placeholders.seasonNumber.value}
              value={seasonNumberText}
              onChange={(e) => setSeasonNumberText(e.target.value)}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='episodes'>{content.labels.episodes.value}</Label>
            <Input
              id='episodes'
              placeholder={content.placeholders.episodes.value}
              value={episodesText}
              onChange={(e) => setEpisodesText(e.target.value)}
            />
            <p className='text-xs text-muted-foreground'>{content.episodesHint.value}</p>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='marketplace'>{content.labels.marketplace.value}</Label>
            <Select value={marketplace} onValueChange={(v) => setMarketplace(v as Marketplace | typeof UNSET)}>
              <SelectTrigger id='marketplace' className='w-full'>
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
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='language'>{content.labels.language.value}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as Language | typeof UNSET)}>
              <SelectTrigger id='language' className='w-full'>
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
          </div>
        </div>

        <label htmlFor='force' className='inline-flex items-start gap-2 text-sm'>
          <Checkbox id='force' checked={force} onCheckedChange={(v) => setForce(v === true)} className='mt-0.5' />
          <span>
            <span className='font-medium'>force</span>
            <span className='ml-1 text-muted-foreground'>
              {content.forceHint.prefix.value} <code>-F</code> {content.forceHint.suffix.value}
            </span>
          </span>
        </label>

        {validationError && <p className='text-sm text-destructive'>{validationError}</p>}

        <div className='flex items-center gap-3'>
          <Button onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className='animate-spin' /> : <Send />}
            {content.submit.value}
          </Button>
          {mutation.isPending && <span className='text-sm text-muted-foreground'>{content.submitting.value}</span>}
        </div>
      </div>

      {preview && (
        <div className='space-y-1.5'>
          <p className='text-sm font-medium leading-none'>{content.previewTitle.value}</p>
          <pre className='overflow-x-auto rounded-xl border border-border bg-muted p-3 font-mono text-xs'>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </div>
      )}

      {mutation.isError && (
        <div className='space-y-1.5'>
          <p className='text-sm font-medium leading-none'>{content.errorTitle.value}</p>
          <pre className='overflow-x-auto rounded-xl border border-destructive/50 bg-destructive/10 p-3 font-mono text-xs text-destructive'>
            {mutation.error.message}
          </pre>
        </div>
      )}

      {mutation.isSuccess && (
        <div className='space-y-3'>
          <div className='text-sm text-muted-foreground'>{content.enqueuedCount({ count: mutation.data.count })}</div>
          {mutation.data.jobs.map((job) => (
            <div key={job.job_id} className='space-y-1.5'>
              <p className='text-sm font-medium leading-none'>
                {job.name} ({job.status}) — {job.job_id}
              </p>
              {job.preview && (
                <div className='space-y-0.5 text-sm'>
                  <div className='font-medium'>{job.preview.title}</div>
                  {job.preview.title_en && <div className='text-xs text-muted-foreground'>{job.preview.title_en}</div>}
                  <div className='text-xs text-muted-foreground'>
                    {content.jobPreviewMeta({
                      contentType: job.preview.content_type,
                      selected: job.preview.selected_episodes,
                      total: job.preview.total_episodes,
                      marketplace: job.preview.marketplace
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className='space-y-1.5'>
            <p className='text-sm font-medium leading-none'>{content.responseTitle.value}</p>
            <pre className='overflow-x-auto rounded-xl border border-border bg-muted p-3 font-mono text-xs'>
              {JSON.stringify(mutation.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

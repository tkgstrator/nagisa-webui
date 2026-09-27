import { getIntlayer } from 'intlayer'
import { getDefaultStore, useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { appLocale } from '@/app/lib/locale'

const settingsModuleContent = getIntlayer('settings-settings', appLocale)

export type ThemePreference = 'light' | 'dark' | 'system'
export type CardDensity = 'comfortable' | 'default' | 'compact'
export type SortPreference = 'title-asc' | 'title-desc' | 'year-asc' | 'year-desc'
export type LanguagePreference = 'sub' | 'dub'

/** 配信プロバイダの識別子。src/app/lib/constants.ts の providerLabel と同じ並び。 */
export const PROVIDER_KEYS = ['amazon', 'hulu', 'crunchyroll', 'abema', 'netflix'] as const
export type ProviderKey = (typeof PROVIDER_KEYS)[number]

/** カタログ取得が実装されていないプロバイダ。行には「まだ対応していません」と出る。 */
export const UNLINKED_PROVIDERS: readonly ProviderKey[] = ['netflix']

export interface SeasonPin {
  year: number
  quarter: number
}

export interface Settings {
  theme: ThemePreference
  pageSize: number
  defaultSort: SortPreference
  density: CardDensity
  animations: boolean
  providers: Record<ProviderKey, boolean>
  /** null なら「今期に追従」。値があればその期に固定する。 */
  seasonPin: SeasonPin | null
  requestRecordingOnMark: boolean
  confirmBulkCancel: boolean
  expiringLeadDays: number
  autoScheduleNewEpisodes: boolean
  defaultLanguage: LanguagePreference
}

export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const
export const EXPIRING_LEAD_DAY_OPTIONS = [3, 7, 14, 30] as const

export const SORT_LABELS: Record<SortPreference, string> = {
  'title-asc': settingsModuleContent.sortLabels.titleAsc,
  'title-desc': settingsModuleContent.sortLabels.titleDesc,
  'year-asc': settingsModuleContent.sortLabels.yearAsc,
  'year-desc': settingsModuleContent.sortLabels.yearDesc
}

export const LANGUAGE_LABELS: Record<LanguagePreference, string> = {
  sub: settingsModuleContent.languageLabels.sub,
  dub: settingsModuleContent.languageLabels.dub
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  pageSize: 24,
  defaultSort: 'title-asc',
  density: 'default',
  animations: true,
  providers: { amazon: true, hulu: true, crunchyroll: true, abema: true, netflix: false },
  seasonPin: null,
  requestRecordingOnMark: true,
  confirmBulkCancel: true,
  expiringLeadDays: 14,
  autoScheduleNewEpisodes: false,
  defaultLanguage: 'sub'
}

export const SETTINGS_STORAGE_KEY = 'nagisa-settings'

/**
 * 端末ローカルの設定。保存ボタンは無く、書き込んだ時点で localStorage に入る。
 * getOnInit で初回レンダリング前に読むため、テーマが一瞬ちらつかない。
 */
export const settingsAtom = atomWithStorage<Settings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS, undefined, {
  getOnInit: true
})

/** 保存済みの値と既定値をマージして欠けたキーを埋める (古い localStorage 対策)。 */
const withDefaults = (value: Settings): Settings => ({
  ...DEFAULT_SETTINGS,
  ...value,
  providers: { ...DEFAULT_SETTINGS.providers, ...value?.providers }
})

export const useSettings = () => {
  const [raw, setRaw] = useAtom(settingsAtom)
  const settings = withDefaults(raw)
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setRaw({ ...settings, [key]: value })
  const setProvider = (provider: ProviderKey, enabled: boolean) =>
    setRaw({ ...settings, providers: { ...settings.providers, [provider]: enabled } })
  const reset = () => setRaw(DEFAULT_SETTINGS)
  const replace = (next: Settings) => setRaw(withDefaults(next))
  return { settings, update, setProvider, reset, replace }
}

/** 今日が属するクール。「今期に追従」を固定に切り替えたときの初期値に使う。 */
export const currentSeason = (now: Date = new Date()): SeasonPin => ({
  year: now.getFullYear(),
  quarter: Math.floor(now.getMonth() / 3) + 1
})

/**
 * React の外 (ルートの loader やモジュールスコープ) から現在の設定を読む。
 * jotai の Provider は使っていないので、フックと同じ既定ストアを直接引く。
 */
export const readSettings = (): Settings => withDefaults(getDefaultStore().get(settingsAtom))

/** 一覧に出すクール。ピン留めが無ければ今期に追従する。 */
export const activeSeason = (settings: Settings): SeasonPin => settings.seasonPin ?? currentSeason()

/** 並び順の設定値を、一覧 API のクエリ 2 つに分解する。 */
export const parseSortPreference = (value: SortPreference): { sort: 'title' | 'year'; order: 'asc' | 'desc' } => {
  const [sort, order] = value.split('-') as ['title' | 'year', 'asc' | 'desc']
  return { sort, order }
}

export const QUARTER_LABELS = settingsModuleContent.quarterLabels

export const formatSeason = (season: SeasonPin) =>
  settingsModuleContent.seasonFormat({ year: season.year, quarter: QUARTER_LABELS[season.quarter - 1] ?? '' })

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

const applyTheme = (theme: ThemePreference) => {
  if (typeof document === 'undefined') return
  const dark = theme === 'dark' || (theme === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const applyAnimations = (enabled: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.animations = enabled ? 'on' : 'off'
}

/**
 * テーマとアニメーション設定をアプリ全体へ反映する。
 * routeTree.gen.ts が設定ルートを静的 import するため、この副作用は起動時に必ず走る。
 */
if (typeof window !== 'undefined') {
  const store = getDefaultStore()
  const sync = () => {
    const current = withDefaults(store.get(settingsAtom))
    applyTheme(current.theme)
    applyAnimations(current.animations)
  }
  sync()
  store.sub(settingsAtom, sync)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sync)
}

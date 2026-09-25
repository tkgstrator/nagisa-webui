import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomWithQuery } from 'jotai-tanstack-query'
import type { RecordedFilter, SortValue } from '@/app/routes/recordings/-components/recordings-toolbar'
import { parseSortPreference, readSettings, type Settings } from '@/app/routes/settings/-lib/settings'
import { recorderStatusQueryOptions } from './query-options'

export const recorderStatusAtom = atomWithQuery(() => recorderStatusQueryOptions())

interface BrowseFilters {
  provider?: string
  year?: number
  quarter?: number
  status?: string
  badge?: string
  aniListId?: number
  sort: 'title' | 'year'
  order: 'asc' | 'desc'
  search: string
  page: number
  /** 1 ページあたりの表示件数。保存済みの古い値には無いので、読む側で既定値へフォールバックする。 */
  limit?: number
}

/**
 * 絞り込みの初期値。並び順とクールは設定から拾うので、
 * 「すべて解除」した直後の状態も設定に追従する。
 * クールは設定側が 1〜4、一覧 API が 0〜3 なので詰め替える。
 */
export const browseFiltersDefaults = (settings: Settings = readSettings()): BrowseFilters => {
  const pin = settings.seasonPin
  return {
    ...parseSortPreference(settings.defaultSort),
    year: pin === null ? undefined : pin.year,
    quarter: pin === null ? undefined : pin.quarter - 1,
    search: '',
    page: 1
  }
}

/**
 * localStorage は初期化時にも読む。既定の遅延読み込みだと初回レンダーが既定値になり、
 * 保存済みの条件へ復元されるまでに一覧クエリを二度投げてしまう。SPA なので window は常にある。
 */
const storageOptions = { getOnInit: true }

export const browseFiltersAtom = atomWithStorage<BrowseFilters>(
  'browse-filters',
  browseFiltersDefaults(),
  undefined,
  storageOptions
)
export type { BrowseFilters }

/** 録画一覧の表示モード。一覧と週間スケジュールの 2 択。 */
type RecordingsView = 'list' | 'schedule'

interface RecordingsFilters {
  search: string
  recorded: RecordedFilter
  expiringOnly: boolean
  /** 完結した作品も並べるか。保存済みの古い値には無いので undefined は false とみなす。 */
  showFinished?: boolean
  provider?: string
  sort: SortValue
  view: RecordingsView
  page: number
}

/** 録画一覧の絞り込みの初期値。「すべて解除」の戻り先でもある。 */
export const recordingsFiltersDefaults = (): RecordingsFilters => ({
  search: '',
  recorded: 'all',
  expiringOnly: false,
  showFinished: false,
  provider: undefined,
  sort: 'updatedAt-desc',
  view: 'list',
  page: 1
})

export const recordingsFiltersAtom = atomWithStorage<RecordingsFilters>(
  'recordings-filters',
  recordingsFiltersDefaults(),
  undefined,
  storageOptions
)
export type { RecordingsFilters, RecordingsView }

/** ⌘K でページ内検索へ焦点を移すためのシグナル。値は単調増加のカウンタ。 */
export const searchFocusAtom = atom(0)

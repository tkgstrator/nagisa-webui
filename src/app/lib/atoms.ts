import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { atomWithQuery } from 'jotai-tanstack-query'
import { parseSortPreference, readSettings, type Settings } from '@/app/routes/settings/-lib/settings'
import { nagisaStatusQueryOptions } from './query-options'

export const nagisaStatusAtom = atomWithQuery(() => nagisaStatusQueryOptions())

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

export const browseFiltersAtom = atomWithStorage<BrowseFilters>('browse-filters', browseFiltersDefaults())
export type { BrowseFilters }

/** ⌘K でページ内検索へ焦点を移すためのシグナル。値は単調増加のカウンタ。 */
export const searchFocusAtom = atom(0)

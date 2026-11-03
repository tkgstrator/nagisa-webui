import type { AnimeSchema } from '@/schemas/anime.dto'

/** `@/app/components/ui/tone` の Tone と同じ語彙。shared な lib から app に依存させないため別に宣言する。 */
export type AnimeStatusTone = 'success' | 'warning' | 'info' | 'destructive' | 'muted'

export type AnimeStatusKey = 'completed' | 'incomplete' | 'recording' | 'upcoming' | 'hiatus' | 'cancelled'

/** 表に出す 1 つの状態。未知の status は `key: null` で、生の文字列をそのまま `raw` に残す。 */
export type DerivedAnimeStatus =
  | { key: AnimeStatusKey; tone: AnimeStatusTone }
  | { key: null; raw: string; tone: 'muted' }

/**
 * AniList の `status` と作品単位の `recorded` から、一覧の Status 列に出す状態を 1 つ導く。
 * FINISHED だけが `recorded` で分かれる。未知の status は落とさず muted で返す。
 */
export const deriveAnimeStatus = (anime: Pick<AnimeSchema, 'status' | 'recorded'>): DerivedAnimeStatus => {
  switch (anime.status) {
    case 'FINISHED':
      return anime.recorded ? { key: 'completed', tone: 'success' } : { key: 'incomplete', tone: 'warning' }
    case 'RELEASING':
      return { key: 'recording', tone: 'info' }
    case 'NOT_YET_RELEASED':
      return { key: 'upcoming', tone: 'muted' }
    case 'HIATUS':
      return { key: 'hiatus', tone: 'muted' }
    case 'CANCELLED':
      return { key: 'cancelled', tone: 'destructive' }
    default:
      return { key: null, raw: anime.status, tone: 'muted' }
  }
}

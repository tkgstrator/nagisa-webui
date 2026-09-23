import {
  type NagisaAnilistLookup,
  NagisaAnilistLookupSchema,
  NagisaEnqueueRequestSchema,
  type NagisaTitleMapping
} from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'
import { fetchNagisaRaw, NagisaConfigError, type NagisaEnv } from './nagisa-client'

const logger = getAppLogger('anilist-recording')

type Prisma = ReturnType<typeof createPrismaClient>

export type AnilistLookupResult =
  | { ok: true; data: NagisaAnilistLookup }
  | { ok: false; error: string; status?: number }

/** nagisa が受け付ける配信元だけを通す。netflix などは対応を送っても 400 で一括拒否される。 */
const NagisaProvider = NagisaEnqueueRequestSchema.shape.provider

/**
 * *aniListId* に属する D1 の作品を、nagisa の `(provider, content_id) → anilist_id` 対応として送る。
 *
 * nagisa は対応を推測しない (投入時の `anilist_id` か、この PUT でしか入らない) ので、
 * `anilist_id` を送るようになる前に録った作品はここで教えるまで引けない。冪等。
 */
async function seedTitles(
  prisma: Prisma,
  env: Partial<NagisaEnv>,
  aniListId: number
): Promise<AnilistLookupResult | null> {
  const rows = await prisma.anime.findMany({
    where: { aniListId },
    select: { provider: true, contentId: true }
  })
  const titles: NagisaTitleMapping[] = []
  for (const row of rows) {
    const provider = NagisaProvider.safeParse(row.provider)
    if (provider.success) titles.push({ provider: provider.data, content_id: row.contentId, anilist_id: aniListId })
  }
  if (titles.length === 0) return null

  const res = await fetchNagisaRaw(env, '/api/library/titles', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titles })
  })
  if (!res.ok) {
    const body = await res.text()
    logger.error({ action: 'anilist-seed-error', aniListId, status: res.status, body })
    return { ok: false, error: body || `Nagisa returned ${res.status}`, status: res.status }
  }
  logger.info({ action: 'anilist-seed-ok', aniListId, count: titles.length })
  return null
}

async function lookup(env: Partial<NagisaEnv>, aniListId: number): Promise<AnilistLookupResult | 'not_mapped'> {
  const res = await fetchNagisaRaw(env, `/api/library/anilist/${aniListId}`)
  if (res.status === 404) {
    // 404 は 2 種類ある: 対応が無い (not_mapped) と、ルート自体が無い (1.7 より前の nagisa)。
    // 後者を「未登録」と読むと seed → 再検索が永遠に空振るので、error で見分ける。
    const body = await res.text()
    try {
      if ((JSON.parse(body) as { error?: unknown }).error === 'not_mapped') return 'not_mapped'
    } catch {
      // JSON でない 404 はルートが無い側
    }
    return { ok: false, error: body || 'Nagisa returned 404', status: 404 }
  }
  if (!res.ok) {
    const body = await res.text()
    logger.error({ action: 'anilist-lookup-error', aniListId, status: res.status, body })
    return { ok: false, error: body || `Nagisa returned ${res.status}`, status: res.status }
  }
  const parsed = NagisaAnilistLookupSchema.safeParse(await res.json())
  if (!parsed.success) {
    logger.error({ action: 'anilist-lookup-unparsable', aniListId, error: parsed.error.message })
    return { ok: false, error: 'Unexpected response from Nagisa' }
  }
  return { ok: true, data: parsed.data }
}

/**
 * AniList 作品 1 本ぶんの録画状況を nagisa に問い合わせる。throw しない。
 *
 * 対応が未登録 (`not_mapped`) なら D1 から対応を送って 1 回だけ引き直す。それでも
 * 未登録なら「nagisa はこの作品を何も持っていない」ので空の結果を返す — 失敗ではない。
 */
export async function lookupAnilistRecording(
  prisma: Prisma,
  env: Partial<NagisaEnv>,
  aniListId: number
): Promise<AnilistLookupResult> {
  try {
    const first = await lookup(env, aniListId)
    if (first !== 'not_mapped') return first

    const seeded = await seedTitles(prisma, env, aniListId)
    if (seeded) return seeded

    const second = await lookup(env, aniListId)
    if (second !== 'not_mapped') return second
    return { ok: true, data: { anilist_id: aniListId, queue_available: true, titles: [] } }
  } catch (e) {
    if (e instanceof NagisaConfigError) {
      logger.error({ action: 'anilist-lookup-config-missing', missing: e.missing })
      return { ok: false, error: e.message }
    }
    logger.error({ action: 'anilist-lookup-fetch-error', aniListId, error: e instanceof Error ? e.message : String(e) })
    return { ok: false, error: 'Failed to connect to Nagisa' }
  }
}

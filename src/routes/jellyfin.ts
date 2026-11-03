import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { createPrismaClient } from '../lib/db'
import { isJellyfinConfigured, type JellyfinEnv } from '../lib/jellyfin/client'
import { JELLYFIN_STATE_KEY } from '../lib/jellyfin/dirty'
import { DEFAULT_MAX_WAIT_SECONDS, DEFAULT_SETTLE_SECONDS, parseSeconds } from '../lib/jellyfin/refresh'
import { JellyfinRefreshStateSchema } from '../schemas/jellyfin.dto'

type Bindings = { DB: D1Database } & Partial<JellyfinEnv>

/** Jellyfin ライブラリ自動更新 (docs/plans/06-jellyfin-refresh.md)。設定の編集口は持たない。 */
const jellyfin = new OpenAPIHono<{ Bindings: Bindings }>()

/** 表示用の URL。万一 userinfo (user:pass@) が埋まっていても出さない。 */
function displayUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

jellyfin.openapi(
  createRoute({
    method: 'get',
    path: '/refresh-state',
    tags: ['Jellyfin'],
    summary: 'Jellyfin 自動更新の設定と状態 (読み取り専用)',
    description:
      '環境変数の値と、デバウンス状態 (保留中か / 最終成功 / 連続失敗) を返す。' +
      'API キーは設定済みかどうかだけで、値は返さない。上流の Jellyfin には触れない。',
    responses: {
      200: {
        description: '設定と状態',
        content: { 'application/json': { schema: JellyfinRefreshStateSchema } }
      }
    }
  }),
  async (c) => {
    const env = c.env
    const prisma = createPrismaClient(env.DB)
    const state = await prisma.jellyfinRefreshState.findUnique({ where: { key: JELLYFIN_STATE_KEY } })
    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
    return c.json(
      {
        enabled: isJellyfinConfigured(env),
        url: displayUrl(env.JELLYFIN_URL),
        apiKeyConfigured: Boolean(env.JELLYFIN_API_KEY),
        accessTokenConfigured: Boolean(env.JELLYFIN_ACCESS_CLIENT_ID && env.JELLYFIN_ACCESS_CLIENT_SECRET),
        settleSeconds: Math.round(parseSeconds(env.JELLYFIN_REFRESH_SETTLE_SECONDS, DEFAULT_SETTLE_SECONDS)),
        maxWaitSeconds: Math.round(parseSeconds(env.JELLYFIN_REFRESH_MAX_WAIT_SECONDS, DEFAULT_MAX_WAIT_SECONDS)),
        pending: state?.dirtySince != null,
        dirtySince: iso(state?.dirtySince),
        lastChangeAt: iso(state?.lastChangeAt),
        lastAttemptAt: iso(state?.lastAttemptAt),
        lastSucceededAt: iso(state?.lastSucceededAt),
        nextAttemptAt: iso(state?.nextAttemptAt),
        consecutiveFailures: state?.consecutiveFailures ?? 0,
        lastError: state?.lastError ?? null
      },
      200
    )
  }
)

export default jellyfin

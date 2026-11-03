import { z } from 'zod'

/**
 * `GET /api/jellyfin/refresh-state`。環境変数の値は **読み取り専用** で見せるだけ。
 * API キー (secret) は「設定済みか」の boolean しか返さない。値はこのスキーマに載せない。
 */
export const JellyfinRefreshStateSchema = z.object({
  /** URL と API キーが両方あり、機能が有効 */
  enabled: z.boolean(),
  /** JELLYFIN_URL (var)。userinfo は落としてある。未設定なら null */
  url: z.string().nullable(),
  /** JELLYFIN_API_KEY (secret) が設定済みか。値は返さない */
  apiKeyConfigured: z.boolean(),
  /** Cloudflare Access のサービストークン (任意) が両方設定済みか */
  accessTokenConfigured: z.boolean(),
  settleSeconds: z.number().int(),
  maxWaitSeconds: z.number().int(),
  /** 送るべき更新が保留中か (dirty_since が立っている) */
  pending: z.boolean(),
  dirtySince: z.string().nullable(),
  lastChangeAt: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  lastSucceededAt: z.string().nullable(),
  nextAttemptAt: z.string().nullable(),
  consecutiveFailures: z.number().int(),
  /** `HTTP 401` のような短い要約。応答本文や認証情報は含まない */
  lastError: z.string().nullable()
})
export type JellyfinRefreshState = z.infer<typeof JellyfinRefreshStateSchema>

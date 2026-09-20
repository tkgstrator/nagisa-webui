/**
 * Lambda invocation event を Function URL / API Gateway / 直接 invoke の
 * どのケースでも一貫した形 (path / body / requestId) に落とし込む正規化層。
 */
import { z } from 'zod'

/**
 * Lambda event の最小ガード用スキーマ。
 * Function URL / API Gateway 経由か、直接 invoke かで形状が変わる。
 *   - Function URL:    { rawPath, body: string, requestContext: { requestId }, ... }
 *   - API Gateway v1:  { path, body: string, ... }
 *   - 直接 invoke:      handler が期待する JSON をそのまま渡す形式
 */
const LambdaEventSchema = z
  .object({
    rawPath: z.string().optional(),
    path: z.string().optional(),
    body: z.string().nullable().optional(),
    requestContext: z.object({ requestId: z.string().optional() }).partial().passthrough().optional()
  })
  .passthrough()

/**
 * parseEvent の結果。
 * ok=true なら body が routing に渡せる状態、ok=false なら body の JSON パースに失敗している
 * (handler で 400 化する)。path / requestId はどちらの場合もログ用に取り出せる。
 */
export type ParsedEvent =
  | { ok: true; path: string; body: unknown; requestId: string | null }
  | { ok: false; path: string; requestId: string | null }

/**
 * Lambda invocation event を parse し、routing path / body / requestId を取り出す。
 * body が文字列で JSON.parse に失敗した場合は ok=false を返す。
 * 直接 invoke で event 全体が body の場合はそのまま body として扱う。
 */
export function parseEvent(raw: unknown): ParsedEvent {
  const parsed = LambdaEventSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: true, path: '/', body: raw, requestId: null }
  }

  const { rawPath, path, body, requestContext } = parsed.data
  const routePath = rawPath ?? path ?? '/'
  const requestId = requestContext?.requestId ?? null

  if (typeof body === 'string' && body.length > 0) {
    try {
      return { ok: true, path: routePath, body: JSON.parse(body), requestId }
    } catch {
      return { ok: false, path: routePath, requestId }
    }
  }

  return { ok: true, path: routePath, body: raw, requestId }
}

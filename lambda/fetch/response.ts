/**
 * Lambda ハンドラが返すレスポンスの構築ヘルパー。
 * ok / fail / zodFail / handleRoute はいずれも LambdaResponse を返す共通形。
 */
import type { z } from 'zod'

/** Lambda 側に返す最小限のレスポンス形状。API Gateway proxy 相当のフィールドセット。 */
export type LambdaResponse = { statusCode: number; body: string }

/**
 * upstream (AniList 等の外部 API) が 4xx/5xx を返した場合に handler 内から throw する error。
 * {@link handleRoute} がこれを catch して 502 の LambdaResponse に変換する。
 * message はそのまま 502 body の `error` になる。
 */
export class UpstreamError extends Error {
  /** upstream が返した HTTP ステータス。 */
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'UpstreamError'
    this.status = status
  }
}

/** 200 OK + JSON body の LambdaResponse を作る。 */
export const ok = <T>(data: T): LambdaResponse => ({
  statusCode: 200,
  body: JSON.stringify(data)
})

/** 任意のステータス + `{ error }` body の LambdaResponse を作る。 */
export const fail = (statusCode: number, error: string): LambdaResponse => ({
  statusCode,
  body: JSON.stringify({ error })
})

/** zodFail の label → HTTP ステータス対応。request 失敗は 400、response 失敗は 500。 */
const ZOD_FAIL_STATUS = { request: 400, response: 500 } as const

/** Zod のバリデーションエラーを 400 (request) / 500 (response) の LambdaResponse に変換する。 */
export const zodFail = (label: keyof typeof ZOD_FAIL_STATUS, error: z.ZodError): LambdaResponse => ({
  statusCode: ZOD_FAIL_STATUS[label],
  body: JSON.stringify({ error: `Invalid ${label}`, issues: error.issues })
})

/**
 * request schema で入力を検証 → ハンドラ実行 → response schema で出力を検証 して返す共通ラッパー。
 * request 失敗は 400、response 失敗は 500、ハンドラが {@link UpstreamError} を throw した場合は 502。
 * それ以外のハンドラ内 throw は呼び出し元 handler の catch で 500 化される。
 */
export async function handleRoute<Req, Res>(
  body: unknown,
  requestSchema: z.ZodType<Req>,
  responseSchema: z.ZodType<Res>,
  run: (input: Req) => Promise<Res>
): Promise<LambdaResponse> {
  const requestParsed = requestSchema.safeParse(body)
  if (!requestParsed.success) return zodFail('request', requestParsed.error)

  let output: Res
  try {
    output = await run(requestParsed.data)
  } catch (e) {
    if (e instanceof UpstreamError) return fail(502, e.message)
    throw e
  }

  const responseParsed = responseSchema.safeParse(output)
  if (!responseParsed.success) return zodFail('response', responseParsed.error)
  return ok(responseParsed.data)
}

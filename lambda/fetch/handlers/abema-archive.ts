/**
 * `/abema_archive` ハンドラ。
 * ABEMA のアーカイブ配信 (programId) について、HLS variant URL / decryption key / segment 一覧を返す。
 * 並列上限あり: トークンリフレッシュを含む重い経路のため 4 並列に絞っている。
 */
import type { z } from 'zod'
import { getGuestSession } from '../../../src/lib/providers/abema/auth'
import { buildKeysArchive, fetchMediaToken } from '../../../src/lib/providers/abema/hls'
import type { FetchAbemaArchiveResponseSchema } from '../../../src/schemas/lambda.dto'
import { runWithConcurrency } from '../http'
import { logger } from '../logger'

/** `/abema_archive` のレスポンス型。`FetchAbemaArchiveResponseSchema` (lambda.dto) から導出する。 */
type FetchAbemaArchiveResponse = z.infer<typeof FetchAbemaArchiveResponseSchema>

/** ABEMA archive fetch の並列上限。トークンリフレッシュを含む重い経路のため控えめに設定。 */
const ABEMA_ARCHIVE_CONCURRENCY = 4

/**
 * ABEMA のアーカイブ配信について、指定 programId 群の HLS 情報と decryption key を取得する。
 * 並列上限は {@link ABEMA_ARCHIVE_CONCURRENCY}。1 件でも失敗した場合はその要素だけ ok=false で返す。
 *
 * @param programIds   ABEMA program ID の配列
 * @param targetHeight 希望する variant の縦解像度。0 の場合は provider 側のデフォルト。
 * @returns programId 順の結果配列
 */
export async function fetchAbemaArchives(programIds: string[], targetHeight = 0): Promise<FetchAbemaArchiveResponse> {
  const session = await getGuestSession()
  const mediaToken = await fetchMediaToken({ bearer: session.token })

  const results = await runWithConcurrency(programIds, ABEMA_ARCHIVE_CONCURRENCY, async (programId) => {
    try {
      // createdAt (Date) はレスポンスに含めない。それ以外のフィールドはそのまま通す
      const { createdAt: _createdAt, ...archive } = await buildKeysArchive({
        programId,
        mediaToken,
        deviceId: session.deviceId,
        targetHeight
      })
      return { programId, ok: true as const, archive }
    } catch (e) {
      return {
        programId,
        ok: false as const,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  })

  const okCount = results.filter((r) => r.ok).length
  logger.info({
    action: 'fetch-abema-archives',
    total: programIds.length,
    ok: okCount,
    fail: programIds.length - okCount
  })
  return { results }
}

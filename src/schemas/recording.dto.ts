import { z } from 'zod'

export const UpdateRecordingSchema = z.object({
  episodeId: z.string(),
  recorded: z.boolean()
})
export type UpdateRecordingSchema = z.infer<typeof UpdateRecordingSchema>

export const BulkUpdateRecordingSchema = z.object({
  episodeIds: z.array(z.string()).min(1),
  recorded: z.boolean()
})
export type BulkUpdateRecordingSchema = z.infer<typeof BulkUpdateRecordingSchema>

/**
 * `episodes.record_status` が取りうる値。文字列カラムなので DB 側に制約は無く、
 * **ここが唯一の一覧**。状態を増やすときは遷移を書ける経路 (record-intent /
 * job-sync / library-sync) のどれが書くのかを決めてから足すこと。
 */
export const RecordStatusEnum = z.enum(['none', 'pending', 'downloading', 'completed', 'failed', 'stale', 'missing'])
export type RecordStatus = z.infer<typeof RecordStatusEnum>

/**
 * 差分同期がどこまで進んでいるか (`sync_state` の 'library' 行) と、
 * その結果できあがった状態の内訳。
 *
 * 時刻は全て ISO 文字列で返す。Date のまま返すと Hono の JSON 化で
 * 型と実体がずれる (OpenAPI 上は string なのに z.date() が通ってしまう)。
 */
export const RecordingSyncStateSchema = z.object({
  /** 台帳同期を一度も走らせていない場合は null */
  cursor: z.string().nullable(),
  /**
   * 非 null なら初回スナップショットを捲っている途中。
   * この間は差分カーソルがまだ動かないので、遅れているように見えても正常。
   */
  snapshotCursor: z.string().nullable(),
  snapshotStartedAt: z.string().nullable(),
  /** 最後に「エラー無しで終わった」時刻。ここが古いと同期が止まっている */
  lastSucceededAt: z.string().nullable(),
  /** 実行中ロックの期限。現在時刻より先なら誰かが走っている */
  leaseUntil: z.string().nullable(),
  leaseOwner: z.string().nullable(),
  /** record_status ごとの件数。0 件の状態も必ず出す (欠けと 0 を区別するため) */
  counts: z.record(RecordStatusEnum, z.number().int()),
  /** 追跡中 (pending / downloading) のうち job id を持つ行数 */
  tracked: z.number().int()
})
export type RecordingSyncState = z.infer<typeof RecordingSyncStateSchema>

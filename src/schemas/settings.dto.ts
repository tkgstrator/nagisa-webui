import { z } from 'zod'

/** `GET/PUT /api/settings/recording`。サーバーが保存する録画設定 */
export const RecordingSettingsSchema = z.object({
  /** 予約済み作品の新着エピソードを自動で録画に回すか。未保存なら true */
  autoScheduleNewEpisodes: z.boolean()
})

export type RecordingSettings = z.infer<typeof RecordingSettingsSchema>

import type { PrismaClient } from '../generated/prisma/client.ts'

/** 新着エピソードの自動録画 (予約済み作品の cron 掃引 / update 直後の送信) を行うか */
export const AUTO_SCHEDULE_KEY = 'autoScheduleNewEpisodes'

/** 行が無いときの既定。自動録画はこの設定を足す前から動いていたので ON を維持する */
export const AUTO_SCHEDULE_DEFAULT = true

type Db = Pick<PrismaClient, 'appSetting'>

export async function getAutoScheduleNewEpisodes(prisma: Db): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key: AUTO_SCHEDULE_KEY } })
  if (!row) return AUTO_SCHEDULE_DEFAULT
  return row.value === 'true'
}

export async function setAutoScheduleNewEpisodes(prisma: Db, enabled: boolean): Promise<void> {
  const value = String(enabled)
  await prisma.appSetting.upsert({
    where: { key: AUTO_SCHEDULE_KEY },
    create: { key: AUTO_SCHEDULE_KEY, value },
    update: { value }
  })
}

import type { createPrismaClient } from '../db'
import { getAppLogger } from '../logger'
import { JELLYFIN_STATE_KEY } from './dirty'

const logger = getAppLogger('jellyfin')

type Prisma = ReturnType<typeof createPrismaClient>

/**
 * `jellyfin_refresh_state` の行を保証する。dirty を立てる UPDATE は行が無いと何もしないため。
 * 台帳同期の副作用なので **throw しない** (失敗しても同期を止めない)。
 */
export async function ensureRefreshState(prisma: Prisma): Promise<void> {
  try {
    await prisma.jellyfinRefreshState.upsert({
      where: { key: JELLYFIN_STATE_KEY },
      create: { key: JELLYFIN_STATE_KEY },
      update: {}
    })
  } catch (e) {
    logger.error({ action: 'jellyfin-state-ensure-error', error: e instanceof Error ? e.message : String(e) })
  }
}

import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * 実行 (sync_runs の 1 行) ごとの文脈。LogTape の implicit context としても使うので
 * (src/lib/logger.ts の contextLocalStorage)、中に入れた値は run 中の全ログの properties に載る。
 * ログ本体は Workers Logs に出るだけで D1 には保存しない。生ログタブは
 * Workers Observability の Telemetry API で `properties.runId` を引いて run と結び付ける。
 */
export interface RunContext extends Record<string, unknown> {
  runId: string | null
}

export const runContextStorage = new AsyncLocalStorage<Record<string, unknown>>()

/** `fn` の実行中を `runId` の run として扱う。非同期の子も同じ文脈を見る。 */
export function runWithContext<T>(runId: string | null, fn: () => Promise<T>): Promise<T> {
  const ctx: RunContext = { runId }
  return runContextStorage.run(ctx, fn)
}

/** 実行中の run の id。run の外 (通常の fetch / Lambda) では null。 */
export function currentRunId(): string | null {
  const runId = runContextStorage.getStore()?.runId
  return typeof runId === 'string' ? runId : null
}

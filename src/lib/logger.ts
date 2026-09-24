import { configureSync, getConsoleSink, getJsonLinesFormatter, getLogger } from '@logtape/logtape'
import { runContextStorage } from './run-context'

/** LogTape を初期化する。Worker のエントリポイントで一度だけ呼ぶ。 */
export function setupLogger(): void {
  configureSync({
    reset: true,
    sinks: {
      console: getConsoleSink({ formatter: getJsonLinesFormatter() })
    },
    // run の中で出たログには properties.runId が付く (src/lib/run-context.ts)。
    // 生ログタブはこれで Workers Logs から run 単位に引く。
    contextLocalStorage: runContextStorage,
    loggers: [
      {
        category: ['app'],
        lowestLevel: 'debug',
        sinks: ['console']
      },
      // LogTape 自身の診断ログ。info は起動のたびに出るので warning 以上だけ拾う
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console']
      }
    ]
  })
}

/** アプリケーション用ロガーを取得する */
export function getAppLogger(category: string) {
  return getLogger(['app', category])
}

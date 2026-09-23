import { configureSync, getConsoleSink, getJsonLinesFormatter, getLogger } from '@logtape/logtape'
import { pushEntry } from './log-capture'

/** LogTape を初期化する。Worker のエントリポイントで一度だけ呼ぶ。 */
export function setupLogger(): void {
  configureSync({
    reset: true,
    sinks: {
      console: getConsoleSink({ formatter: getJsonLinesFormatter() }),
      // D1 への保存。実行コンテキストに capture store が無ければ何もしない
      // (Lambda / 通常の fetch など)。詳細は src/lib/log-capture.ts。
      capture: pushEntry
    },
    loggers: [
      {
        category: ['app'],
        lowestLevel: 'debug',
        sinks: ['console', 'capture']
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

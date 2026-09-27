import { type IntlayerConfig, Locales } from 'intlayer'

// intlayer 既定の除外 (@intlayer/config の EXCLUDED_PATHS)。上書きすると既定が消えるので写しておく
const DEFAULT_EXCLUDED_PATHS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.intlayer/**', '**/.tanstack/**', '**/.output/**']
const HEAVY_DIRS = ['**/.cache/**', '**/.wrangler/**', '**/.claude/**', '**/.git/**', '**/screenshots/**', '**/__tests__/**']

// UI 文言は各コンポーネント隣の `*.content.ts` に集約する。
// 表示がおかしいときは該当画面の content ファイルだけを見ればよい。
const config: IntlayerConfig = {
  internationalization: {
    locales: [Locales.JAPANESE, Locales.ENGLISH],
    defaultLocale: Locales.JAPANESE
  },
  // 言語は URL にもストレージにも持たない。proxy を生かすと Hono / mock-diff の
  // middleware より手前でリクエストを書き換えに来るので切っておく。
  routing: {
    mode: 'no-prefix',
    enableProxy: false
  },
  // intlayer は既定でリポジトリ直下を丸ごと走査・監視する (content watcher は設定ファイルの
  // 置き場所 = ルートを @parcel/watcher で購読し、vite-intlayer は起動時にルートを fast-glob で
  // 同期走査する)。既定の除外は node_modules / dist 程度で .gitignore を見ないため、.cache
  // (~100 万ファイル) を舐めて dev server が CPU 100% に張り付く。重いディレクトリを明示的に外す。
  content: {
    contentDir: ['src/app'],
    excludedPath: [...DEFAULT_EXCLUDED_PATHS, ...HEAVY_DIRS]
  },
  build: {
    traversePattern: [
      '**/*.{tsx,ts,js,mjs,cjs,jsx}',
      ...DEFAULT_EXCLUDED_PATHS.map((p) => `!${p}`),
      ...HEAVY_DIRS.map((p) => `!${p}`),
      '!**/*.config.*',
      '!**/*.test.*',
      '!**/*.spec.*',
      '!**/*.d.ts'
    ]
  }
}

export default config

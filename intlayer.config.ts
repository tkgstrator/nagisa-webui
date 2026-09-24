import { type IntlayerConfig, Locales } from 'intlayer'

// UI 文言は各コンポーネント隣の `*.content.ts` に集約する。
// 表示がおかしいときは該当画面の content ファイルだけを見ればよい。
const config: IntlayerConfig = {
  internationalization: {
    locales: [Locales.JAPANESE],
    defaultLocale: Locales.JAPANESE
  },
  // 言語は URL にもストレージにも持たない。proxy を生かすと Hono / mock-diff の
  // middleware より手前でリクエストを書き換えに来るので切っておく。
  routing: {
    mode: 'no-prefix',
    enableProxy: false
  },
  content: {
    contentDir: ['src/app']
  }
}

export default config

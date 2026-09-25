import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import mockDiff from '@qtmleap/vite-plugin-mock-diff'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { intlayer } from 'vite-intlayer'

const version = JSON.parse(readFileSync('./package.json', 'utf-8')).version
const hash = execSync('git rev-parse --short HEAD').toString().trim()
const gitLog = execSync('git log --format="%h %aI %s" -50')
  .toString()
  .trim()
  .split('\n')
  .map((line) => {
    // noUncheckedIndexedAccess 下では分割代入の各要素が undefined を含むため既定値を置く。
    const [hash = '', date = '', ...rest] = line.split(' ')
    return { hash, date: date.slice(0, 10), message: rest.join(' ') }
  })

// mock-diff-viewer sidecar。ブラウザを経由しない経路なので compose のサービス名で届く。
const MOCK_DIFF_TARGET = 'http://mock-diff:3000'

export default defineConfig(({ mode }) => ({
  server: {
    port: 14755,
    // vite 5.4.12 以降は Host ヘッダが localhost 以外だと既定で 403 になる。mock-diff の
    // Playwright は actual をコンテナ名のホストで撮りに来るのでここに並べる
    // (compose のサービス名 `app` は使えない。Chromium が `.app` gTLD を HSTS preload
    // list に載せていて単一ラベルの `app` も一致するため、http:// が https:// に昇格され
    // TLS を話さない vite では net::ERR_SSL_PROTOCOL_ERROR になる)。
    allowedHosts: ['nagisa-webui_devcontainer-app-1'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
    // vite の既定の除外は .git / node_modules / test-results だけで .gitignore は見ない。
    // .cache (原本 ~100 万ファイル) を chokidar が舐めると inotify 90 万件・RSS 4GB で
    // CPU 100% に張り付くので、ソースを置かない巨大ディレクトリは明示的に外す。
    watch: {
      ignored: ['**/.cache/**', '**/.wrangler/**', '**/.claude/**', '**/dist/**', '**/screenshots/**'],
    },
  },
  plugins: [
    // viewer の UI はこの dev server の /mock-diff/ に相乗りさせる。専用のポートを公開
    // しないので mock-diff sidecar を持つ repo を何個同時に立てても衝突しない。
    // /mock-diff → 308 /mock-diff/、/mock-diff/... → prefix を外して sidecar へ、他は素通し。
    // 中で enforce: 'pre' しているが @cloudflare/vite-plugin より前に並べておく。
    mockDiff({ target: MOCK_DIFF_TARGET }),
    {
      name: 'build-info',
      buildStart() {
        console.log(`Environment: ${process.env.NODE_ENV}`)
        console.log(`Building app version: ${version} (git hash: ${hash}) in ${mode} mode`)
      },
      configureServer(server) {
        server.middlewares.use('/commits.json', (_req, res) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(gitLog))
        })
      },
      writeBundle() {
        const outDir = resolve(import.meta.dirname, 'dist/client')
        mkdirSync(outDir, { recursive: true })
        writeFileSync(resolve(outDir, 'commits.json'), JSON.stringify(gitLog))
      },
    },
    // Worker (src/index.ts の Hono API) をビルドする。クライアントは index.html を
    // 起点にした通常の SPA ビルドで、出力はどちらも dist/ 配下に分かれる
    // (クライアント = dist/client、Worker = dist/<worker 名>)。
    cloudflare({ configPath: './wrangler.toml' }),
    // tanstackRouter() は react() より前に置く必要がある
    // (ルート生成とコード分割の変換を React Refresh の変換前に走らせるため)。
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: 'src/app/routes',
      generatedRouteTree: 'src/app/routeTree.gen.ts',
      // 文言ファイルはルートと同じディレクトリに置くので、ルートとして拾わせない。
      routeFileIgnorePattern: '\\.content\\.ts$',
    }),
    react(),
    // src/app 配下の *.content.ts を辞書にまとめ、useIntlayer から引けるようにする。
    intlayer(),
    tailwindcss(),
  ],
  // `/engine` サブパスを明示しないと初回 dynamic import で
  // 「Failed to fetch dynamically imported module」になる (subpath は自動推定されない)。
  // engine.worker.ts がこれを動的 import する。
  // optimizeDeps: {
  //   include: ['@ultemica/yaneuraou-wasm-pthread-kp256/engine'],
  // },
  build: {
    target: 'esnext',
    minify: true,
  },
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_HASH__: JSON.stringify(hash),
    __GIT_DATE__: JSON.stringify(execSync('git log -1 --format=%aI').toString().trim()),
  },
}))

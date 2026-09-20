import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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

export default defineConfig(({ mode }) => ({
  server: {
    port: 14755,
    // mock-diff の Playwright は compose ネットワーク内から http://webui:14755/ を開くため
    // Host ヘッダが compose のサービス名 (webui) になる。vite 5.4.12 以降はこれを既定で
    // 403 で弾くので明示的に許可する。
    allowedHosts: ['webui'],
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  },
  plugins: [
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
    }),
    react(),
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

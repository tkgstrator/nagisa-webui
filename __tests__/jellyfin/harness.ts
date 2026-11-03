import { Database } from 'bun:sqlite'
import { mock } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '../../src/generated/prisma/client.ts'

const WASM_PATH = join(import.meta.dirname, '../../src/generated/prisma/internal/query_compiler_fast_bg.wasm')

// Prisma (runtime = cloudflare) の query compiler は `.wasm?module` を import する。workerd 以外では
// WebAssembly.Module にならないので、同じ .wasm を自前でコンパイルした Module に差し替える。
mock.module('../../src/generated/prisma/internal/query_compiler_fast_bg.wasm?module', () => ({
  default: new WebAssembly.Module(readFileSync(WASM_PATH))
}))

/** 1 テストあたりの上限。スタブ・Miniflare が残らないよう、必ず afterAll で閉じる。 */
export const TEST_TIMEOUT_MS = 30_000

export interface StubJellyfin {
  server: Server
  url: string
  /** 受け取ったリクエスト (path / method / Authorization) */
  requests: { method: string; path: string; authorization: string | undefined }[]
  /** 次以降の応答ステータス。0 は接続を即切断 (接続断) */
  respondWith: (status: number) => void
  /** 応答を返す前に 1 回だけ実行する処理 (送信中に別の更新が入る状況の再現用) */
  beforeNextResponse: (fn: () => Promise<unknown>) => void
  close: () => Promise<void>
}

/** ローカルのスタブ Jellyfin。実機には一切接続しない。127.0.0.1 の空きポートで待つ。 */
export async function startStubJellyfin(): Promise<StubJellyfin> {
  const state = { status: 204, hook: null as (() => Promise<unknown>) | null }
  const requests: StubJellyfin['requests'] = []
  const server = createServer(async (req, res) => {
    requests.push({ method: req.method ?? '', path: req.url ?? '', authorization: req.headers.authorization })
    if (state.status === 0) {
      req.socket.destroy()
      return
    }
    const hook = state.hook
    state.hook = null
    await hook?.()
    res.statusCode = state.status
    res.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    requests,
    respondWith: (status) => {
      state.status = status
    },
    beforeNextResponse: (fn) => {
      state.hook = fn
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      })
  }
}

type SqlValue = string | number | bigint | null | Uint8Array

/**
 * D1 の最小互換 (Prisma の D1 adapter が使う prepare/bind/run/raw/exec だけ)。
 * 実体は bun:sqlite のインメモリ DB。Miniflare / workerd を立てないので常駐物が残らない。
 */
function createD1Shim(sqlite: Database): D1Database {
  const statement = (sql: string, args: SqlValue[]) => ({
    bind: (...next: SqlValue[]) => statement(sql, next),
    run: async () => {
      const r = sqlite.prepare(sql).run(...args)
      return {
        success: true,
        results: [],
        meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) }
      }
    },
    raw: async (opts?: { columnNames?: boolean }) => {
      const stmt = sqlite.prepare(sql)
      const rows = stmt.values(...args) as unknown[][]
      return opts?.columnNames ? [stmt.columnNames, ...rows] : rows
    }
  })
  return {
    prepare: (sql: string) => statement(sql, []),
    exec: async (script: string) => {
      sqlite.run(script)
      return { count: 1, duration: 0 }
    }
  } as unknown as D1Database
}

/** インメモリ DB に migration を全部流した Prisma クライアントを返す。
 * src/lib/db は他のテストが mock.module で差し替える (プロセス全体に効く) ので、ここでは経由しない。 */
export async function createTestDb() {
  const sqlite = new Database(':memory:')
  const db = createD1Shim(sqlite)
  const root = join(import.meta.dirname, '../../prisma/migrations')
  for (const dir of readdirSync(root).sort()) {
    const file = join(root, dir, 'migration.sql')
    if (existsSync(file)) sqlite.run(readFileSync(file, 'utf8'))
  }
  return {
    db,
    prisma: new PrismaClient({ adapter: new PrismaD1(db) }),
    /** 全テーブルを空にする (テストごとに新しい DB を作り直すのと同じ初期状態) */
    reset: () => {
      const tables = sqlite
        .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
      for (const { name } of tables) sqlite.run(`DELETE FROM "${name}"`)
    },
    close: () => sqlite.close()
  }
}

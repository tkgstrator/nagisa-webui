import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '../../src/generated/prisma/client.ts'
import { createTestDb } from '../jellyfin/harness'

/** D1 の「1 クエリ 100 バインド変数」上限 */
export const D1_BIND_LIMIT = 100

type Stmt = { bind: (...args: unknown[]) => Stmt }

/**
 * bun:sqlite 上の D1 互換 DB を、バインド数が上限を超えたら D1 と同じエラーで落ちるラッパで包む。
 * 実際に流れた各クエリのバインド数は `binds` に残る。
 */
export async function createLimitedDb() {
  const base = await createTestDb()
  const binds: { sql: string; count: number }[] = []
  const wrap = (sql: string, stmt: Stmt): Stmt =>
    new Proxy(stmt, {
      get: (target, prop, receiver) => {
        if (prop !== 'bind') return Reflect.get(target, prop, receiver)
        return (...args: unknown[]) => {
          binds.push({ sql, count: args.length })
          if (args.length > D1_BIND_LIMIT) throw new Error(`D1_ERROR: too many SQL variables (${args.length})`)
          return wrap(sql, target.bind(...args))
        }
      }
    })
  const db = new Proxy(base.db, {
    get: (target, prop, receiver) => {
      if (prop !== 'prepare') return Reflect.get(target, prop, receiver)
      return (sql: string) => wrap(sql, target.prepare(sql) as unknown as Stmt)
    }
  })
  return { ...base, binds, prisma: new PrismaClient({ adapter: new PrismaD1(db) }) }
}

/**
 * nagisa の録画台帳 (GET /api/library/*) を D1 に取り込む。
 *
 * 設計は docs/features/recording-sync.md §7。要点だけ再掲する:
 *
 * - **`completed` を書けるのはこの経路だけ。** キューからジョブが消えたことは
 *   成功を意味しない (スキップ・途中失敗・ワーカー再起動と区別できない)。
 *   ファイルの実在を言えるのは台帳の upsert イベントだけ。
 * - **消失は tombstone でしか書かない。** 「応答に含まれていない」は
 *   ページ切れ・引き損ねと区別できず、1 回の取得失敗で無関係の作品が
 *   丸ごと `missing` になる事故を作る。
 * - **カーソルは不透明トークン**。失効判定は nagisa が 410 / 409 で返す契約で、
 *   Workers 側が中身を解釈すると必ずずれる。
 * - **適用とカーソル保存は同じバッチ**に入れる。先にエピソードを書いてから
 *   カーソルを別 UPDATE すると、間で落ちたぶんが永久に失われる。
 * - **エピソードの書き込みにも lease 条件を付ける** (raw SQL の `EXISTS`)。
 *   カーソル更新だけを fencing しても、横取りされた run の書き込みは
 *   コミットされてしまう (D1 の batch は「0 件更新だからロールバック」ができない)。
 *   同じ条件を同じバッチの全文に載せて初めて「書かないなら進めない」が揃う。
 */

import { Prisma as PrismaSql } from '../generated/prisma/client.ts'
import {
  type NagisaLibraryChange,
  NagisaLibraryChangesSchema,
  type NagisaLibraryItem,
  NagisaLibrarySnapshotSchema
} from '../schemas/nagisa.dto'
import type { createPrismaClient } from './db'
import { getAppLogger } from './logger'
import { fetchNagisaRaw, NagisaConfigError, type NagisaEnv } from './nagisa-client'

const logger = getAppLogger('library-sync')

type Prisma = ReturnType<typeof createPrismaClient>

const SYNC_KEY = 'library'
/**
 * ページサイズと 1 run のページ数。
 *
 * 上限を決めているのは D1 の **Queries per Worker invocation = 1000**。
 * 台帳の 1 行につき `updateMany` が 1 文できる (値が行ごとに違うので 1 文に
 * 畳めない) ので、`ページサイズ × ページ数` がそのままクエリ数になる。
 * 余裕を見て 1 run 600〜700 文に収める。足りないぶんは次 tick が続きを読む。
 */
const CHANGES_LIMIT = 100
const MAX_PAGES_PER_RUN = 5
/** bootstrap のページサイズ。録画実体 3,000 件なら 5 run (cron で 75 分) で終わる。 */
const SNAPSHOT_LIMIT = 200
const MAX_SNAPSHOT_PAGES_PER_RUN = 3
/**
 * `IN (...)` に並べる値の上限。D1 の **bound parameters per query = 100** に
 * 収めるための分割幅。ページサイズぶんの id をそのまま `in:` に渡すと
 * この上限を超えて実行時に落ちる。
 */
const IN_CHUNK = 90
/** lease の保持時間。これを過ぎた run は死んだものとして横取りされる。 */
const LEASE_MS = 10 * 60_000
/** completed のうちこの割合を超える削除が来たら適用せず中断する。 */
const MASS_DELETE_RATIO = 0.1
/**
 * 大量削除ガードの下駄。手持ちが数件しかない時期に比率だけで判定すると、
 * 正当な削除 1 件で同期が永久に止まる。これ以下の件数は常に適用する。
 */
const MASS_DELETE_MIN = 20
/** 変更が無い tick で lastSucceededAt を書き直す間隔 (書き込み量の節約)。 */
const HEARTBEAT_MS = 60 * 60_000
/**
 * 1 run で発行する UPDATE 文の累計上限。
 *
 * ページ数とページサイズだけでは文数を抑えきれない: 台帳の 1 行に複数の
 * エピソードがぶら下がると `chunk(ids, IN_CHUNK)` でさらに分かれるので、
 * 200 件のページが 200 文で済む保証が無い。ページの区切りで実測値を見て
 * 打ち切る (カーソルは適用できたところまで進んでいるので、次 run が続きを読む)。
 */
const MAX_WRITES_PER_RUN = 600
/**
 * 1 トランザクションに積む UPDATE 文の上限。
 *
 * :data:`MAX_WRITES_PER_RUN` は **ページを適用し終えてから** 見る数字なので、
 * 1 ページが単独で膨らむ場合には効かない。台帳の 1 行が数十のエピソードに
 * 解決されると (重複登録の多い作品) 1 ページの文数はページサイズを軽く超える。
 * バッチが大きすぎると D1 の queries per invocation (1000) に当たって run ごと
 * 落ちるので、この幅で割って順に流す。
 */
const MAX_WRITES_PER_BATCH = 300
/**
 * 1 ページを適用するのに許す UPDATE 文の上限。これを超えたら降りる。
 *
 * 分割して流せば普通に太いページは通せるが、それでも上限は要る: 台帳の 1 行が
 * 数千のエピソードに解決される (episode_id の取り違え等) と、分割しても 1 run の
 * クエリ数が D1 の上限を超えて落ち、カーソルが進まないので毎回同じページで
 * 落ち続ける。データ側の異常なので **1 行も書かずに降りて記録を残す**。
 * 同じ止まるなら落ちるより `aborted` が `SyncRun` に残るほうが直せる。
 */
const MAX_WRITES_PER_PAGE = 900

export interface LibrarySyncResult {
  /** lease を取れずに何もしなかった */
  skipped: boolean
  /** bootstrap が走った理由。走らなければ null */
  bootstrap: string | null
  pages: number
  upserts: number
  deletes: number
  /** 該当するエピソードが D1 に無かったイベント数 (§7-5) */
  unmatched: number
  aborted: string | null
  error: string | null
}

const emptyResult = (): LibrarySyncResult => ({
  skipped: false,
  bootstrap: null,
  pages: 0,
  upserts: 0,
  deletes: 0,
  unmatched: 0,
  aborted: null,
  error: null
})

/** `IN (...)` を D1 の bound parameter 上限に収めるために分ける。 */
function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}

/**
 * Prisma (D1 adapter) が DateTime 列に書く表現。raw SQL 側もこれに揃える。
 *
 * 実測すると D1 上の型は **TEXT** で、値は `2026-09-23T06:04:55.174+00:00` の形。
 * epoch ms の INTEGER ではないので、raw で日時を比較するときに
 * `Date.now()` をそのまま渡すと常に偽になる。オフセットは `+00:00` 固定・
 * 桁数も固定なので、この形どうしなら辞書順がそのまま時刻順になる
 * (`toISOString()` の `Z` のままだと `+` と綴りが変わって境界がずれる)。
 */
const sqlDate = (d: Date): string => d.toISOString().replace('Z', '+00:00')

/**
 * 掃き出しの基準時刻より **確実に後** の時刻を作る。
 *
 * 在籍判定は `record_synced_at <= sweepFrom` なら掃く、で書いてある。等号を
 * 含めるのは、基準時刻ちょうどに書かれた行 (前回の run が同じミリ秒で落ちた等)
 * を取りこぼさないため。そのぶん、**今回のページが書く時刻は基準時刻と
 * 同じであってはならない**。基準を置いた直後にページが返ってくると同じ
 * ミリ秒になりうるので、ここで 1ms だけ進めておく。
 */
const stamp = (after: Date): Date => new Date(Math.max(Date.now(), after.getTime() + 1))

/** この run で発行済みの UPDATE 文の数。bootstrap と差分適用で共有する。 */
const writesSoFar = (r: LibrarySyncResult): number => r.upserts + r.deletes

/**
 * エピソード更新に付ける fencing 条件。**バインドは 2 個** (owner と期限)。
 *
 * カーソル更新側の `leaseWhere` と同じことを SQL で書いたもの。同じバッチに
 * 入れた全文がこの条件を共有するので、lease を失った run は
 * 「エピソードも書かない・カーソルも進めない」のどちらも成立する。
 * Prisma の `updateMany` では relation でない列の EXISTS を書けないため、
 * ここだけ raw SQL を使う。
 */
const leaseGuard = (owner: string, now: Date) =>
  PrismaSql.sql`AND EXISTS (SELECT 1 FROM sync_state WHERE key = 'library' AND lease_owner = ${owner} AND lease_until > ${sqlDate(now)})`

/** nagisa の mtime は ISO 8601 文字列。壊れていたら null にして同期は止めない。 */
function parseMtime(mtime: string | null): Date | null {
  if (!mtime) return null
  const d = new Date(mtime)
  return Number.isNaN(d.getTime()) ? null : d
}

/** バイトだと 2GB で Int が溢れるので MB に落とす (schema のコメント参照)。 */
const toMb = (size: number): number => Math.round(size / 1024 / 1024)

/** 台帳の 1 行を D1 のエピソードに対応づけるためのキー。 */
type MatchKey = string
const matchKey = (provider: string, contentId: string, episodeId: string): MatchKey =>
  `${provider}\u0000${contentId}\u0000${episodeId}`

interface LedgerRow {
  recordingId: string
  item: NagisaLibraryItem
}

/** `$transaction([...])` に並べる 1 文。raw も updateMany も同じ形で扱える。 */
type Write = PrismaSql.PrismaPromise<unknown>

/**
 * 同じエピソードを指す台帳行が 2 つあったとき、`candidate` が `held` に勝つか。
 *
 * 新しい実体を正とする (= `mtime` の新しい方)。`mtime` が読めない行は負ける:
 * 消えかけのファイルや壊れたメタデータを、読めた行より優先する理由が無い。
 * 両方読めないときと同着は `recording_id` の大きい方 — 意味は無いが、
 * **ページの並びが変わっても同じ勝者になる**ことだけが要る。
 */
function beatsCurrent(candidate: LedgerRow, held: LedgerRow): boolean {
  const a = parseMtime(candidate.item.mtime)?.getTime()
  const b = parseMtime(held.item.mtime)?.getTime()
  if (a !== b) {
    if (a === undefined) return false
    if (b === undefined) return true
    return a > b
  }
  return candidate.recordingId > held.recordingId
}

/**
 * 台帳の行に対応する D1 のエピソード id を引く。
 *
 * `episode_id` は indexed なので IN 1 本で引き、provider / content_id の一致は
 * JS 側で確かめる。relation filter を `updateMany` の where に書くと
 * Prisma が暗黙の SELECT を挟み、`$transaction([...])` の原子性が崩れる。
 */
async function resolveEpisodes(prisma: Prisma, rows: LedgerRow[]): Promise<Map<MatchKey, string[]>> {
  const episodeIds = [...new Set(rows.map((r) => r.item.episode_id).filter((v): v is string => !!v))]
  if (episodeIds.length === 0) return new Map()

  const pages = await Promise.all(
    chunk(episodeIds, IN_CHUNK).map((part) =>
      prisma.episode.findMany({
        where: { episodeId: { in: part } },
        select: {
          id: true,
          episodeId: true,
          season: { select: { anime: { select: { provider: true, contentId: true } } } }
        }
      })
    )
  )
  const found = pages.flat()

  const byKey = new Map<MatchKey, string[]>()
  for (const e of found) {
    const anime = e.season?.anime
    if (!anime) continue
    const key = matchKey(anime.provider, anime.contentId, e.episodeId)
    const list = byKey.get(key)
    if (list) list.push(e.id)
    else byKey.set(key, [e.id])
  }
  return byKey
}

/**
 * upsert イベント群を D1 の書き込みに変換する。
 *
 * 該当 0 件でも失敗にしない。nagisa にしか無い録画 (Workers が追跡していない作品、
 * content_id を復元できなかった行) が同期を止めてはいけない (§7-5)。
 */
function buildUpsertWrites(
  prisma: Prisma,
  rows: LedgerRow[],
  resolved: Map<MatchKey, string[]>,
  now: Date,
  owner: string,
  /**
   * 既に入っている録画より古い行では上書きしない (snapshot 経路だけ true)。
   *
   * 下の `beatsCurrent` が決めるのは **1 ページの中の**勝者でしかない。
   * snapshot はページ間に順序が無いので、ページ 1 で書いた新しい録画 A を
   * ページ 2 の古い録画 B が上書きしうる。あとから B の tombstone が届くと、
   * A が実在するのにエピソードが `missing` に落ちる。SQL 側でも mtime を
   * 比べて、同じ規則 (新しい方が勝つ) を全ページに広げる。
   *
   * 変更ログ経路では **付けない**。あちらは seq の順序が正しさの根拠で、
   * 「B を消して A を置いた」が `delete B` → `upsert A` の順で届く。mtime で
   * 弾くと upsert だけ落ちて delete が通り、missing に化ける。
   */
  skipOlder: boolean
): { writes: Write[]; unmatched: number } {
  const writes: Write[] = []
  const guard = leaseGuard(owner, now)
  let unmatched = 0

  // **同じエピソードを指す台帳行が 1 ページに 2 つ以上来ることがある** (録り直して
  // パスが変わった、別シーズン表記で二重に登録されている等)。素直に順へ書くと
  // 最後に処理した行が勝ち、`recording_id` がページの並び任せになる —
  // tombstone はこの id で引くので、負けた方の消失が届いても 1 行も当たらない。
  // 勝者をここで決めておく (→ `beatsCurrent`)。
  const winners = new Map<string, LedgerRow>()

  for (const row of rows) {
    const { provider, content_id, episode_id } = row.item
    if (!content_id || !episode_id) {
      unmatched++
      continue
    }
    const ids = resolved.get(matchKey(provider, content_id, episode_id))
    if (!ids || ids.length === 0) {
      unmatched++
      continue
    }
    // 1 つの台帳行に複数のエピソードがぶら下がることもある (同じ作品が別 season に
    // 重複登録されている等)。こちらは全件に書く。
    for (const id of ids) {
      const held = winners.get(id)
      if (held === undefined || beatsCurrent(row, held)) winners.set(id, row)
    }
  }

  // 勝った行ごとにまとめ直してから書く。1 エピソード 1 文にはしない: ふつうは
  // 1 行が 1 エピソードなので分割は起きず、重複登録の作品だけ束ねられる。
  //
  // バインド数は **値 5 + 新旧比較 2 + id 90 + lease 2 = 99**。定数 (status / source /
  // recorded) は SQL リテラルで書いて枠を空けてある。IN_CHUNK を上げると 100 を
  // 超えて落ちる。
  const byRow = new Map<LedgerRow, string[]>()
  for (const [episodeId, row] of winners) {
    const list = byRow.get(row)
    if (list) list.push(episodeId)
    else byRow.set(row, [episodeId])
  }

  for (const [row, ids] of byRow) {
    const recordedAt = parseMtime(row.item.mtime)
    // 既に入っている録画との比較。mtime を読めなかった行 (`null`) は比較が
    // NULL になるのでどの完了行にも勝てない — ページ内の `beatsCurrent` と
    // 同じ「読めない mtime は負ける」規則になる。
    //
    // 勝ちは **厳密に新しいとき** だけ。等号で通すと、同じ mtime の別録画が
    // ページ 1 の勝者を上書きできてしまい (ページ内なら `recordingId` で裁ける
    // タイが、ページ間では裁けない)、負けた方の tombstone で実体のある
    // エピソードが missing に落ちる。代わりに **同じ録画 (`recording_id` 一致) は
    // 常に通す**ので、パスや容量だけが変わった再走査は mtime 据え置きでも入る。
    const older =
      skipOlder && recordedAt
        ? PrismaSql.sql`AND (record_status <> 'completed' OR recorded_at IS NULL OR recorded_at < ${sqlDate(recordedAt)} OR recording_id = ${row.recordingId})`
        : skipOlder
          ? PrismaSql.sql`AND (record_status <> 'completed' OR recorded_at IS NULL OR recording_id = ${row.recordingId})`
          : PrismaSql.empty
    for (const part of chunk(ids, IN_CHUNK)) {
      writes.push(
        prisma.$executeRaw`
          UPDATE episodes SET
            record_status = 'completed',
            record_source = 'reconcile',
            recorded = 1,
            record_error = NULL,
            recording_id = ${row.recordingId},
            record_path = ${row.item.path},
            record_size_mb = ${toMb(row.item.size)},
            recorded_at = ${recordedAt ? sqlDate(recordedAt) : null},
            record_synced_at = ${sqlDate(now)}
          WHERE id IN (${PrismaSql.join(part)}) ${older} ${guard}`
      )
    }
  }

  // **在籍の印だけは負けた行にも押す**。上の `older` で弾かれた行は 1 列も
  // 書き換わらないので `record_synced_at` が bootstrap 開始より古いままになり、
  // 掃き出し (`buildSweep`) が「今回の台帳に居なかった」とみなして `missing` に
  // 落としてしまう — 台帳に(古い録画として)確かに居るのに、である。
  // ここで触れた事実だけを別文で刻んでおけば、掃き出しの対象から外れる。
  //
  // ページ全体の id をまとめて 90 件ずつ (バインドは時刻 1 + id 90 + lease 2 = 93)。
  // 勝った行にも重ねて当たるが、同じ `now` を書くだけなので結果は変わらない。
  // 対象は掃き出しと同じ completed だけ。走行中 (pending / downloading) の行まで
  // 触ると、job-sync の猶予とページ送りの起点 (`recordSyncedAt`) を横から動かす。
  // 変更ログ経路には掃き出しが無い (かつ全行が必ず書かれる) ので付けない。
  if (skipOlder) {
    for (const part of chunk([...winners.keys()], IN_CHUNK)) {
      writes.push(
        prisma.$executeRaw`
          UPDATE episodes SET record_synced_at = ${sqlDate(now)}
          WHERE id IN (${PrismaSql.join(part)}) AND record_status = 'completed' ${guard}`
      )
    }
  }
  return { writes, unmatched }
}

/**
 * tombstone を適用する。`recording_id` は upsert を適用したときに控えてあるので、
 * パスの表記揺れに依存せずに引ける。completed 以外は触らない
 * (再指示で pending に戻っている話を missing に引き戻さないため)。
 */
const buildDeleteWrite = (prisma: Prisma, recordingId: string, now: Date, owner: string): Write =>
  prisma.$executeRaw`
    UPDATE episodes SET
      record_status = 'missing',
      record_source = 'reconcile',
      recorded = 0,
      record_synced_at = ${sqlDate(now)}
    WHERE recording_id = ${recordingId} AND record_status = 'completed' ${leaseGuard(owner, now)}`

/**
 * lease をまだ握っているかを確かめる。
 *
 * **正しさを担保しているのはこれではない** (書き込み側の `leaseGuard` が担う)。
 * ここで見るのは「無駄な往復を早めに切り上げる」ためと、掃き出しの比率ガードを
 * 誤爆させないため。横取りされた run は仮にここを通っても 1 行も書けない。
 */
async function holdsLease(prisma: Prisma, owner: string): Promise<boolean> {
  const s = await prisma.syncState.findUnique({
    where: { key: SYNC_KEY },
    select: { leaseOwner: true, leaseUntil: true }
  })
  return s?.leaseOwner === owner && s.leaseUntil !== null && s.leaseUntil.getTime() > Date.now()
}

/**
 * `sync_state` を書くときの fencing 条件。所有者だけでなく **期限も** 見る。
 * owner 条件だけだと、誰も横取りしないまま期限切れになった run (Worker が長く
 * 詰まった等) が自分の名義のまま書けてしまい、holdsLease の判定とカーソル更新の
 * 判定がずれる。`leaseUntil` が null の行もこの条件で弾ける。
 */
const leaseWhere = (owner: string, now: Date) => ({ key: SYNC_KEY, leaseOwner: owner, leaseUntil: { gt: now } })

/**
 * 1 ページぶんの書き込みを流す。文が多い回だけ複数のトランザクションに割り、
 * **カーソル更新 (`tail`) は必ず最後のバッチに置く**。返すのは最後のバッチの
 * 結果で、`fenced` はそれを見る。
 *
 * 分割するとページ単位の原子性は失われるが、取りこぼしは作らない: カーソルは
 * 最後のバッチでしか動かないので、途中で落ちた回は次 run が同じページを読み
 * 直す。upsert / tombstone はどちらも同じ値を書き直すだけの冪等な文なので、
 * 前半を二度適用しても結果は変わらない。
 *
 * **分割した回の `fenced` の意味は少し弱い**。1 バッチだったころは「tail が 0 件
 * = このページは 1 行も書いていない」と言えたが、分割後に言えるのは
 * 「**カーソルを進めていない**」まで。lease を途中で横取りされた run は、
 * 横取りより前のバッチだけ残して降りる。その前半は *まだ lease を持っていた
 * 時点の* 書き込みなので不正ではなく、しかも冪等なので新しい所有者が同じ
 * ページを読み直せば上書きされる。
 */
async function applyBatched(prisma: Prisma, writes: Write[], tail: Write[]): Promise<unknown[]> {
  // tail のぶんを引いて割る。引かないと最後のバッチだけ上限 + tail 件になる。
  const batches = chunk(writes, Math.max(1, MAX_WRITES_PER_BATCH - tail.length))
  if (batches.length === 0) batches.push([])
  let applied: unknown[] = []
  for (let i = 0; i < batches.length; i++) {
    const batch = i === batches.length - 1 ? [...batches[i], ...tail] : batches[i]
    if (batch.length === 0) continue
    applied = await prisma.$transaction(batch)
  }
  return applied
}

/**
 * 適用バッチの結果から「lease を失ったまま実行されたか」を見る。
 *
 * バッチの最後に置いた `syncState.updateMany` が 0 件なら、同じバッチの
 * エピソード更新も (同じ `leaseGuard` を共有しているので) 1 行も書いていない。
 * つまり **何も起きなかった** ことが確定する。復旧処理は要らず、降りるだけでよい。
 */
function fenced(applied: unknown[], result: LibrarySyncResult, phase: string): boolean {
  const last = applied.at(-1)
  const count = typeof last === 'object' && last !== null && 'count' in last ? (last as { count: number }).count : 1
  if (count > 0) return false
  logger.warn({ action: 'library-lease-lost', phase })
  result.aborted = 'lease_lost'
  return true
}

/** 410 / 409 の本文から nagisa のエラーコードを拾う (ログ用。判定はステータスで行う)。 */
async function readErrorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : `http_${res.status}`
  } catch {
    return `http_${res.status}`
  }
}

/**
 * bootstrap を完走したときの掃き出し (mark and sweep)。
 *
 * 差分が取りこぼされたまま (tombstone を引く前にカーソルが失効した等) だと、
 * 実体の消えた録画が `completed` のまま永久に残る。全件スナップショットを
 * 見終えた回だけは「台帳に居なかった」と断言できるので、ここで落とす。
 *
 * 判定材料は `recordSyncedAt`: bootstrap 開始時刻より古い completed は、
 * 今回のスナップショットのどのページにも出てこなかった行を意味する。
 * mass_delete と同じ比率ガードを掛け、疑わしい規模なら掃かずに記録だけ残す
 * (カーソルは進める。次の差分が正しければ自然に収束する)。
 */
async function buildSweep(
  prisma: Prisma,
  since: Date,
  now: Date,
  owner: string,
  result: LibrarySyncResult
): Promise<Write[]> {
  // 境界は等号込み。ページの書き込み時刻は `stamp(sweepFrom)` で必ず基準より後に
  // ずらしてあるので、基準ちょうどの `recordSyncedAt` は「今回のスナップショットで
  // 触れていない行」だけを指す。`<` のままだと、基準と同じミリ秒に書かれた
  // (= bootstrap 開始と同時刻に他所が触った) 行が永久に掃かれずに残る。
  const where = {
    recordStatus: 'completed',
    OR: [{ recordSyncedAt: null }, { recordSyncedAt: { lte: since } }]
  }
  const orphans = await prisma.episode.count({ where })
  if (orphans === 0) return []

  const completed = await prisma.episode.count({ where: { recordStatus: 'completed' } })
  if (orphans > MASS_DELETE_MIN && orphans > completed * MASS_DELETE_RATIO) {
    logger.error({ action: 'library-sweep-abort', orphans, completed })
    result.aborted = 'mass_sweep'
    return []
  }

  logger.info({ action: 'library-sweep', orphans, completed })
  result.deletes += orphans
  // 日時の比較は Prisma が書く表記 (TEXT / `+00:00` 固定) どうしで行う。sqlDate を参照。
  return [
    prisma.$executeRaw`
      UPDATE episodes SET
        record_status = 'missing',
        record_source = 'reconcile',
        recorded = 0,
        record_synced_at = ${sqlDate(now)}
      WHERE record_status = 'completed'
        AND (record_synced_at IS NULL OR record_synced_at <= ${sqlDate(since)})
        ${leaseGuard(owner, now)}`
  ]
}

/**
 * 台帳を頭から引き直す。走るのは初回・`410`・`409` の 3 ケースだけで、
 * 定常運転では走らない。**走った回数そのものが異常の指標**なので必ず記録する。
 *
 * 全ページを適用し切るまで `libraryCursor` を書かない。途中で差分に切り替えると
 * 未適用のぶんが取りこぼされる。ページ上限で打ち切ったときは
 * `snapshotCursor` に途中経過を残し、次 run が続きから再開する。
 */
async function bootstrapLibrary(
  prisma: Prisma,
  env: NagisaEnv,
  owner: string,
  reason: string,
  result: LibrarySyncResult
): Promise<void> {
  result.bootstrap = reason
  const startedFrom = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
  let cursor: string | null = startedFrom?.snapshotCursor ?? null
  // 掃き出しの基準時刻。ページを跨いで持ち回るので列に置く。これより後に触れた
  // 行だけが「今回のスナップショットに居た」を意味する。
  //
  // 引き継ぐのは **続きから読むとき (cursor あり) だけ**。cursor が無い回は
  // nagisa が頭から作り直したスナップショットを返すので、前回の在籍記録と
  // 混ぜてはいけない。1 ページで終わる台帳を mass_sweep で拒否して再挑戦する
  // 場面がまさにそれで、S1 に居て S2 に居なくなった録画が「基準時刻より後に
  // 触れた」の条件を満たしたまま残り、掃き出しから漏れる (そのまま完了扱いで
  // `libraryCursor` が確定し、削除は二度と来ない)。
  //
  // 一方 `snapshotStartedAt` が非 null であること自体は「bootstrap 継続中」の
  // 印として使い続ける (syncLibrary の分岐)。印の継続と在籍判定時刻の継続は別物。
  let sweepFrom = cursor ? (startedFrom?.snapshotStartedAt ?? null) : null
  if (!sweepFrom) {
    sweepFrom = new Date()
    await prisma.syncState.updateMany({
      where: leaseWhere(owner, sweepFrom),
      data: { snapshotStartedAt: sweepFrom }
    })
  }

  for (let page = 0; page < MAX_SNAPSHOT_PAGES_PER_RUN; page++) {
    const qs = new URLSearchParams({ limit: String(SNAPSHOT_LIMIT) })
    if (cursor) qs.set('cursor', cursor)
    const res = await fetchNagisaRaw(env, `/api/library/snapshot?${qs.toString()}`)

    if (res.status === 410) {
      // 途中でスナップショットが作り直された。部分適用を捨てて最初からやり直す。
      const code = await readErrorCode(res)
      logger.warn({ action: 'library-bootstrap-restart', code })
      await prisma.syncState.updateMany({
        where: leaseWhere(owner, new Date()),
        data: { snapshotCursor: null, snapshotStartedAt: null }
      })
      result.aborted = code
      return
    }
    if (!res.ok) {
      result.error = `snapshot ${res.status}: ${await readErrorCode(res)}`
      return
    }

    const body = NagisaLibrarySnapshotSchema.parse(await res.json())
    // このページの書き込み時刻は掃き出しの基準より **必ず後**。同じミリ秒に
    // 収まると、いま台帳で確認したばかりの行が直後の buildSweep に
    // 「触れていない」と数えられてしまう (境界が等号込みのため)。
    const now = stamp(sweepFrom)
    const rows: LedgerRow[] = body.items.map((i) => ({ recordingId: i.recording_id, item: i }))
    const resolved = await resolveEpisodes(prisma, rows)
    const { writes, unmatched } = buildUpsertWrites(prisma, rows, resolved, now, owner, true)
    cursor = body.next_cursor
    const done = !cursor

    // 1 ページが膨らみすぎていないか。台帳 1 行が数千エピソードに解決されると
    // (episode_id の取り違え等) このページだけで D1 の queries per invocation を
    // 超え、run ごと落ちる。異常データなので 1 行も書かずに降りて記録を残す。
    if (writes.length > MAX_WRITES_PER_PAGE) {
      logger.error({ action: 'library-page-too-large', phase: 'snapshot', writes: writes.length })
      result.aborted = 'page_too_large'
      return
    }

    // 書き込む直前の早期脱出。正しさは各文の `leaseGuard` が担うので、ここを
    // すり抜けても 1 行も書けない。往復を 1 つ減らすためだけの確認。
    if (!(await holdsLease(prisma, owner))) {
      logger.warn({ action: 'library-lease-lost', phase: 'snapshot', page: result.pages })
      result.aborted = 'lease_lost'
      return
    }

    // 途中のページ。適用とカーソルを同じバッチに入れる (間で落ちると取りこぼす)。
    if (!done) {
      const applied = await applyBatched(prisma, writes, [
        prisma.syncState.updateMany({ where: leaseWhere(owner, now), data: { snapshotCursor: cursor } })
      ])
      if (fenced(applied, result, 'snapshot')) return
      // 集計は適用できた回だけ進める (中断した run の数字を混ぜない)。
      result.unmatched += unmatched
      result.upserts += writes.length
      result.pages++
      // 予算は **この run が出した全ての文** で見る。bootstrap の前に差分ページを
      // 適用している回があり (`409` で落ちてから引き直すとき)、そこで出した
      // delete を数えないと合計が上限の倍近くまで伸びる。
      if (writesSoFar(result) >= MAX_WRITES_PER_RUN) {
        logger.info({ action: 'library-bootstrap-budget', writes: writesSoFar(result), pages: result.pages })
        return
      }
      continue
    }

    // 最終ページだけは 2 バッチに割る。掃き出しの対象を数えるにはこのページの
    // upsert が反映済みでなければならない (最後のページに載っていた行まで
    // 「台帳に居なかった」に見え、比率ガードが誤爆する) が、D1 には同一バッチの
    // 途中結果を読む手段が無い。カーソルを確定するのは後のバッチなので、
    // ここで落ちても次 run が同じページを読み直すだけで済む (適用は冪等)。
    if (writes.length > 0) await applyBatched(prisma, writes, [])
    result.unmatched += unmatched
    result.upserts += writes.length
    result.pages++

    // 掃き出しの数え上げは、直前の適用が反映済みであることが前提。lease を
    // 失っていると 1 行も書けていない (leaseGuard) ので、数える前に降りる。
    // 掃き出し自体も次のバッチで fencing されるから書き換わることは無いが、
    // 比率ガードを誤爆させた記録だけが残るのは紛らわしい。
    if (!(await holdsLease(prisma, owner))) {
      logger.warn({ action: 'library-lease-lost', phase: 'sweep', page: result.pages })
      result.aborted = 'lease_lost'
      return
    }

    const sweepWrites = await buildSweep(prisma, sweepFrom, now, owner, result)
    if (result.aborted) {
      // 掃き出しを拒否した回はカーソルを **1 つも** 確定しない。ここで
      // libraryCursor を置くと、取りこぼした削除は二度と拾えなくなる
      // (以降は差分しか来ない)。snapshotCursor はこのページを取りに行ったときの
      // 値のまま残してあるので、次 run が同じページからやり直す。
      return
    }

    const applied = await applyBatched(prisma, sweepWrites, [
      // 完走した回だけ libraryCursor を置く。それまでは snapshotCursor だけ動かす。
      prisma.syncState.updateMany({
        where: leaseWhere(owner, now),
        data: {
          snapshotCursor: null,
          snapshotStartedAt: null,
          libraryCursor: body.changes_cursor,
          lastSucceededAt: now
        }
      })
    ])
    if (fenced(applied, result, 'sweep')) return
    logger.info({ action: 'library-bootstrap-done', reason, items: result.upserts, pages: result.pages })
    return
  }
  logger.info({ action: 'library-bootstrap-partial', reason, pages: result.pages })
}

/** 変更ログを 1 ページ適用する。返り値は「この run を続けてよいか」。 */
async function applyChangesPage(
  prisma: Prisma,
  body: { changes: NagisaLibraryChange[]; next_cursor: string },
  owner: string,
  result: LibrarySyncResult
): Promise<boolean> {
  const now = new Date()

  // 同じ録画に複数のイベントが乗ることがある (消して録り直した等)。
  // op ごとにまとめて適用すると seq の順序が壊れ、`delete(10) → upsert(11)` が
  // 同じページに来たときに最終状態が missing に化ける。しかもカーソルは進むので
  // 二度と直らない。録画ごとに seq 最大のイベントだけを残して畳む。
  const latest = new Map<string, NagisaLibraryChange>()
  for (const c of body.changes) {
    const prev = latest.get(c.recording_id)
    if (!prev || c.seq >= prev.seq) latest.set(c.recording_id, c)
  }

  const upsertRows: LedgerRow[] = []
  const deleteIds: string[] = []
  for (const c of latest.values()) {
    if (c.op === 'upsert' && c.item) upsertRows.push({ recordingId: c.recording_id, item: c.item })
    else if (c.op === 'delete') deleteIds.push(c.recording_id)
  }

  // 保険 (§7-2): nagisa 側でマウントが外れたまま走査されると全録画が tombstone 化する。
  // 適用せずに中断し、カーソルも進めない (次 run で再挑戦する)。
  //
  // 数えるのは tombstone の件数ではなく「実際に missing になるローカル行」。
  // Workers が追跡していない録画 (nagisa にしか無い作品) の削除で閾値を超えると、
  // 適用しても何も変わらないページの手前で永久に止まってしまう。
  if (deleteIds.length > 0) {
    const counted = await Promise.all(
      chunk(deleteIds, IN_CHUNK).map((part) =>
        prisma.episode.count({ where: { recordingId: { in: part }, recordStatus: 'completed' } })
      )
    )
    const affected = counted.reduce((a, b) => a + b, 0)
    const completed = await prisma.episode.count({ where: { recordStatus: 'completed' } })
    if (affected > MASS_DELETE_MIN && affected > completed * MASS_DELETE_RATIO) {
      logger.error({ action: 'library-mass-delete-abort', deletes: deleteIds.length, affected, completed })
      result.aborted = 'mass_delete'
      return false
    }
  }

  const resolved = await resolveEpisodes(prisma, upsertRows)
  const { writes, unmatched } = buildUpsertWrites(prisma, upsertRows, resolved, now, owner, false)
  const deleteWrites = deleteIds.map((id) => buildDeleteWrite(prisma, id, now, owner))

  // 1 ページの文数の上限 (bootstrap と同じ理由)。変更ログ 100 件でも、1 件が
  // 数千エピソードに解決されればこのページだけで D1 の上限を超える。
  if (writes.length + deleteWrites.length > MAX_WRITES_PER_PAGE) {
    logger.error({
      action: 'library-page-too-large',
      phase: 'changes',
      writes: writes.length,
      deletes: deleteWrites.length
    })
    result.aborted = 'page_too_large'
    return false
  }

  // 書き込む直前の早期脱出 (bootstrap と同じ理由。holdsLease のコメント参照)。
  if (!(await holdsLease(prisma, owner))) {
    logger.warn({ action: 'library-lease-lost', phase: 'changes', page: result.pages })
    result.aborted = 'lease_lost'
    return false
  }

  // upsert を先に、tombstone を後に流す。同じページに `delete B` と `upsert A` が
  // 同居したときは A が残るのが正しい (B を消して A を録り直した)。バッチに割れても
  // この並びは崩れない。
  const applied = await applyBatched(
    prisma,
    [...writes, ...deleteWrites],
    [
      // fencing: lease を失った run はここで 0 件更新になり、カーソルを進められない。
      // 同じ条件を上の各文にも `leaseGuard` として載せてあるので、エピソード側も
      // 同時に 0 行になる。「書かないなら進めない」が 1 バッチの中で揃う。
      prisma.syncState.updateMany({
        where: leaseWhere(owner, now),
        data: { libraryCursor: body.next_cursor, lastSucceededAt: now }
      })
    ]
  )
  if (fenced(applied, result, 'changes')) return false

  result.upserts += writes.length
  result.deletes += deleteWrites.length
  result.unmatched += unmatched
  result.pages++
  return true
}

/**
 * 台帳の差分を取り込む。cron (`*​/15`) と手動実行の両方から呼ばれる。
 *
 * throw しない: 失敗は `LibrarySyncResult.error` に載せて呼び出し側が
 * `SyncRun` に記録する。同期が止まったことは `sync_state.last_succeeded_at` と
 * この記録の両方から分かる。
 */
export async function syncLibrary(prisma: Prisma, env: Partial<NagisaEnv>): Promise<LibrarySyncResult> {
  const result = emptyResult()
  const owner = crypto.randomUUID()
  const now = Date.now()

  // 行が無ければ作る。lease の取得は「条件付き updateMany の count」で見る
  // (D1 は単文が原子的なので、これだけで重複起動を弾ける)。
  await prisma.syncState.upsert({ where: { key: SYNC_KEY }, create: { key: SYNC_KEY }, update: {} })
  const got = await prisma.syncState.updateMany({
    where: { key: SYNC_KEY, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date(now) } }] },
    data: { leaseUntil: new Date(now + LEASE_MS), leaseOwner: owner }
  })
  if (got.count === 0) {
    logger.info({ action: 'library-sync-skipped', reason: 'lease-held' })
    result.skipped = true
    return result
  }

  try {
    const state = await prisma.syncState.findUnique({ where: { key: SYNC_KEY } })
    // bootstrap が終わっていない印は 2 つある。途中のページで止まったなら
    // `snapshotCursor`、最終ページの掃き出しを拒否して止まったなら
    // `snapshotStartedAt` だけが残る (1 ページで終わる台帳では前者が null)。
    // 片方しか見ないと、後者が差分同期に切り替わって削除を取りこぼす。
    if (state?.snapshotCursor || state?.snapshotStartedAt) {
      await bootstrapLibrary(prisma, env as NagisaEnv, owner, 'resume', result)
      return result
    }
    if (!state?.libraryCursor) {
      await bootstrapLibrary(prisma, env as NagisaEnv, owner, 'initial', result)
      return result
    }

    let cursor = state.libraryCursor
    for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
      const qs = new URLSearchParams({ cursor, limit: String(CHANGES_LIMIT) })
      const res = await fetchNagisaRaw(env as NagisaEnv, `/api/library/changes?${qs.toString()}`)

      // カーソルが通用しなくなった。差分では埋められないので頭から引き直す。
      if (res.status === 410 || res.status === 409) {
        const code = await readErrorCode(res)
        logger.warn({ action: 'library-cursor-invalid', status: res.status, code })
        await bootstrapLibrary(prisma, env as NagisaEnv, owner, code, result)
        return result
      }
      if (!res.ok) {
        result.error = `changes ${res.status}: ${await readErrorCode(res)}`
        return result
      }

      const body = NagisaLibraryChangesSchema.parse(await res.json())

      if (body.changes.length === 0) {
        // 変更なしの tick は 1 行も書かない (§7-4)。停止検出のための
        // lastSucceededAt だけ 1 時間に 1 回だけ更新する。
        const stale = !state.lastSucceededAt || Date.now() - state.lastSucceededAt.getTime() > HEARTBEAT_MS
        if (stale) {
          const beat = new Date()
          await prisma.syncState.updateMany({
            where: leaseWhere(owner, beat),
            data: { libraryCursor: body.next_cursor, lastSucceededAt: beat }
          })
        }
        break
      }

      if (!(await applyChangesPage(prisma, body, owner, result))) break
      cursor = body.next_cursor
      if (!body.has_more) break
      // 文数の実測で打ち切る (ページ数だけでは抑えきれない。定数のコメント参照)。
      if (writesSoFar(result) >= MAX_WRITES_PER_RUN) {
        logger.info({ action: 'library-changes-budget', upserts: result.upserts, deletes: result.deletes })
        break
      }
    }
    return result
  } catch (e) {
    if (e instanceof NagisaConfigError) {
      logger.error({ action: 'library-sync-config-missing', missing: e.missing })
      result.error = e.message
      return result
    }
    logger.error({ action: 'library-sync-error', error: e instanceof Error ? e.message : String(e) })
    result.error = e instanceof Error ? e.message : String(e)
    return result
  } finally {
    // lease は必ず返す。返せなくても LEASE_MS 後には他の run が横取りできる。
    await prisma.syncState
      .updateMany({ where: { key: SYNC_KEY, leaseOwner: owner }, data: { leaseUntil: null, leaseOwner: null } })
      .catch(() => undefined)
  }
}

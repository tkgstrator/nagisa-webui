export const SYNC_KEY = 'library'
/**
 * ページサイズと 1 run のページ数。
 *
 * 上限を決めているのは D1 の **Queries per Worker invocation = 1000**。
 * 台帳の 1 行につき `updateMany` が 1 文できる (値が行ごとに違うので 1 文に
 * 畳めない) ので、`ページサイズ × ページ数` がそのままクエリ数になる。
 * 余裕を見て 1 run 600〜700 文に収める。足りないぶんは次 tick が続きを読む。
 */
export const CHANGES_LIMIT = 100
export const MAX_PAGES_PER_RUN = 5
/** bootstrap のページサイズ。録画実体 3,000 件なら 5 run (cron で 75 分) で終わる。 */
export const SNAPSHOT_LIMIT = 200
export const MAX_SNAPSHOT_PAGES_PER_RUN = 3
/**
 * `IN (...)` に並べる値の上限。D1 の **bound parameters per query = 100** に
 * 収めるための分割幅。ページサイズぶんの id をそのまま `in:` に渡すと
 * この上限を超えて実行時に落ちる。
 */
export const IN_CHUNK = 90
/** lease の保持時間。これを過ぎた run は死んだものとして横取りされる。 */
export const LEASE_MS = 10 * 60_000
/** completed のうちこの割合を超える削除が来たら適用せず中断する。 */
export const MASS_DELETE_RATIO = 0.1
/**
 * 大量削除ガードの下駄。手持ちが数件しかない時期に比率だけで判定すると、
 * 正当な削除 1 件で同期が永久に止まる。これ以下の件数は常に適用する。
 */
export const MASS_DELETE_MIN = 20
/** 変更が無い tick で lastSucceededAt を書き直す間隔 (書き込み量の節約)。 */
export const HEARTBEAT_MS = 60 * 60_000
/**
 * 1 run で発行する UPDATE 文の累計上限。
 *
 * ページ数とページサイズだけでは文数を抑えきれない: 台帳の 1 行に複数の
 * エピソードがぶら下がると `chunk(ids, IN_CHUNK)` でさらに分かれるので、
 * 200 件のページが 200 文で済む保証が無い。ページの区切りで実測値を見て
 * 打ち切る (カーソルは適用できたところまで進んでいるので、次 run が続きを読む)。
 */
export const MAX_WRITES_PER_RUN = 600
/**
 * 1 トランザクションに積む UPDATE 文の上限。
 *
 * :data:`MAX_WRITES_PER_RUN` は **ページを適用し終えてから** 見る数字なので、
 * 1 ページが単独で膨らむ場合には効かない。台帳の 1 行が数十のエピソードに
 * 解決されると (重複登録の多い作品) 1 ページの文数はページサイズを軽く超える。
 * バッチが大きすぎると D1 の queries per invocation (1000) に当たって run ごと
 * 落ちるので、この幅で割って順に流す。
 */
export const MAX_WRITES_PER_BATCH = 300
/**
 * 1 ページを適用するのに許す UPDATE 文の上限。これを超えたら降りる。
 *
 * 分割して流せば普通に太いページは通せるが、それでも上限は要る: 台帳の 1 行が
 * 数千のエピソードに解決される (episode_id の取り違え等) と、分割しても 1 run の
 * クエリ数が D1 の上限を超えて落ち、カーソルが進まないので毎回同じページで
 * 落ち続ける。データ側の異常なので **1 行も書かずに降りて記録を残す**。
 * 同じ止まるなら落ちるより `aborted` が `SyncRun` に残るほうが直せる。
 */
export const MAX_WRITES_PER_PAGE = 900

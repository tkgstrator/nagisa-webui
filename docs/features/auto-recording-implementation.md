# 自動録画（定期録画）実装設計

`notification-recording-integrity-plan.md` 章2 で **案B（ミニマル実装）** が正式方針として確定済み。
本書はその案B を実装可能な粒度まで落とし込んだもので、確定方針を変更するものではない。

- 上位計画: `notification-recording-integrity-plan.md` 章2（方針確定）・章6（実装順序）
- 全体設計（案A・不採用）: `recording-design.md`
- Webhook 仕様（実装済み・正典）: `download-status-webhook.md`
- Nagisa 側の受け口: `nagisa-recording-integration.md` / `nagisa-api.md`

---

## 1. 実装済みと未実装の境界（コード実測）

「定期録画のバックエンドが無い」わけではない。**部品はほぼ揃っていて、繋がっていないのは自動発火の一点**である。

| 要素 | 実体 | 状態 |
|---|---|---|
| 録画リクエスト送信 | `src/routes/anime.ts:352-453` `POST /api/anime/:id/record` | ✅ 実装済み（手動・作品単位） |
| Nagisa への単体ジョブ投入 | `src/routes/nagisa.ts` `POST /api/nagisa/jobs` | ✅ 実装済み |
| Nagisa 疎通確認 | `src/routes/nagisa.ts` `GET /api/nagisa/status` | ✅ 実装済み |
| 完了 Webhook 受信 | `src/routes/webhooks.ts` `POST /api/webhooks/record-status` | ✅ 実装済み（`completed` のみ DB 反映） |
| Nagisa API の型 | `src/schemas/nagisa.dto.ts` / `src/schemas/webhook.dto.ts` | ✅ 実装済み |
| CF Access 認証情報 | `wrangler.toml` `[vars]` の `BACKEND_URL` / `CF_ACCESS_CLIENT_ID` + secret の `CF_ACCESS_CLIENT_SECRET` | ✅ Worker 全体に配布済み |
| 録画予約フラグ | `Anime.scheduled`（Prisma / API / フロントのトグル） | ⚠️ **死んだフラグ**。読む側が 1 箇所も無い |
| 新着話の自動発火 | — | ❌ **未実装（本書のスコープ）** |
| `pending` / `downloading` / `failed` の扱い | `webhooks.ts` で受信はするが握りつぶし | ❌ 未実装（案B ではスコープ外） |

`CF_ACCESS_CLIENT_ID` と `BACKEND_URL` は `wrangler.toml` の `[vars]` にあるため、
**Queue consumer からも既に参照できる**（バインディング追加は不要で、TypeScript の `interface Env` に型を足すだけ）。

---

## 2. 案B チェックリストとコードのズレ

章2 の実装ステップは「`src/lib/sync.ts` の `!existing` 分岐から `requestRecording(prisma, env, animeId)` を呼ぶ」と書いているが、
**そのままでは実装できない**。実測した制約は以下。

1. `new SyncService(prisma, lambda)`（`src/queue.ts:79`, `src/routes/anime.ts:490`）は **env を受け取っていない**。
   `SyncService` の中から `BACKEND_URL` / `CF_ACCESS_*` に到達する経路が無い。
2. `applyDetail()`（`sync.ts:87-107`）は `syncSeasons()` の `stats` を**ログに出すだけで破棄**し `Promise<void>` を返す。
   `update()`（`sync.ts:80-84`）も同様に `void`。新規エピソードが出たという信号が呼び出し元に届かない。
3. `queue.ts` の `case 'update'` / `case 'bulk_update'` はどちらも `service.update()` の戻り値を捨てている。

したがって本書では、**信号を上流へ返し、送信は Queue consumer 側で行う**方式を採る（§3-A）。

---

## 3. 設計上の決定

### A. 録画リクエストの発信場所 → **Queue consumer（`src/queue.ts`）**

`SyncService` に env を注入して内部から送る案も採り得るが、以下の理由で採用しない。

- `SyncService` は Prisma と Lambda クライアントの薄いラッパーであり、外部サービスへの副作用を持たせると責務が膨らむ
- `queue.ts` は既に `notify()`（Discord）を持っており、章3「新規エピソード通知」と**同じ場所に同じ信号で相乗りできる**
- `[vars]` は Worker 全体で可視なので、`queue.ts` の `interface Env` に 3 行足すだけで済む

`syncSeasons()` → `applyDetail()` → `update()` の戻り値に、新規作成されたエピソードを載せて返す。

```ts
// src/lib/sync.ts
export type SyncOutcome = {
  animeId: string
  title: string
  scheduled: boolean
  /** このバッチで新規作成されたエピソード。既存話の差分更新は含まない */
  createdEpisodes: { seasonNumber: number; episodeNumber: number }[]
  /** 取り込み前にエピソードが 1 件も無かった（= 初回取り込み） */
  initialImport: boolean
}
```

`syncSeasons()` は `anime` を `findUniqueOrThrow` で `select` なしに引いているため、`scheduled` は**追加クエリなしで読める**。
`applyDetail()` も `prisma.anime.update()` の戻り値として `id` / `title` / `scheduled` を既に持っている。

### B. 送信対象 → **今回新規作成されたエピソードのみ**

既存 `POST /:id/record` は「そのアニメの未録画エピソード**全部**」を送る。
これを自動発火にそのまま使うと、1 話追加されるたびに過去の未録画話（ダウンロード中・恒久的に失敗している話を含む）が毎回再送される。

自動発火では `createdEpisodes` だけを送る。過去話の取りこぼしを拾い直すのは手動 `POST /:id/record` の役割とし、責務を分ける。

共通関数は対象を省略可能にして、両方の呼び出し元が同じ経路を通るようにする。

```ts
// src/lib/recording.ts（新規）
export type RecordTarget = { seasonNumber: number; episodeNumber: number }

export async function requestRecording(
  prisma: PrismaClient,
  env: { BACKEND_URL: string; CF_ACCESS_CLIENT_ID: string; CF_ACCESS_CLIENT_SECRET: string },
  animeId: string,
  /** 省略時は未録画エピソードを全件（既存 POST /:id/record の挙動） */
  targets?: RecordTarget[]
): Promise<{ ok: true; data: NagisaQueueResponseSchema } | { ok: false; reason: 'not-found' | 'no-episodes' | 'backend'; detail?: string }>
```

戻り値を判別可能ユニオンにするのは、HTTP ステータス（404 / 400 / 502）への対応を Hono ルート側に残し、
Queue 側では Discord 通知に振り分けるため。

### C. 初回取り込みでは発火しない（`initialImport === true` はスキップ）

新規アニメを取り込むと全話が「新規エピソード」として作成される。ここで発火すると
**予約済み作品の全話一括ダウンロードが無言で走る**。自動録画の意図は「新着話を録る」ことなので、初回は対象外とする。

初回の全話取得が必要なら、ユーザーが明示的に作品ページから `POST /:id/record` を叩く。
この論点は章2 の計画に記載が無く、本書で追加する判断である。

### D. 送信失敗は Queue をリトライさせない

`case 'update'` の中で録画リクエストが失敗したときに例外を投げると、
`message.retry()` により**メタデータ同期そのものが再実行される**（エピソードは作成済みなので `createdEpisodes` は空になり、録画は二度と発火しない）。

したがって録画リクエストの失敗は catch して Discord 通知に留め、Queue のメッセージは ack する。
同期の成否と録画指示の成否を独立させる。

### E. 重複 `Anime` 行（章4 未着手）の扱い

章2 が自ら記す通り、重複登録された `Anime` 行それぞれから録画リクエストが飛び得る。
Nagisa 側はほぼ冪等なので実害は限定的と判断し、**章4 の完了を待たずに着手する**（章6 の順序に従う）。

---

## 4. 変更対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/lib/recording.ts` | **新規**。`requestRecording()` を実装（`anime.ts:387-437` のロジックを移設） |
| `src/routes/anime.ts` | `POST /:id/record` のハンドラを `requestRecording()` 呼び出し + ステータス変換だけに縮める |
| `src/lib/sync.ts` | `syncSeasons()` / `applyDetail()` / `update()` の戻り値を `SyncOutcome` に変更。`!existing` 分岐で `createdEpisodes` に積む |
| `src/queue.ts` | `interface Env` に `BACKEND_URL` / `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` を追加。`case 'update'` / `case 'bulk_update'` で `SyncOutcome` を集約し、条件を満たすものへ `requestRecording()` を実行 |
| `src/lib/discord.ts` | 録画リクエスト送信・失敗の通知（章1 の通知種別表に従う） |

**DB マイグレーション不要**・**Webhook 改修不要**・**新規 Queue メッセージ型不要**・**新規 Cron 不要**。
既存の毎時同期（`0 */1 * * *`）が新着話を検知した時点で発火するため、録画専用のスケジュールは要らない。

発火条件（すべて満たすときのみ送信）:

```
outcome.scheduled === true
  && outcome.createdEpisodes.length > 0
  && outcome.initialImport === false
```

---

## 5. 実装ステップ

1. `src/lib/recording.ts` を新規作成し、`anime.ts` の送信ロジックを移設。`POST /:id/record` が従来どおり動くことを確認
2. `sync.ts` の戻り値を `SyncOutcome` に変更（この時点では誰も使わない。型チェックのみ）
3. `queue.ts` の `Env` に 3 フィールド追加、`case 'update'` / `case 'bulk_update'` で `SyncOutcome` を集約
4. 発火条件を満たす作品に `requestRecording(prisma, env, animeId, createdEpisodes)` を実行。失敗は catch して収集
5. バッチ完了通知に「録画リクエスト送信 N 件 / 失敗 M 件」を追加（章3 の新規エピソード通知と同じ embed に相乗り）
6. `bunx tsc -b --noEmit` / `bunx biome check src/`

---

## 6. スコープ外（別タスク）

- `pending` / `downloading` / `failed` Webhook の DB 反映（`Episode.recordStatus` 列の導入 = 案A 相当）
- フロントエンドの録画状態バッジ・進捗表示（`download-progress.md`）
- 「録画予約」トグルの説明文言見直し（章2 が別タスクとして提起済み）
- 章4（重複登録対策）と設定画面からの挙動選択
- `wrangler.toml:39` の `"0 5 * * SUN"` と `src/scheduled.ts:69` の `case '0 5 * * 0'` の不一致
  （週次 AniList 同期が `unknown-cron` に落ちている疑い。本書とは独立の既存バグ）

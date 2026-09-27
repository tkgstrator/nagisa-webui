# API パスの RESTful 化 (製品名 `nagisa` の除去) 計画

## 目的

Workers 側 API (`/api/*`) のパスから録画サーバーの製品名 `nagisa` を取り除き、あわせて「URL が指す資源」と「実際に読み書きされる資源」が食い違っている経路を RESTful な形に直す。**このドキュメントは計画のみであり、コード変更は含まない。**

発端は `POST /api/nagisa/library/sync` (台帳フル同期、未コミット) の追加時に「録画サーバーの名前が変わるかもしれないのに、その名前を URL に焼き込む命名は良くない」という指摘があったこと。Codex MCP (`codex,gpt-6-astra`) に現行ルート (`src/routes/*.ts`, `src/index.ts`, `src/app/lib/api.ts`) を読ませてレビューさせ、その結果のうち妥当と判断した項目だけを本計画に採用する。

関連ドキュメント: [image-persistence-r2-plan.md](../features/image-persistence-r2-plan.md) (同様の計画書フォーマット), [recording-sync.md](../features/recording-sync.md) (台帳同期の設計), CLAUDE.md (Backend ルート節: `OpenAPIHono` + `createRoute` 必須)。

---

## 0. 前提: 旧 URL との互換は不要

改名にあたって旧パスを残す必要があるかを先に確認した。

| 呼び出し元候補 | 実態 | 追従が要るか |
|---|---|---|
| フロントエンド (`src/app/**`) | すべて `src/app/lib/api.ts` の Zodios 定義 (alias) 経由。生 fetch は無い | **要** (Zodios の `path` を書き換える。alias を維持すれば呼び出し側は原則無変更) |
| `src/app/components/proxy-image.tsx:46` | `/api/img/...` の URL を手で組み立てている唯一の箇所 | 不要 (`/img` は据え置き) |
| nagisa 側からのコールバック | 無い (Webhook は廃止済み。`docs/features/recording-design.md` の記述は過去のもの) | 不要 |
| cron (`scheduled` ハンドラ) | HTTP を経由せず `syncJobs` / `syncLibrary` を関数として直接呼ぶ | 不要 |
| `scripts/`, `wrangler.toml` | `api/nagisa` `api/recordings` `api/admin` への言及なし (grep で確認) | 不要 |
| 外部ツール / 他リポ | 本アプリの API を叩くものは無い | 不要 |

よって **旧パスのリダイレクトや併存期間は設けない**。改名はバックエンド・フロント・docs を同一 PR (フェーズ単位) で一括更新する。

---

## 1. 現状の問題点

Codex レビューで挙がった指摘のうち、実コードで裏付けが取れたもの。

### 1.1 製品名がパスに入っている (`/api/nagisa/*`)

`src/index.ts:41` で `app.route('/api/nagisa', nagisaRoutes)`。配下 6 経路は「録画サーバーの状態」「録画台帳」「録画ジョブ投入」の 3 種の資源が 1 つの製品名の下に混在している。製品が置き換わったとき URL ごと変わることになり、フロント・docs すべてを巻き込む。

### 1.2 `/recordings` は `Episode` を更新している

`src/routes/recordings.ts` の `PUT /` と `PUT /bulk` は body に `episodeId` / `episodeIds` を取り、`prisma.episode.update` / `updateMany` で **`Episode.recorded` フラグだけ**を書き換える (`recordings.ts:92-96`, `132-135`)。`GET /` も `Episode` を `recorded = true` で絞った一覧。「Recording」という独立資源は存在せず、URL がデータモデルと一致していない。さらに `PUT` なのに部分更新 (1 フィールドだけ) であり、RFC 5789 の意味では `PATCH` が正しい。

補足: `Episode` には `id` (UUID, `@id`) と `episodeId` (プロバイダ側の ID, `prisma/schema.prisma:64`) の 2 列がある。現行 body の `episodeId` は **`Episode.id`** (`where: { id: body.episodeId }`) を指しており、名前も紛らわしい。

### 1.3 `/admin/abema/*` は「HLS 鍵アーカイブ」の操作である

`src/routes/admin.ts:24` summary「鍵未取得の ABEMA anime をすべて archive キューに投入する」、`:58`「ABEMA HLS 鍵 archive の進捗」。URL の `abema` は provider の値であり資源名ではない。`enqueue-archive` という動詞パスも RPC 的。

### 1.4 `/admin/logs/*` の中身がログでないものを含む

`src/routes/admin-logs.ts` の `/runs`, `/runs/{id}`, `/stats` は `SyncRun` (同期実行の記録)、`/recordings` は `RecordingEvent` (録画イベント) であり、本当のログ行 (`LogEntry`) は `/entries` だけ。`logs` の下にまとめた結果、`/admin/logs/recordings` が `/api/recordings` と紛らわしい。

### 1.5 `POST /anime/{id}/record` は動詞

`src/routes/anime/record.ts:17`。実体は「その作品の未録画エピソードに対する録画ジョブを nagisa へ投入する」なので、資源は録画ジョブ (`recording-jobs`) である。

---

## 2. Codex レビューの指摘と採否

| # | 指摘 | 採否 | 理由 |
|---|---|---|---|
| A | `/nagisa/*` を `recorder` / `recording-library` / `recording-jobs` に分ける | **採用** | 1.1 |
| B | `/recordings` を `/episodes` + `PATCH` にする | **採用** | 1.2 |
| C | `/admin/abema/*` を `key-archive` 系に、provider は body / query へ | **採用** | 1.3 |
| D | `/admin/logs/*` のうち `runs` `recordings` `stats` を実体名に | **採用** | 1.4 |
| E | `/admin/unidentified` → `/admin/unidentified-anime` | **採用** | 単語だけでは何が unidentified か分からない (`UnidentifiedAnime` モデルがある) |
| F | `POST /anime/{id}/record` → `POST /anime/{id}/recording-jobs` | **採用** | 1.5 |
| G | 実行 API (`library/sync`, `enqueue-archive`) を `201 Created` + `SyncRun` 資源で返す | **不採用** | `startRun` は `SyncRun` 保存失敗時に `null` を返して処理を続行する (`src/lib/sync-run.ts:41`) ため、201 が指す資源の存在を保証できない。200 + 集計値を維持し、`runId: string \| null` を返す中間案に留める |
| H | `POST /anime/{id}/refresh` のリソース化 | **不採用** | `refresh.ts:114` で `syncJobs` / `syncLibrary` が作品 ID 非限定で走るなど、経路自体の責務整理が先。改名だけしても意味が変わらない |
| I | `/nagisa/status` `/queue/snapshot` `/library/stats` は上流 JSON をそのまま返しており、URL を変えても製品依存は消えない (DTO 境界が要る) | **同意するがスコープ外** | 5 章 |
| J | `Episode.recorded` と `recordStatus == 'completed'` の意味の重複 | **同意するがスコープ外** | `schema.prisma:74` のコメント通り、フロント移行が終わるまで `recorded` は維持する方針が既にある |
| K | Zodios の alias は維持し、呼び出し側の変更を最小にする | **採用** | 3.4 |

---

## 3. 新しいパス設計

すべて `/api` 配下。「据え置き」は変更しない。

### 3.1 録画サーバー / 録画台帳 / 録画ジョブ (旧 `/nagisa/*`)

| 現行 | 変更後 | メソッド / 応答 | 備考 |
|---|---|---|---|
| `/nagisa/status` | `/recorder/status` | GET 200 / 502 | 上流 `/api/status` の素通し。`recorder` = 「録画サーバー」の一般名 |
| `/nagisa/queue/snapshot` | `/recorder/queue/snapshot` | GET 200 / 502 | `/recording-jobs` の一覧に見せない。snapshot は「Redis に残っているジョブ」であって完了の根拠ではない (現行 description のまま) |
| `/nagisa/library/stats` | `/recording-library/stats` | GET 200 / 502 | 上流 `/api/library/stats` の素通し |
| `/nagisa/sync-state` | `/recording-library/sync-state` | GET 200 | ローカル D1 のみ。上流に触らない |
| `/nagisa/library/sync` | `/recording-library/sync` | POST 200 | 現行のレスポンス形を維持し、`runId: string \| null` を追加する |
| `/nagisa/jobs` | `/recording-jobs` | POST 200 / 502 | 単体ジョブ投入 |

OpenAPI の `tags` は `['Nagisa']` → `['Recorder']` / `['Recording Library']` / `['Recording Jobs']` に分ける。

### 3.2 エピソード (旧 `/recordings`)

| 現行 | 変更後 | 備考 |
|---|---|---|
| `GET /recordings` | `GET /episodes?recorded=true` | `recorded` は `z.boolean().optional()`。省略時は絞らない (一覧の意味を保つため、現行と同じ挙動が欲しいフロントは明示的に `recorded=true` を渡す) |
| `PUT /recordings` body `{episodeId, recorded}` | `PATCH /episodes/{id}` body `{recorded}` | `{id}` は **`Episode.id` (UUID)** であり `Episode.episodeId` (プロバイダ ID) ではない。OpenAPI の `params` description に明記する |
| `PUT /recordings/bulk` body `{episodeIds[], recorded}` | `PATCH /episodes` body `{ids[], recorded}` | `updateMany` 1 文なので原子的。description に「全件成功か全件失敗のどちらか」と書く |

`tags` は `['Recordings']` → `['Episodes']`。スキーマ名は `UpdateRecordingSchema` → `UpdateEpisodeSchema` (`{recorded}` のみ)、`BulkUpdateRecordingSchema` → `BulkUpdateEpisodeSchema` (`{ids, recorded}`)。`recording.dto.ts` に残す (`RecordStatusEnum` などと同居しているため、ファイル移動はしない)。

現在フロントに `getRecordings` / `updateRecording` / `bulkUpdateRecording` の呼び出し元は無い (grep で `api.` 直呼びも `query-options.ts` 経由も出なかった)。Zodios 定義だけ改名する。

### 3.3 作品配下の録画ジョブ (旧 `/anime/{id}/record`)

| 現行 | 変更後 | 備考 |
|---|---|---|
| `POST /anime/{id}/record` | `POST /anime/{id}/recording-jobs` | body (`RecordAnimeRequestSchema`) と応答 (`NagisaQueueResponseSchema`) は据え置き |
| `POST /anime/{id}/refresh` | 据え置き | 2 章 H |

### 3.4 管理 (旧 `/admin/*`)

| 現行 | 変更後 | 備考 |
|---|---|---|
| `POST /admin/abema/enqueue-archive` | `POST /admin/key-archive-requests` body `{provider: 'abema'}` | `provider` は `z.enum(['abema'])`。未対応 provider は Zod 検証で 400。応答は現行 (`ArchiveEnqueueResponseSchema`) のまま 200 |
| `GET /admin/abema/archive-stats` | `GET /admin/key-archives/stats?provider=abema` | `provider` は `z.enum(['abema']).default('abema')` |
| `GET /admin/unidentified` | `GET /admin/unidentified-anime` | query は据え置き |
| `GET /admin/logs/runs` | `GET /admin/sync-runs` | |
| `GET /admin/logs/runs/{id}` | `GET /admin/sync-runs/{id}` | |
| `GET /admin/logs/stats` | `GET /admin/sync-runs/stats` | `LogStatsSchema` の中身は cron ごとの最終 run + 直近 24h の run 集計であり、ログの統計ではない。**`/sync-runs/{id}` より前に登録する** (Hono はパスパラメータより静的セグメントを優先するが、登録順に依存しない形にしておく) |
| `GET /admin/logs/recordings` | `GET /admin/recording-events` | `RecordingEvent` の一覧 |
| `GET /admin/logs/entries` | 据え置き | 唯一の本物のログ |

マウントは `app.route('/api/admin/logs', adminLogRoutes)` を廃止し、`admin-logs.ts` の各経路を `/api/admin` 直下の相対パス (`/sync-runs`, `/recording-events`, `/logs/entries`) に書き直して `adminRoutes` と同じ `/api/admin` に載せる。ファイル名は `admin-logs.ts` のままでよい (中身は「管理者向けの観測系」で変わらない)。

### 3.5 据え置き

`GET /anime`, `GET /anime/badged`, `GET|PATCH /anime/{id}`, `GET /img/{key}`, `GET /api/debug/*`, `/openapi.json`, `/docs`, `GET /anime/{id}` (OG メタ付き HTML、`src/index.ts:81`)。

---

## 4. 変更対象ファイル

### 4.1 バックエンド

| ファイル | 変更 |
|---|---|
| `src/index.ts` | マウントを `/api/recorder`, `/api/recording-library`, `/api/recording-jobs`, `/api/episodes` に置き換え。`/api/admin/logs` マウントを削除 |
| `src/routes/nagisa.ts` | **3 ファイルに分割**: `recorder.ts` (`/status`, `/queue/snapshot`)、`recording-library.ts` (`/stats`, `/sync-state`, `/sync`)、`recording-jobs.ts` (`POST /`)。`proxyGet` は 3 経路で共有するため `src/lib/nagisa-client.ts` 側へ移す (上流 = nagisa の名前は lib 内に閉じ込める) |
| `src/routes/recordings.ts` | `episodes.ts` に改名。`GET /` に `recorded` query を追加、`PUT` 2 本を `PATCH /{id}` / `PATCH /` に |
| `src/routes/anime/record.ts` | `path: '/{id}/recording-jobs'` |
| `src/routes/admin.ts` | `key-archive-requests` / `key-archives/stats` / `unidentified-anime` |
| `src/routes/admin-logs.ts` | 相対パスを 3.4 の通りに。`/sync-runs/stats` を `/sync-runs/{id}` より前に登録 |
| `src/schemas/recording.dto.ts` | `UpdateEpisodeSchema` / `BulkUpdateEpisodeSchema`、`LibraryManualSyncResponseSchema` に `runId` 追加 |
| `src/schemas/archive.dto.ts` | `KeyArchiveRequestSchema` (`{provider}`)、stats の query スキーマ |
| `src/lib/sync-run.ts` | 変更なし (`startRun` が `null` を返す挙動はそのまま。`runId` はその値を透過) |

`src/schemas/nagisa.dto.ts` のスキーマ名 (`NagisaStatusSchema` 等) は **改名しない**。上流の JSON 形をそのまま表しており、製品名が付いているのはむしろ正しい (2 章 I の DTO 境界化をするときに初めて `RecorderStatusSchema` のような内部表現を作る)。

### 4.2 フロントエンド

| ファイル | 変更 |
|---|---|
| `src/app/lib/api.ts` | `path` を 3 章の通りに書き換え。alias は原則維持 (`getNagisaStatus` → `getRecorderStatus` 等、**alias 名からも `Nagisa` を落とす**。`syncNagisaLibrary` → `syncRecordingLibrary`、`enqueueNagisaJob` → `enqueueRecordingJob`、`recordAnime` はそのまま)。`updateRecording` / `bulkUpdateRecording` / `getRecordings` は `updateEpisode` / `bulkUpdateEpisodes` / `getEpisodes` に |
| `src/app/lib/query-keys.ts` | `queryKeys.nagisa.*` → `queryKeys.recorder.{status, queueSnapshot}` と `queryKeys.recordingLibrary.{stats, syncState}` に分ける。キー文字列 (`['nagisa', ...]`) も改める |
| `src/app/lib/query-options.ts` | alias / query-keys の追従 |
| `src/app/routes/admin/nagisa/index.tsx` | alias 追従。**ルートパス `/admin/nagisa` は URL に製品名が出るので `/admin/recorder` に改名** (ディレクトリ移動、`routeTree.gen.ts` は再生成)。サイドバー等のリンク先も追従 |
| `src/app/routes/settings/-components/library-sync-section.tsx` | `api.syncRecordingLibrary`、`queryKeys.recordingLibrary.syncState` |
| `src/app/routes/admin/abema/index.tsx` | `enqueueArchive({ provider: 'abema' })`、`getArchiveStats({ queries: { provider: 'abema' } })`。**ルートパス `/admin/abema` は据え置き** (画面は ABEMA 専用であり、それが URL に出るのは正しい) |
| `src/app/routes/anime/$id/index.tsx`, `-components/episode-grid.tsx`, `src/app/components/anime-drawer.tsx` | `recordAnime` は alias 据え置きのため無変更のはず。tsc で確認 |
| `src/app/routes/admin/logs/**` | `getSyncRuns` / `getSyncRun` / `getRecordingEvents` / `getLogStats` は alias 据え置き。`getLogStats` は `getSyncRunStats` に改名 |

Intlayer の content ファイルに製品名 `nagisa` が表示文言として入っている箇所 (例: `settings-library-sync-section` の「nagisa の録画台帳を…」) は **本計画の対象外**。表示文言の製品名は URL と違って後から差し替えても何も壊れない。

### 4.3 ドキュメント

| ファイル | 変更 |
|---|---|
| `docs/PROJECT.md:10,48-52` | ディレクトリ構造と API 説明 |
| `docs/ROADMAP.md:25` | `POST /api/recordings` → `PATCH /api/episodes/{id}` |
| `docs/mock-diff.md:43` | API 名前空間の列挙 (`/api/webhooks` は既に無いので併せて落とす) |
| `docs/features/auto-recording-implementation.md:19-21` | パスと参照ファイル名 |
| `docs/features/recording-sync.md:67,732` | `PATCH /api/recordings/...` → `PATCH /api/episodes/{id}` (`:732` の `/api/recordings/inflight` は未実装の構想なので、そこだけ「(構想)」と注記して据え置き) |
| `docs/features/nagisa-library-api.md:56` | 同上 |
| `docs/features/notification-recording-integrity-plan.md:101-102,133,151` | `/api/admin/logs` → `/api/admin/logs/entries` と `/api/admin/sync-runs/stats` |
| `docs/features/download-progress.md:9` | `/anime/:id/record` → `/anime/{id}/recording-jobs` |
| `docs/features/recording-design.md` | **触らない**。廃止済み Webhook と上流 nagisa 自身の URL が混在する過去の設計書であり、一括置換すると壊れる。冒頭に「パスは本計画で改名済み」の注記を 1 行足すだけに留める |
| `docs/mock-diff/mocks/components/server-status-{astra,fable}.html` | モック内の表示文言。触らない (URL ではない) |

---

## 5. スコープ外

- **DTO 境界化** (2 章 I): `/recorder/status`, `/recorder/queue/snapshot`, `/recording-library/stats` は上流 JSON を素通しにしており、製品を替えるとレスポンス形が変わる。内部表現へ詰め替える層を作るのは別計画。
- **`Episode.recorded` と `recordStatus` の統合** (2 章 J)。
- **`POST /anime/{id}/refresh` の責務整理** (2 章 H)。
- **実行 API の 201 / 202 化** (2 章 G)。`startRun` が失敗しても処理を続ける設計を変えない限り成立しない。
- **旧 URL の互換** (0 章)。
- **表示文言の `nagisa`** (4.2)。
- **`unmatched` 行の再試行** (台帳同期の既知の穴、前計画から引き継ぎ)。

---

## 6. 実施フェーズ

改名は互いに独立しているので分割できるが、フロントの `api.ts` と docs を何度も触ることになるため、**1 PR にまとめる**ことを基本とし、レビューしやすいようコミットは資源ごとに切る。

| フェーズ | 内容 | 依存 |
|---|---|---|
| 1 | `/nagisa/*` → `recorder` / `recording-library` / `recording-jobs` (3.1)、`proxyGet` の lib 移動、`runId` 追加、`/anime/{id}/recording-jobs` (3.3)、`/admin/nagisa` 画面の `/admin/recorder` 移動 | 未コミットの台帳同期変更を含む develop 上で行う |
| 2 | `/recordings` → `/episodes` + PATCH (3.2) | なし |
| 3 | `/admin/*` (3.4)、`/api/admin/logs` マウント廃止 | なし |
| 4 | docs 更新 (4.3) | 1〜3 |

フェーズ 1 は develop に既に載っている未コミットの `POST /nagisa/library/sync` を含めて改名するので、**台帳同期機能のコミットより前に、あるいは同じ PR で**行う (旧パスが一度も master に入らないようにする)。

---

## 7. 検証

- `bunx tsc -b --noEmit` / `bunx biome check src/` が各フェーズ後に通ること
- `curl http://localhost:14755/openapi.json | jq '.paths | keys'` で新パスだけが並び、`nagisa` を含むパスが無いこと (`tags` にも無いこと)
- 旧パスが 404 になること (併存させない方針の確認)
- フロント: `/admin/recorder` (旧 `/admin/nagisa`)、`/admin/abema`、`/admin/logs`、設定画面の台帳同期、アニメ詳細の録画ボタン、が動くこと。dev サーバーはユーザーが起動している 14755 を使い、新規に立てない
- `PATCH /api/episodes/{id}` に存在しない UUID を投げて 404、`PATCH /api/episodes` に `ids: []` を投げて 400 (`.min(1)`) になること
- `POST /api/admin/key-archive-requests` に `{provider: 'foo'}` を投げて 400 になること
- `grep -rn "api/nagisa\|nagisa/" src/app src/routes src/index.ts docs --exclude-dir=mocks` が `docs/features/recording-design.md` 以外でヒットしないこと

# Nagisa WebUI — 対応機能

このドキュメントは、Nagisa WebUI (アニメ録画管理アプリ) が対応する機能の一覧をまとめたもの。
UI モック作成時にドメイン機能を理解するために参照する。

## 画面一覧

| パス | 画面 | 実装 |
| --- | --- | --- |
| `/` | ホーム | `src/app/routes/index.tsx` |
| `/browse` | アニメ一覧 | `src/app/routes/browse/index.tsx` |
| `/anime/:id` | アニメ詳細 | `src/app/routes/anime/$id/index.tsx` |
| `/recordings` | 録画一覧 | `src/app/routes/recordings/index.tsx` |
| `/settings` | 設定 | `src/app/routes/settings/index.tsx` |
| `/changelog` | 変更履歴 | `src/app/routes/changelog/index.tsx` |
| `/admin` | 管理ハブ | `src/app/routes/admin/index.tsx` |
| `/admin/logs` | 同期ログ | `src/app/routes/admin/logs/index.tsx` |
| `/admin/unidentified` | 未識別タイトル一覧 | `src/app/routes/admin/unidentified/index.tsx` |
| `/admin/nagisa` | Nagisaジョブ投入 | `src/app/routes/admin/nagisa/index.tsx` |
| `/_errors/:statusCode` | エラー画面 (404等) | `src/app/routes/_errors/$statusCode/index.tsx` |

mock-diff-viewer (`docs/mock-diff/mock-diff.yaml`) でモック比較対象になっているのは
`browse` / `anime-detail` / `recordings` / `home` / `settings` / `not-found` と、同期ログのタブごとの
`logs` / `logs-entries` / `logs-recordings` / `logs-catalog` の10画面 (screen-id) で、
いずれも実装との比較 (Checking) まで行う。

## 画面ごとの機能

### ホーム (`/`)

- 新着エピソード (バッジ `NEW_EPISODE`) のカルーセル表示、「すべて見る」で `/browse?badge=NEW_EPISODE` へ遷移
- 直近更新された録画予約中作品のリスト (最大6件、更新日時降順)
- タブ切り替えで以下を表示: 今期アニメ (放送年+クールでフィルタ、件数バッジ付き) / 新着追加
  (`RECENTLY_ADDED`) / もうすぐ配信 (`COMING_SOON`) / 配信終了予定 (`EXPIRING`) / 配信元から探す
  (プロバイダ別にグルーピングしたカルーセル)
- 各カルーセルから一覧画面へのフィルタ付きリンク

### アニメ一覧 (`/browse`)

- タイトル検索 (検索バー、URLクエリ `q` と連動)
- フィルタ: プロバイダ、放送年、クール、放送ステータス、バッジ (サイドバー形式)
- ソート: タイトル/放送年 × 昇順/降順
- 適用中フィルタをチップ表示、個別解除・全解除
- ポスター+タイトル+プロバイダバッジ+ステータスのグリッド表示 (24件/ページ)
- カードクリックで詳細をドロワー表示 (画面遷移せず概要確認)
- ページネーション
- URLクエリで provider/badge/q を共有可能 (ホーム等からのディープリンク用)

### アニメ詳細 (`/anime/:id`)

- ヒーロー領域: ポスター、タイトル、放送情報、総話数・総再生時間、あらすじ
- アクション: 録画予約トグル (「録画予約」/「録画予約中」、予約中に押すと解除)、今すぐ録画 (未録画の
  話をまとめて録画リクエストAPIへ送る手動の録画開始、常に押せる)、タイトル情報の再取得 (refresh、
  AniList/プロバイダから再同期)
- エピソード一覧: シーズン/話ごとに話数・サブタイトル・録画状態 (録画済み / 録画中 / 未録画) を表示
  (全話分)。録画状態は表示のみで、1 話単位の録画ボタンは持たない
- 同一作品を配信している他プロバイダの一覧 (AniList IDで関連付け)
- この作品のログ: 録画ログ (recording_events) とカタログ変化 (catalog_events) を animeId で
  絞った直近 7 日分。表示のみで、「同期ログで開く」で `/admin/logs` に animeId 付きで遷移する。
  一般ログ (Workers Logs) は作品で絞れないため載せない
- 戻る導線 (ブラウザ履歴 or ホームへ)

### 録画一覧 (`/recordings`)

- 録画予約中 (scheduled=true) の作品一覧
- 絞り込み: タイトル検索、録画状態 (すべて/未録画/録画済み)、配信終了予定のみ
- 個別に予約解除
- 複数選択 (全選択/個別選択) して一括予約解除
- ページネーション (24件/ページ)
- 予約が0件の場合はアニメ一覧への誘導リンクを表示

### 変更履歴 (`/changelog`)

- Gitコミット履歴を日付でグループ化して一覧表示 (コミットハッシュ+メッセージ)

### 同期ログ (`/admin/logs`)

- 直近 24 時間の実行件数 (実行 / 成功 / 一部失敗 / 失敗) の集計タイル
- タブ (`?tab=`) で以下を切り替え:
  - 実行履歴: cron ごとの稼働状況 (最終実行・結果・所要、一度も動いていない cron は赤) と、
    cron / Queue / 手動実行の履歴 (期間・種別・状態で絞り込み、ページネーション、詳細へ)
  - 生ログ: Worker の一般ログ (Workers Logs を Telemetry API で引く。保持 7 日)。本文検索、期間・レベルで絞り込み、props 展開、
    該当する実行へのリンク、「さらに読み込む」
  - 録画: 録画リクエストの結果 (recording_events)。期間・種別・結果で絞り込み
  - カタログ: カタログに入った変化 (catalog_events)。期間・種別・配信元で絞り込み
- `animeId` クエリで作品を絞れる (アニメ詳細の「同期ログで開く」から遷移)

### 管理ハブ (`/admin`)

- 管理系サブ画面 (未識別タイトル一覧・Nagisaジョブ投入) への導線一覧

### 未識別タイトル一覧 (`/admin/unidentified`)

- AniListで識別できなかったタイトルをグリッド表示
- 絞り込み: タイトル検索、プロバイダ
- 並び替え: 更新日時 昇順/降順
- 各カードから配信元サイトへの外部リンク
- ページネーション (30件/ページ)

### Nagisaジョブ投入 (`/admin/nagisa`)

- provider / content_id / season_number / episodes / marketplace / language / force (再ダウンロード
  強制) を指定して Nagisa (録画バックエンド) へ直接ジョブを投入するフォーム
- 送信内容のJSONプレビュー
- 送信結果 (ジョブごとのタイトル・話数・ステータス) とレスポンス全体の表示

### エラー画面 (`/_errors/:statusCode`)

- 404等のエラー時に表示する汎用エラーページ

## 画面共通 (ヘッダー/フッター、全画面で常時表示)

- グローバル検索バー
- サーバーステータス確認ダイアログ
- ナビゲーション「録画」リンクに録画予約件数バッジを表示
- フッターにバージョン情報・GitHubリンク・管理画面へのリンク

## UI / デザイン方針

画面横断で共通のデザイン方向性。個別画面のモック作成時の絶対条件・禁止パターンの詳細は
`docs/mock-diff/SPEC.md` を参照 (二重管理を避けるため詳細ルールはそちらに集約し、ここでは
アプリ全体としての方向性のみを記す)。

- **コンポーネント基盤**: フロントエンドは CLAUDE.md 記載のスタック通り React + TailwindCSS +
  Shadcn/ui + TanStack Router を使用する。UI は全体的にフラットなデザインを基本とし、
  shadcn の Card 相当 (border 全周 + shadow + 内側 padding) を多用しない。`border-left` の
  アクセント + hover でのフラットなリスト/タイル表現を基本とする方針は、SPEC.md がモック作成時の
  絶対条件として定めているものだが、実装全体の方針としても踏襲する。
- **参考にするUI**: Netflix / Prime Video / Hulu / Crunchyroll / ABEMA など、実際に統合している
  配信サービス自体のUI (ポスターグリッド、ホバー時のプレビュー拡大、横スクロールカルーセル、
  プロバイダごとの見た目の統一感等) を参考にする。
- **アニメーション**: `motion` ライブラリ (package.json に `motion: ^13.4.0` として依存済み、
  `motion/react` から import して使用) を活用し、画面全体にもっとアニメーションを取り入れたい。
  現状 `motion` が使われているのは `src/app/components/loading-spinner.tsx` /
  `src/app/components/error-page.tsx` / `src/app/components/not-found-page.tsx` の3ファイルのみで、
  いずれも状態表示系 (ローディング/エラー/404) の画面に限定されている。一覧のカード表示・詳細画面の
  ヒーロー領域・録画済みトグルなどの主要なインタラクションにはまだアニメーションが使われておらず、
  ここを含めて充実させていく。具体的にどこにどんなアニメーションを入れるかは今後のモック検討・
  実装時に決める。
- **ライト/ダークモード対応**: OS/ブラウザ設定 (`prefers-color-scheme`) に追従してライトモード/
  ダークモードの両方に対応する。SPEC.md の絶対条件が定めるデザイントークン (`:root` の
  `--background` / `--foreground` / `--card` / `--primary` / `--secondary` / `--muted` /
  `--accent` / `--destructive` / `--success` / `--info` / `--warning` / `--border` / `--input` /
  `--ring` や各プロバイダのブランドカラー・放送ステータス用カラーなど) を `@media
  (prefers-color-scheme: dark)` で `.dark` 側の値に差し替える構成は、SPEC.md がモック作成時の
  絶対条件として定めているものだが、実装全体の方針としても踏襲する。実装時も色は必ずこの
  デザイントークン (CSS変数) 経由で参照し、生の `#hex` を直書きしない。

## 画面に依存しない機能

- プロバイダ横断のアニメカタログ管理（Prime Video / Hulu / Crunchyroll / ABEMA）。cron により
  新着エピソード・配信予定・カタログ全体・配信終了間近を定期的に取得し、統合カタログとして保持する。
- AniList 連携によるタイトル識別とメタデータ付与（放送年・クール・放送ステータス等）。
  識別できなかったタイトルは「未識別タイトル」として保持される。
- バッジ付与（新着エピソード・新着追加・配信予定・配信終了予定）とバッジ別の一覧取得。
- Nagisa（録画バックエンド）への録画リクエスト送信、および Webhook 経由での録画進捗
  （完了/失敗）の自動反映。
- ABEMA の HLS 鍵アーカイブ進捗確認・手動キック。
- 画像プロキシ（各プロバイダの画像を WebP に最適化して配信）。

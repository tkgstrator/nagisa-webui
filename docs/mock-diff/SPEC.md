# UI モック作成仕様 (mock-diff 比較用)

Nagisa WebUI (アニメ録画管理アプリ) の UI 案を HTML モックとして作成し、
mock-diff-viewer 上で複数案を並べて比較・選定するための共通仕様。

このアプリが対応する機能の一覧は [FEATURE.md](FEATURE.md) を参照。モック作成前に必ず確認すること。

## 出力先とファイル名

`docs/mock-diff/mocks/<screen-id>-<author>.html`

| screen-id | 画面 | 既存実装 |
|---|---|---|
| `browse` | アニメ一覧 | `src/app/routes/browse/index.tsx` + `-components/` |
| `anime-detail` | アニメ詳細 | `src/app/routes/anime/$id/index.tsx` + `-components/` |
| `recordings` | 録画一覧 | `src/app/routes/recordings/index.tsx` |
| `home` | トップ | `src/app/routes/index.tsx` |
| `settings` | 設定 | (未実装 — このモックが先行する) |

`<author>` は `fable` / `astra` / `final`。`final` は fable と astra から画面・部品ごとに採用案を
選んで 1 枚に合成した決定稿で、どちらを採ったかの唯一の正は
[mock-diff.adopted.yaml](mock-diff.adopted.yaml)。既存 2 案の合成物なので、
新しく案を起こすときの出力先にはしない。

### コンポーネントモック

画面全体ではなく部品単位で状態を並べたカタログ。出力先は

`docs/mock-diff/mocks/components/<component-id>-<author>.html`

| component-id | 部品 | 所属 |
|---|---|---|
| `app-header` | アプリヘッダー | 共通 |
| `app-footer` | アプリフッター | 共通 |
| `pagination` | ページネーション | 共通 |
| `anime-card` | アニメカード | browse |
| `browse-filters` | 絞り込みパネル | browse |
| `filter-chips` | 適用中フィルタチップ | browse |
| `anime-drawer` | 作品概要ドロワー | browse |
| `anime-hero` | 作品ヒーロー | anime-detail |
| `episode-list` | エピソード一覧 | anime-detail |
| `related-providers` | 他プロバイダ一覧 | anime-detail |
| `breadcrumbs` | パンくず | anime-detail |
| `recording-row` | 録画一覧の行 | recordings |
| `recordings-toolbar` | 録画一覧ツールバー | recordings |
| `empty-state` | 空状態 | recordings |
| `recordings-calendar` | 週カレンダー | recordings |
| `summary-stats` | 録画状況サマリ | home |
| `anime-carousel` | 作品カルーセル | home |
| `scheduled-updates` | 直近更新リスト | home |
| `home-tabs` | ホームタブ | home |

画面モックは実装との差分検証 (`actual: {type: url}`) に使うので残す。コンポーネントモックは
実装側に単体ページが存在しないため `actual` を持たず、案の選定 (Deciding) 専用。

## 絶対条件

1. **単一 HTML ファイルで完結**。外部 CSS / JS / フォント / 画像を一切参照しない
   (CDN 禁止、`<link href="https://...">` 禁止、`<img src="https://...">` 禁止)。
   スタイルは `<style>` にインラインで書く。JS は原則不要、必要なら `<script>` にインライン。
2. **ポスター画像はプレースホルダで表現**する。CSS グラデーション + インライン SVG + タイトル文字を
   組み合わせて「そこに画像が入る」と分かる見た目にする。作品ごとに色相を変えて単調さを避ける。
   実データのポスター/サムネイル画像は **16:9 (`aspect-video`) しか存在しない**。縦長ポスター
   (2:3 等) やスクエア画像は実装・実データともに存在しないため、モックでも使わないこと。
3. **下記のデザイントークンをそのまま `:root` にコピーして使う**。色は必ずこのトークン経由で参照し、
   生の `#hex` を直書きしない。ダークモードは `@media (prefers-color-scheme: dark)` で
   `.dark` 側の値に差し替える。
4. **レスポンシブ**。desktop 1440x900 と mobile 390x844 の両方でレンダリングされるので、
   `@media (max-width: 640px)` などで両対応させる。横スクロールを発生させない。
5. **日本語のダミーデータ**を入れる。アニメタイトルは実在の雰囲気の架空タイトルで 12〜24 件程度。
   プロバイダは Prime Video / Hulu / Crunchyroll / ABEMA / Netflix。
6. フォントは `font-family: 'Geist Variable', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif`
   (読み込みはせず、フォールバックに任せる)。

## 禁止パターン

- **カード型の重い囲み枠を多用しない**。shadcn の Card 相当 (border 全周 + shadow + 内側 padding) は使わない。
  代わりに `border-left: 3px solid var(--primary)` のアクセント + `hover` で
  `background: var(--muted)` になるフラットなリスト/タイル表現を基本とする。
  ただしポスター画像を主役にするグリッドではこの限りではない (画像そのものがカードの役割を果たすため)。
- 情報を 1 セルに詰め込まない。表で複合指標を出す場合は列を分ける (例: `12/24話` ではなく `録画` `全話` を別列)。
- 数値・話数は等幅 (`font-variant-numeric: tabular-nums`) で右寄せ。

## デザイントークン (この 2 ブロックをそのままコピーする)

```css
:root {
  --background: oklch(0.99 0.002 247);
  --foreground: oklch(0.18 0.005 250);
  --card: oklch(0.99 0.002 247);
  --card-foreground: oklch(0.18 0.005 250);
  --popover: oklch(0.99 0.002 247);
  --popover-foreground: oklch(0.18 0.005 250);
  --primary: oklch(0.55 0.18 265);
  --primary-foreground: oklch(0.98 0.005 250);
  --secondary: oklch(0.96 0.005 250);
  --secondary-foreground: oklch(0.22 0.005 250);
  --muted: oklch(0.96 0.005 250);
  --muted-foreground: oklch(0.52 0.01 250);
  --accent: oklch(0.95 0.01 265);
  --accent-foreground: oklch(0.32 0.12 265);
  --destructive: oklch(0.62 0.22 27);
  --destructive-foreground: oklch(0.98 0.005 250);
  --success: oklch(0.62 0.16 152);
  --success-foreground: oklch(0.98 0.005 250);
  --info: oklch(0.6 0.16 245);
  --info-foreground: oklch(0.98 0.005 250);
  --warning: oklch(0.72 0.16 75);
  --warning-foreground: oklch(0.22 0.05 75);
  --overlay: oklch(0.18 0.005 250 / 70%);
  --overlay-foreground: oklch(0.98 0.005 250);
  --border: oklch(0.9 0.005 250);
  --input: oklch(0.9 0.005 250);
  --ring: oklch(0.6 0.13 265 / 50%);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0.002 247);
  --brand-amazon: oklch(0.6 0.12 245 / 16%);
  --brand-amazon-foreground: oklch(0.42 0.16 245);
  --brand-hulu: oklch(0.62 0.16 152 / 16%);
  --brand-hulu-foreground: oklch(0.4 0.16 152);
  --brand-crunchyroll: oklch(0.7 0.18 50 / 18%);
  --brand-crunchyroll-foreground: oklch(0.45 0.18 50);
  --brand-abema: oklch(0.78 0.18 130 / 22%);
  --brand-abema-foreground: oklch(0.4 0.16 130);
  --brand-netflix: oklch(0.62 0.22 27 / 16%);
  --brand-netflix-foreground: oklch(0.45 0.2 27);
  --status-releasing: oklch(0.65 0.16 145 / 18%);
  --status-releasing-foreground: oklch(0.4 0.14 145);
  --status-finished: oklch(0.6 0.005 250 / 18%);
  --status-finished-foreground: oklch(0.42 0.005 250);
  --status-not-yet: oklch(0.78 0.15 80 / 22%);
  --status-not-yet-foreground: oklch(0.4 0.12 75);
  --status-cancelled: oklch(0.62 0.22 27 / 16%);
  --status-cancelled-foreground: oklch(0.45 0.2 27);
  --status-hiatus: oklch(0.7 0.18 50 / 18%);
  --status-hiatus-foreground: oklch(0.45 0.18 50);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.16 0.005 250);
    --foreground: oklch(0.96 0.003 250);
    --card: oklch(0.21 0.005 250);
    --card-foreground: oklch(0.96 0.003 250);
    --popover: oklch(0.21 0.005 250);
    --popover-foreground: oklch(0.96 0.003 250);
    --primary: oklch(0.55 0.22 265);
    --primary-foreground: oklch(0.98 0.005 250);
    --secondary: oklch(0.27 0.005 250);
    --secondary-foreground: oklch(0.96 0.003 250);
    --muted: oklch(0.27 0.005 250);
    --muted-foreground: oklch(0.7 0.005 250);
    --accent: oklch(0.32 0.04 265);
    --accent-foreground: oklch(0.9 0.05 265);
    --border: oklch(0.32 0.005 250);
    --input: oklch(0.32 0.005 250);
    --sidebar: oklch(0.18 0.005 250);
    --brand-amazon: oklch(0.55 0.16 245 / 28%);
    --brand-amazon-foreground: oklch(0.82 0.12 245);
    --brand-hulu: oklch(0.6 0.16 152 / 28%);
    --brand-hulu-foreground: oklch(0.82 0.13 152);
    --brand-crunchyroll: oklch(0.7 0.18 50 / 28%);
    --brand-crunchyroll-foreground: oklch(0.82 0.14 50);
    --brand-abema: oklch(0.78 0.18 130 / 28%);
    --brand-abema-foreground: oklch(0.85 0.16 130);
    --brand-netflix: oklch(0.62 0.22 27 / 28%);
    --brand-netflix-foreground: oklch(0.82 0.16 27);
    --status-releasing: oklch(0.65 0.16 145 / 26%);
    --status-releasing-foreground: oklch(0.82 0.14 145);
    --status-finished: oklch(0.6 0.005 250 / 26%);
    --status-finished-foreground: oklch(0.78 0.005 250);
    --status-not-yet: oklch(0.78 0.15 80 / 26%);
    --status-not-yet-foreground: oklch(0.85 0.13 75);
    --status-cancelled: oklch(0.62 0.22 27 / 26%);
    --status-cancelled-foreground: oklch(0.82 0.16 27);
    --status-hiatus: oklch(0.7 0.18 50 / 26%);
    --status-hiatus-foreground: oklch(0.82 0.14 50);
  }
}
```

## ドメイン用語 (日本語ラベル)

- プロバイダ: `amazon`→Prime Video / `hulu`→Hulu / `crunchyroll`→Crunchyroll / `abema`→ABEMA / `netflix`→Netflix
- 放送ステータス: `RELEASING`→放送中 / `FINISHED`→完結 / `NOT_YET_RELEASED`→未放送 / `CANCELLED`→中止 / `HIATUS`→休止
- バッジ: `NEW_EPISODE`→新着エピソード / `RECENTLY_ADDED`→新着追加 / `COMING_SOON`→配信予定 / `EXPIRING`→配信終了予定
- 録画状態: 未録画 / 録画中 / 録画済み / 失敗
- クール: 2026年 冬・春・夏・秋

## 画面ごとの要件

### browse — アニメ一覧
検索バー、フィルタ (プロバイダ / 年 / クール / ステータス / バッジ)、ソート、
アニメのグリッド (ポスター + タイトル + プロバイダバッジ + ステータス)、ページネーション。
24 件/ページ想定。フィルタはサイドバーでもポップオーバーでも案次第。

### anime-detail — アニメ詳細
ヒーロー領域 (ポスター + タイトル + 放送情報 + あらすじ + アクション)、
エピソードのグリッド/リスト (話数・サブタイトル・録画状態のトグル)、
同一作品を配信している他プロバイダの一覧。全 24 話程度。
ヒーロー領域のポスター画像も 16:9 で表現する (縦長ポスターや画像なしの抽象バナーにしない)。

### recordings — 録画一覧
録画済み作品の一覧と進捗 (録画済み話数 / 全話数)、プロバイダ、最終更新日時、
絞り込みと並べ替え。一覧の形式 (テーブル / リスト / タイムライン) は案次第。

### home — トップ
ダッシュボード的な入口。録画状況のサマリ、直近の新着エピソード、
継続視聴中の作品、各画面への導線。

### settings — 設定
表示 (テーマ / 表示件数 / 並び順 / 密度 / アニメーション)、配信プロバイダの有効・無効、
録画のふるまい (自動予約 / 一括解除の確認 / 配信終了の予告日数)、データ (キャッシュ / 書き出し /
初期化)、アプリ情報 (バージョン・ビルド・件数)。`/admin` 配下の管理画面への導線も
「管理」セクションとしてこの画面に内包し、独立した管理ハブのモックは作らない。

保存ボタンは置かず**変更は即時反映**とし、保存済みであることは見出し脇の表示で伝える。
この画面だけは実装が存在しないため `mock-diff.yaml` に `actual` を持たせない
(実装後に他の画面と同じ形で `url` を足す)。

## コンポーネントモックの書き方 (状態カタログ)

部品単体を 1 つだけ置くのではなく、**その部品が取りうる状態を 1 ファイルに並べる**。
案ごとの違いが部品そのものの差として読めるよう、外枠 (カタログハーネス) は全ファイルで共通にする。

### 構成の順序

1. `<header class="cat-head">` — `<h1>日本語名 <span class="cat-id">component-id</span></h1>`、
   説明文 `<p>`、`<div class="cat-meta">` に使う場所・案の性格・主要な寸法を 3〜5 個
2. `<section class="cat-sec">` を状態の軸ごとに並べる。`<h2>` が軸の見出し、
   補足は `<span class="cat-hint">`
3. 最初のセクションは「基本」。その代表例の `.cat-item` に `is-key` を付ける
4. 以降は状態違い (通常 / hover / 選択中 / 録画中 / 失敗 / 空 / 読み込み中)、
   種別違い (プロバイダ 5 種 / 放送ステータス 5 種) を並べる。
   各 `.cat-item` には `.cat-label` で日本語のラベルを付ける
5. 必要なら末尾に `.cat-note` で設計意図を 1〜2 行

### 1 状態だけを見る (`data-story`)

カタログは作る側の形であって、1 状態だけを確かめたいときには他が邪魔になる。
ビルド時に `src/story.ts` が **`data-story="<節の見出し> / <ラベル>"`** を自動で打つので、
mock-diff の viewer で状態を選ぶと、それ以外が隠れて 1 状態だけが残る。手で書く必要はない。

- 目印が付くのは `.cat-label` を直に抱えている要素と、ラベルを 1 つも含まない `.cat-item`
- 中に複数のラベル付き見本を並べている外枠には付かない (隠すと中身ごと消えるため)
- 同じ名前が 1 ファイル内で重なったら ` 2` ` 3` の連番になる。区別したい状態には別のラベルを付ける
- `cat-head` と `<h2>` は目印を持たないので、どの状態を選んでも見出しは残る

### ホバーなど擬似クラスの見せ方

静的な HTML なので `:hover` は撮影できない。`:hover` / `:focus-visible` / `:focus-within` の
ルールには **`.is-hover` / `.is-focus` を併記したコピーを用意**し、カタログ側では該当要素に
`class="... is-hover"` を付けて状態を固定して見せる。入れ子の子要素にも必要なら手で付ける。

```css
.tile:hover, .tile.is-hover { transform: translateY(-4px); }
```

### `position: fixed` の部品

ドロワー・モーダル・ボトムシートはそのままではカタログに収まらない。
`position: relative; overflow: hidden;` と固定高さを持つ `.stage` を舞台として置き、
その中で `position: absolute` に読み替える。背後の画面は `.behind`、暗幕は `--overlay` を使う。
舞台から出して単体で並べたい場合は `.is-standalone` で `position: static` に戻す。

### カタログハーネス (この 1 ブロックをそのままコピーする)

デザイントークンと同様、**全コンポーネントモックで完全に同一**にする。

```css
/* ---------- catalog harness (全コンポーネントモック共通) ---------- */
.cat { max-width: 1280px; margin: 0 auto; padding: 28px 32px 64px; }
.cat-head { border-left: 3px solid var(--primary); padding-left: 14px; margin-bottom: 28px; animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
.cat-head h1 { font-size: 20px; font-weight: 700; letter-spacing: -.01em; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cat-id { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 12px; font-weight: 600; color: var(--muted-foreground); padding: 2px 8px; background: var(--muted); border-radius: 999px; }
.cat-head p { margin-top: 6px; font-size: 13px; color: var(--muted-foreground); max-width: 68ch; }
.cat-meta { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 11.5px; color: var(--muted-foreground); }
.cat-meta code, .cat-note code { font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 11px; color: var(--foreground); }

.cat-sec { margin-top: 32px; animation: fadeUp .4s cubic-bezier(.16,1,.3,1) both; }
.cat-sec > h2 {
  font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--muted-foreground);
  padding-bottom: 7px; margin-bottom: 18px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.cat-sec > h2 .cat-hint { font-weight: 500; letter-spacing: 0; text-transform: none; font-size: 11.5px; opacity: .85; }

.cat-row { display: flex; flex-wrap: wrap; gap: 22px 20px; align-items: flex-start; }
.cat-stack { display: flex; flex-direction: column; gap: 18px; }
.cat-item { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.cat-item > .cat-label { order: -1; }
.cat-label { font-size: 11px; font-weight: 600; color: var(--muted-foreground); display: flex; align-items: center; gap: 6px; }
.cat-label::before { content: ''; width: 5px; height: 5px; border-radius: 999px; background: var(--border); flex: none; }
.cat-item.is-key > .cat-label::before { background: var(--primary); }
.cat-label small { font-weight: 500; opacity: .8; }
.cat-w220 { width: 220px; } .cat-w260 { width: 260px; } .cat-w320 { width: 320px; }
.cat-full { width: 100%; }
.cat-note { margin-top: 12px; font-size: 12px; color: var(--muted-foreground); border-left: 2px solid var(--border); padding-left: 10px; }

/* 枠 = 部品の外形を示すためだけの薄い当て木。部品自身の装飾ではない */
.cat-frame { border: 1px dashed var(--border); border-radius: calc(var(--radius) - 2px); padding: 14px; background: color-mix(in oklch, var(--muted) 35%, transparent); }
.cat-frame.is-plain { background: var(--background); }

@media (max-width: 640px) {
  .cat { padding: 20px 16px 48px; }
  .cat-head h1 { font-size: 17px; }
  .cat-row { gap: 18px 14px; }
  .cat-w220, .cat-w260, .cat-w320 { width: 100%; }
}
```


# モックのソース

`mocks/*.html` は**生成物**。編集するのはこの `src/` 配下だけで、`bun run src/build.ts` で書き出す。

```
src/build.ts                       ビルド (page / comp の 2 モード)
src/check.ts                       検証 (はみ出し・衝突)
src/story.ts                       カタログの各状態に data-story を打つ (comp のみ)
src/parts/tokens.css               OKLCH デザイントークン (両案共通)
src/parts/base.css                 リセットと最小限の共通定義 (両案共通)
src/parts/harness.css              コンポーネントカタログの枠 (.cat*) — ページでは使わない
src/parts/page-<author>.css        ページ骨格。pg- 名前空間のみ
src/comp/<id>-<author>.css         部品のスタイル (これが唯一の正)
src/comp/<id>-<author>.html        部品の状態カタログ
src/comp/<id>-<author>.stage.css   position:fixed な部品をカタログで見せる舞台。ページでは読まれない
src/pages/<id>-<author>.html       ページのフラグメント
```

`<author>` は `fable` / `astra` の 2 案。

## ページフラグメントの書式

先頭にメタ行、`---` だけの行で区切って本文（`<body>` の中身そのもの）。

```
TITLE: アニメ一覧
USES: app-header anime-card browse-filters filter-chips anime-drawer pagination app-footer
---
<header class="hdr">
  ...
```

| メタ | 要否 | 意味 |
| --- | --- | --- |
| `TITLE` | 必須 | `<title>` に入る画面名 |
| `USES` | 必須 | 使う部品 id を空白区切りで。`comp/<id>-<author>.css` が存在しないとビルドが落ちる。`<id>@<author>` と書くとその部品だけ作者を固定する（例: fable ページに astra のヘッダ） |
| `SKELETON` | 任意 | 骨格 CSS の名前。`parts/page-<SKELETON>.css` を使う（省略時は `page-<author>.css`）。final ページでは `page-final-<SKELETON>.css` で、こちらは必須 |
| `BODY` | 任意 | `<body>` に足す属性。先頭に空白を入れて ` class="dark"` のように書く |

ビルドは `tokens.css` + `base.css` + 骨格 CSS + `USES` の部品 CSS を順に連結するだけ。
部品 CSS は **`comp/` のものをそのまま**取り込む（カタログ用の `.is-hover` 変換はページでは行わない）。

部品カタログのメタにも `USES:` を指定できる。`dependencies.ts` が依存部品を再帰的に展開し、
依存先から順に各 CSS を一度だけ取り込む。カタログとページと検証で同じ依存解決を使う。
存在しない部品と循環依存はエラー。`.stage.css` はカタログ専用で、依存先からは取り込まない。

## 原則

1. **部品のクラスは `comp/*.css` が正**。ページ側で再定義しない。ページの HTML は部品カタログ
   （`src/comp/<id>-<author>.html`）に出てくるマークアップをそのまま使い、クラス名を勝手に変えない。
   ページでだけ見た目を変えたいときは、部品の既定値は触らず `is-*` 修飾クラスを部品 CSS に足す。
2. **骨格は `pg-` 名前空間だけ**。ページ固有の余白・段組み・見出しは `page-<author>.css` に
   `pg-*` で足す。部品と同じクラス名は作らない（`check.ts` が弾く）。
3. 同じ見た目のものを別名で二重実装しない。既存の `mocks/<id>-<author>.html` に独自クラスが
   あっても、対応する部品があればそちらのクラスへ寄せる。
4. 生 `#hex` は書かない。色は `tokens.css` の CSS 変数（`var(--primary)` 等）を使う。
5. 単一 HTML 完結。外部 CSS / JS / フォント / 画像・CDN は使わない。

## ページ構成

| ページ | USES |
| --- | --- |
| `browse` | `app-header anime-card browse-filters filter-chips anime-drawer pagination app-footer` |
| `anime-detail` | `app-header breadcrumbs anime-hero episode-list related-providers app-footer` |
| `recordings` | `app-header recordings-toolbar recording-row recordings-calendar empty-state pagination summary-stats app-footer` |
| `home` | `app-header summary-stats anime-carousel scheduled-updates home-tabs app-footer` |
| `changelog` | `app-header app-footer` |
| `admin` | `app-header nav-item app-footer` |
| `admin-unidentified` | `app-header input button pagination recording-events app-footer` |
| `admin-recorder` | `app-header input toggle button app-footer` |
| `admin-abema` | `app-header stat-tile button app-footer` |
| `admin-logs` | `app-header stat-tile status-badge toggle button pagination app-footer` |
| `admin-log-detail` | `app-header stat-tile status-badge app-footer` |
| `admin-status` | `app-header stat-tile app-footer` |

`fable` はヘッダー横並び（`.hdr`）、`astra` はサイドバー（`.side`）+ 本文の 2 ペイン（`.pg-shell` > `.side` + `.pg-main`）。

## 検証

```sh
bun run src/build.ts                      # 全部ビルド
bun run src/build.ts browse-fable         # 個別
bun run src/check.ts                      # 全ページ + 衝突チェック
bun run src/check.ts browse-fable
```

`check.ts` が見るのは 2 つ。**どちらも 0 でなければ不合格**。

- **はみ出し** — ページ HTML に現れるクラスのうち、`base.css` / `page-<author>.css` /
  `USES` の部品 CSS のどれにも定義が無いもの。0 なら骨格と部品だけで出来ている。
- **衝突** — `page-<author>.css` と部品 CSS が同じクラス名を定義しているもの。値が相互に漏れる。

## 反映

`mocks/` を更新しただけでは mock-diff-viewer は撮り直さない（`/data` にキャッシュする）。

```sh
curl -s -X POST http://mock-diff:3000/api/compare   # 全件再撮影 (約 7 秒)
```

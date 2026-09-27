# Nagisa WebUI — 録画管理アプリ

Prime Video / Hulu / Crunchyroll / ABEMA の今期アニメを管理し、録画状況を追跡するアプリ。

## 機能概要

1. **アニメ一覧** — 各プロバイダ (amazon, hulu, crunchyroll, abema) のアニメをブラウザで一覧表示
2. **録画チェック** — 一覧からアニメを選択し録画済みチェックマークを付ける
3. **話数管理** — 何話まで録画済みかを D1 で管理
4. **録画リスト API** — `GET /api/episodes?recorded=true` でプロバイダ名・コンテンツ ID 付きの録画済みエピソード一覧を返す

## 現状（実装済み）

- [x] Prisma + D1 スキーマ (`prisma/schema.prisma`, `prisma/migrations/`)
- [x] Backend API (`src/routes/*.ts`) — anime / episodes / recorder / recording-library / recording-jobs / admin / img
- [x] Zod スキーマ (`src/schemas/*.dto.ts`, `src/schemas/providers/*.dto.ts`) — バリデーション定義
- [x] OpenAPI ドキュメント (`/docs`, `/openapi.json`)
- [x] Vite + Cloudflare Workers ビルド設定
- [x] Lambda fetch API (`lambda/fetch/`) — 日本 IP / US IP 必須のプロバイダ取得代行

## ディレクトリ構造

```
prisma/
├── schema.prisma                  # Prisma スキーマ定義
└── migrations/                    # D1 マイグレーション (Prisma 形式)
src/
├── index.ts                       # Hono エントリポイント (Workers)
├── queue.ts                       # SYNC_QUEUE コンシューマ
├── scheduled.ts                   # Cron トリガー
├── lib/                           # 共有ユーティリティ
│   ├── db.ts                      # PrismaClient + D1 Adapter
│   ├── lambda.ts                  # Lambda fetch クライアント (SigV4)
│   ├── sync.ts                    # SyncService (Lambda 結果 → DB)
│   ├── merge.ts                   # 複数プロバイダのエピソードマージ
│   ├── cache.ts                   # KV キャッシュラッパ
│   ├── logger.ts                  # LogTape 設定
│   ├── discord.ts                 # Discord webhook 通知
│   ├── metadata/                  # AniList / TMDB アダプター
│   └── providers/                 # プロバイダ実装
│       ├── base.ts                # Provider 抽象クラス
│       ├── amazon/                # Prime Video
│       ├── hulu/                  # Hulu
│       ├── crunchyroll/           # Crunchyroll (US IP 必須)
│       └── abema/                 # ABEMA
├── routes/                        # Hono ルート (Backend API)
│   ├── anime/                     # /api/anime (一覧・詳細・/{id}/recording-jobs・/{id}/refresh)
│   ├── episodes.ts                # /api/episodes (recorded フラグの参照・PATCH 更新)
│   ├── recorder.ts                # /api/recorder (録画サーバーの status / queue snapshot)
│   ├── recording-library.ts       # /api/recording-library (録画台帳の stats / sync-state / sync)
│   ├── recording-jobs.ts          # /api/recording-jobs (単体録画ジョブ投入)
│   ├── admin.ts                   # /api/admin (Cloudflare Access 保護)
│   ├── admin-logs.ts              # /api/admin 配下の観測系 (sync-runs / recording-events / logs/entries)
│   └── img.ts                     # /img (画像プロキシ + WebP 最適化)
├── schemas/                       # Zod スキーマ
│   ├── anime.dto.ts
│   ├── recording.dto.ts
│   ├── message.dto.ts             # キューメッセージ
│   ├── lambda.dto.ts              # Lambda fetch API
│   ├── webhook.dto.ts             # Nagisa webhook
│   ├── nagisa.dto.ts
│   └── providers/                 # プロバイダ生レスポンスのスキーマ
│       ├── common.dto.ts          # TitleSchema / EpisodeSchema 等
│       ├── metadata.dto.ts        # AniList / TMDB
│       ├── amazon.dto.ts
│       ├── hulu.dto.ts
│       ├── crunchyroll.dto.ts
│       └── abema.dto.ts
└── app/                           # Frontend (React)
    ├── main.tsx                   # React エントリ
    ├── lib/                       # フロント側ユーティリティ
    │   ├── api.ts                 # Zodios クライアント
    │   ├── atoms.ts               # Jotai atoms
    │   ├── query-keys.ts
    │   ├── query-options.ts
    │   ├── query-client.ts
    │   └── constants.ts
    ├── components/                # 共有コンポーネント
    │   └── ui/                    # Shadcn/ui primitives (編集禁止)
    └── routes/                    # TanStack Router (ディレクトリ分離)
        ├── __root.tsx             # ルートレイアウト
        ├── index.tsx              # / トップページ
        ├── browse/                # /browse プロバイダ別ブラウズ
        ├── anime/                 # /anime/:id 詳細
        ├── recordings/            # /recordings 録画一覧
        ├── changelog/             # /changelog
        └── _errors/               # エラー画面
lambda/
└── fetch/                         # 日本 IP / US IP 必須の取得を代行する Lambda
    ├── index.ts
    └── build.ts
scripts/
├── db/                            # D1 migration / reset / seed
└── lambda/                        # Lambda invoke / local execute
```

# CLAUDE.md

## Project Overview

Cloudflare Workers上で動作するフルスタックアプリケーションのテンプレート。

- **Frontend**: React + TailwindCSS + Shadcn/ui + TanStack Router
- **Backend**: Hono (OpenAPI対応) on Cloudflare Workers
- **Build**: Vite + @cloudflare/vite-plugin

## Commands

- `bun run dev` — 開発サーバー起動
- `bun run build` — ビルド (`CLOUDFLARE_ENV` でモード指定、デフォルト staging)
- `bun run deploy` — Cloudflare Workers へデプロイ

## Lint / Type Check

大きな変更を入れた際は、以下のチェックを必ず通すこと。

```sh
bunx tsc -b --noEmit        # 型チェック
bunx biome check src/        # lint + format チェック
```

## Runtime

- パッケージマネージャおよびランタイムは **Bun** を使用する
- `npx` / `npm` / `yarn` は使わず、`bunx` / `bun` を使うこと

## Validation / API

- バリデーションには **Zod** を使用する
- API通信には **Zodios** を使用する
- Zodスキーマは `schemas/*.dto.ts` にパスカルケースで定義する

### Backend ルート (Hono)

- バックエンドのルートは **Zod Hono OpenAPI** (`OpenAPIHono` + `createRoute`) で定義する
- リクエストの body / query / params は `createRoute({ request: { body, query, params } })` で **Zod スキーマを宣言** し、ハンドラ内では `c.req.valid('json' | 'query' | 'param')` で受け取る
  - `await c.req.json()` を直接呼んで `XxxSchema.safeParse(...)` する書き方は禁止 (型推論が効かず OpenAPI ドキュメントにも出ない)
  - 素の `app.post(...)` ではなく `app.openapi(createRoute({...}), handler)` を使う

## Frontend Routing

- ルーティングは **TanStack Router** のファイルベースルーティングを使用する
- ルートは **必ずディレクトリで分けて `index.tsx`** を配置する（フラットなファイル名は使わない）
  - 例: `src/app/routes/recordings/index.tsx` → `/recordings`
  - 動的ルート: `src/app/routes/anime/$id/index.tsx` → `/anime/:id`

## Database

- データベースは **Cloudflare D1** を使用する
- ORM は **Prisma** を使用する（`@prisma/client` + `@prisma/adapter-d1`）
- Prisma の使い方・マイグレーション手順は `.claude/skills/prisma-d1.md` を参照すること

## 環境変数 / 認証情報

- ローカルで CLI 操作（wrangler / aws / 各種スクリプト）をする前に **必ず `source .env`** すること。`.env` の値は更新されやすい。
- **認証情報は用途ごとに別物**。特に **R2 のキーを `AWS_*` という名前で持たない**（後述の理由で事故る）。

| 用途 | 置き場所 | 変数名 / 取得元 | 消費者 |
|---|---|---|---|
| Cloudflare API | `.env` | `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | wrangler, CF API |
| AWS プロバイダ (ECR push) | コンテナのシェル env | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（**本物の AWS** = IAM ユーザー `Terraform`, account `801945369170`） | `aws` CLI, docker login |
| Worker → Lambda Function URL 署名 | `.dev.vars` / wrangler secret | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`（**本物の AWS** = lambda_invoker） | Worker の aws4fetch |

Lambda 関数本体の Terraform state と AWS リソースは `qtmleap/infra` 側で管理する（詳細は下記「Lambda デプロイ」節）。

- **`~/.aws` は R2 専用**（ホストから readonly bind mount。`devcontainer.json` の `mounts` 参照）。`[default]` / `[r2]` の両プロファイルとも中身は R2 キーで、**`[default]` に R2 の `endpoint_url` が設定されている**。
  - このため素の `aws sts` / `aws ecr` は R2 に飛び、`InvalidRequest: Missing x-amz-content-sha256` で失敗する。CLI の表示は `An error occurred (Unknown)` としか出ないので、`aws ... --debug 2>&1 | grep url` でリクエスト先を確認すること。
  - ECR など**本物の AWS を叩くときは `AWS_CONFIG_FILE=/dev/null` で config を読ませず、`--region` を明示**する（`lambda/fetch/build.ts` の `AWS_ENV` が実装済み）。資格情報はシェル env 側が profile より優先されるので、これだけで `Terraform` ユーザーとして通る。
  - readonly マウントなのでコンテナ側から `~/.aws/config` は直せない。ホスト側の設定は R2 用に意図的なものなので書き換えないこと。

- **禁止**: R2 のキーを `.env` に `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` という名前で置くこと。理由:
  - `aws` CLI / docker login が R2 キーを AWS 認証として誤用し失敗する（AWS の認証チェーンが `AWS_*` env を最優先するため）。
  - `scripts/cloudflare/set-secrets.sh` は `.env` の全キーを `wrangler secret put` するので、`AWS_*` が R2 キーだと **Worker の Lambda 呼び出し (aws4fetch、本物の AWS キーが必要) が壊れる**。

### Lambda デプロイ (ECR + Terraform in qtmleap/infra)

Lambda 本体の Terraform 管理はこのレポには置かない。**AWS リソースは全て `qtmleap/infra` の `services/aws/lambda/` に集約**する。このレポの責務は「ECR に Docker image を push すること」だけ。

- `bun run deploy:lambda` → `lambda/fetch/build.ts` が buildx で arm64 image を build し ECR (`801945369170.dkr.ecr.ap-northeast-1.amazonaws.com/anime-tracker/fetch`) に `<sha>` と `latest` の 2 タグで push する。東京・US 両リージョンの ECR に同一 image を push する（Lambda の container image は関数と同一リージョンの ECR にしか置けないため）。
- push 完了後、Lambda 関数の image_uri を更新するには `qtmleap/infra` 側で:

  ```sh
  cd ~/infra/services/aws/lambda
  export TF_VAR_anime_tracker_image_tag=<sha>
  terraform apply
  ```

- 東京 (`anime-tracker-fetch`) と US (`anime-tracker-fetch-us`) は同一 image を使う (US は cross-region pull)。
- 前提: 事前に `qtmleap/infra` 側で ECR リポジトリを apply 済みであること。docker + aws CLI (default profile に ECR: PutImage 権限) が利用可能なこと。

## Project Documentation

- プロジェクト概要・機能・ディレクトリ構造 → `docs/PROJECT.md`
- ロードマップ（Phase 0〜4） → `docs/ROADMAP.md`
- 機能別の計画書 → `docs/features/`

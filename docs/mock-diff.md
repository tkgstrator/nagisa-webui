# mock-diff-viewer 導入ガイド

[`qtmleap/mock-diff-viewer`](https://github.com/qtmleap/mock-diff-viewer) を使った、デザイン候補の選定と実装検証のワークフロー。

## mock-diff-viewer とは

デザイン候補を並べて比較・選定し、実装を進め、実装結果を選ばれたデザインとピクセル差分で比較するためのツール。以下の 3 フェーズで構成される。

| フェーズ | 内容 |
|---|---|
| Deciding | 画面ごとに複数のデザイン候補(mocks / variants)を並べて比較し、採用するものを選ぶ |
| Building | 選ばれたデザインをもとに実装を進める |
| Checking | 実装結果(actual)を採用済みデザインとピクセル差分で比較し、乖離を検出する |

本体は Docker sidecar として動作する HTTP API + UI で、Claude Code からは MCP プラグイン (`mock-diff@qtmleap-plugins`) 経由で操作する。

## sidecar の起動方法

`docker compose` サービスとして `.devcontainer/compose.yaml` に `mock-diff` を定義済み。通常は以下で起動する。

```bash
docker compose -p nagisa-webui_devcontainer -f .devcontainer/compose.yaml up -d mock-diff
```

`-p nagisa-webui_devcontainer` は必須。compose はプロジェクト名を省略すると compose ファイルの親ディレクトリ名(`.devcontainer` → `devcontainer`)から勝手に名前を作るため、devcontainer CLI が起動した本物のサービス群とは別のプロジェクトに、中身が空の二重起動コンテナができてしまう。見分け方は `docker ps` のコンテナ名で、正しいのは `nagisa-webui_devcontainer-mock-diff-1`。

**注意: devcontainer 内(コンテナ内のシェル)からこのコマンドを実行しないこと。** このプロジェクトの devcontainer は docker-outside-of-docker 構成のため、コンテナ内から `docker compose up` を実行すると `compose.yaml` 内の相対パスの volume マウント(`../docs/mock-diff` など)が「ホスト側」の Docker デーモンで解決されてしまい、存在しないパスが誤って空ディレクトリとして作成される。

実際には **devcontainer を再オープン(Reopen in Container / Rebuild Container)することで、sidecar は自動的に正しく起動する。** compose ファイルの構文確認だけなら以下が安全に実行できる(daemon 側の volume 解決を伴わない)。

```bash
docker compose -f .devcontainer/compose.yaml config
```

起動後、ホストのブラウザから `http://localhost:14755/mock-diff` を開くと viewer の UI が見られる。

compose では `ports` を宣言していない。viewer の UI は vite dev server (`14755`) の `/mock-diff` に相乗りさせている(`vite.config.ts` の `server.proxy`)。ホストに増えるポートが無いので、mock-diff sidecar を持つ repo を何個同時に立てても衝突しない。固定の公開ポートを compose に書くとここが割れる。

ただし viewer の client は `/mock-diff` 配下に居てもルート相対 URL(`/api/screens` など)を出すので、`/assets` も `server.proxy` に並べてある。

`/api/*` だけは `server.proxy` では勝てない。`@cloudflare/vite-plugin` が `configureServer` の中で middleware を直接 `use` するため、vite が proxy を挟むより前にアプリ側 Worker が並び、`/api/screens` は Hono の `404`(`text/plain`)になる。そこで `vite.config.ts` に `enforce: 'pre'` の `mock-diff-api-proxy` plugin を置き、Worker より手前で sidecar へ横流ししている。対象は `MOCK_DIFF_API_PATHS`(現在は `/api/screens` `/api/compare` `/api/workspace`)で、viewer 側にエンドポイントが増えたらここに足す。

アプリ側の API 名前空間(`/api/admin` `/api/anime` `/api/episodes` `/api/img` `/api/recorder` `/api/recording-library` `/api/recording-jobs`)とは衝突していない。将来 viewer 側と同名のパスが生えると先取りされる点にだけ注意する。

## 撮影先が compose のサービス名ではなくコンテナ名な理由

`docs/mock-diff/mock-diff.yaml` の `actual` は `http://nagisa-webui_devcontainer-app-1:14755/<path>` を指す。app と mock-diff は同じ compose ネットワークに居るので、素直に考えればサービス名の `app` で届くはずで、実際 HTTP としては届いている。問題は Chromium 側にある。

Chromium は `.app` gTLD を HSTS preload リストに丸ごと載せており、単一ラベルのホスト名 `app` もこれに一致する。`http://app:14755/` は問答無用で `https://app:14755/` に昇格され、TLS を話さない vite が平文で応答した時点でハンドシェイク失敗になり、撮影が必ず `net::ERR_SSL_PROTOCOL_ERROR` で落ちる。末尾ドット(`http://app.:14755/`)でも同じだった。コンテナ名 `nagisa-webui_devcontainer-app-1` はこの gTLD に当たらないので昇格されない。

もう一つのゲートが vite 側で、5.4.12 以降は Host ヘッダが localhost 以外だと既定で `403` を返す。そのためこのホスト名は `vite.config.ts` の `server.allowedHosts` にも入れてある。ホスト名がコンテナ名である以上、compose のプロジェクト名(`nagisa-webui_devcontainer`)に依存する点には注意する — 起動時に `-p` を付けるべき理由がここにもある。

なお IP アドレス直指定(`http://172.x.x.x:14755/`)は HSTS にも `allowedHosts` にも当たらず `200` で撮れるが、IP はコンテナ再作成で変わるため yaml には書けない。

## 画面(screen)の追加方法

`docs/mock-diff/mock-diff.yaml` に画面(screen)のエントリを追加し、対応するファイルを以下のディレクトリに配置する。

- `docs/mock-diff/mocks/` — デザイン原案 (html / png)
- `docs/mock-diff/variants/` — デザイン候補違い (html / png)
- `docs/mock-diff/actual/` — 実装のスナップショット (必要に応じて)

エントリの例:

```yaml
screens:
  - id: welcome
    name: Welcome screen
    threshold: 0.1
    devices:
      - id: iphone
        name: iPhone
        viewport:
          width: 390
          height: 844
          deviceScaleFactor: 1
        orientations: [portrait, landscape]
        versions:
          mock:
            type: html
            path: mocks/welcome.html
          fable-5-1-v2:
            type: html
            path: variants/welcome-fable-5-1-v2.html
        actual:
          type: url
          url: http://localhost:14755/welcome
```

既存アプリの画面を `actual` として比較する場合は `type: url` で `http://localhost:14755/<path>` を指定する(devcontainer 内の vite dev server のポートは `vite.config.ts` で `14755` に設定済み、sidecar はそのコンテナのネットワーク名前空間を共有している)。

ただし `actual` を有効にして比較するには dev server が実際に起動している必要がある。このリポジトリでは開発サーバー(`bun run dev` / vite)を Claude が勝手に起動しない運用のため、`actual` との比較確認は必ずユーザー側で行うこと。

選定結果(採用したバリアント)は `docs/mock-diff/mock-diff.adopted.yaml` に viewer が自動的に書き込む。手動で編集しない。

## MCP プラグインのインストール

`qtmleap/claude-plugins` マーケットプレイスは登録済み(`claude plugin marketplace list` で `qtmleap-plugins` を確認できる)。未登録の場合のみ以下を実行する。

```bash
claude plugin marketplace add qtmleap/claude-plugins
```

mock-diff プラグインをプロジェクトスコープでインストールする。

```bash
claude plugin install mock-diff@qtmleap-plugins --scope project -y
```

プラグインのデフォルトは `MOCK_DIFF_URL=http://127.0.0.1:12355` だが、この repo では `devcontainer.json` の `containerEnv.MOCK_DIFF_URL=http://mock-diff:3000` で上書きしている。MCP から sidecar を叩く経路はブラウザを経由しないので、compose のサービス名がそのまま使える(HSTS も Host ヘッダのゲートも関係ない)。ホストからの見え方(`/mock-diff` への相乗り)とは別の経路である点に注意。

## 提供される MCP ツール

| ツール | 用途 |
|---|---|
| `list_screens` | 定義済みの screen 一覧と各 screen の状態(deciding / building / checking)を取得する |
| `get_chosen_design` | ある screen で採用済みのデザイン候補の詳細(ソースファイル・デバイス別 viewport)を取得する |
| `get_candidate` | 指定した screen / デバイスの、任意のデザイン候補をレンダリングして取得する(採用されなかった候補も見られる) |
| `compare_candidates` | 複数のデザイン候補を並べて比較する |
| `check_implementation` | ある screen の実装結果(actual)と採用済みデザインをピクセル差分で比較する |
| `check_all` | 全 screen について実装結果と採用済みデザインの差分を一括チェックする |

画面を実装する際は、`list_screens` → `get_chosen_design` の順で採用済みデザインを確認してから実装に入る。screen がまだ `deciding` 状態(採用デザイン未確定)の場合、Claude がデザインを勝手に選ばず、ユーザーに選定を委ねること。

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
docker compose -f .devcontainer/compose.yaml up -d mock-diff
```

**注意: devcontainer 内(コンテナ内のシェル)からこのコマンドを実行しないこと。** このプロジェクトの devcontainer は docker-outside-of-docker 構成のため、コンテナ内から `docker compose up` を実行すると `compose.yaml` 内の相対パスの volume マウント(`../docs/mock-diff` など)が「ホスト側」の Docker デーモンで解決されてしまい、存在しないパスが誤って空ディレクトリとして作成される。

実際には **devcontainer を再オープン(Reopen in Container / Rebuild Container)することで、sidecar は自動的に正しく起動する。** compose ファイルの構文確認だけなら以下が安全に実行できる(daemon 側の volume 解決を伴わない)。

```bash
docker compose -f .devcontainer/compose.yaml config
```

起動後、`http://localhost:12355` を開くと viewer の UI が見られる。

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
          url: http://app:14755/welcome
```

既存アプリの画面を `actual` として比較する場合は `type: url` で `http://app:14755/<path>` を指定する(devcontainer 内の vite dev server のポートは `vite.config.ts` で `14755` に設定済み、compose ネットワーク内では `app` サービス名で名前解決できる)。

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

デフォルトでは `MOCK_DIFF_URL=http://127.0.0.1:12355` を見に行く。compose 側のホスト公開ポートも `12355` に合わせてあるため、追加の環境変数設定は不要。

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

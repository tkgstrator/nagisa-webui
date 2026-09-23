# nagisa 側要求仕様書 — 録画状態の同期

## このドキュメントについて

anime-tracker (Cloudflare Workers) が「どのエピソードが実際に録画済みか」を確実に知るために、
nagisa (Flask + BullMQ) 側へ求める変更をまとめたもの。

対になる Workers 側の設計は [`recording-sync.md`](./recording-sync.md) を参照。

> **方針転換 (2026-09-23)**: **webhook (nagisa → Workers) は廃止する。**
> Workers → nagisa は既に Cloudflare Access の Service Auth で繋がっており、
> 逆向きにもう一組の認証 (nagisa 用サービストークン + Workers 側 Access ポリシー) を
> 持つのは二重管理になる。加えて逆向きは P1・P3 のとおり**無言で失敗する経路**であり、
> 実際にそれが起きていた。同期はすべて **Workers からの pull** で行う。

| 層 | 役割 | nagisa 側に必要なもの |
|----|------|----------------------|
| ① 指示 | `pending` の起点 | 既存の `POST /api/queues` (202 + `job_id`) のみ |
| ② スナップショット | 進行中 / 失敗 / stale 検出 | `GET /api/queue/snapshot` |
| ③ 実体照合 | 最終権威 | 録画台帳 (SQLite) + `GET /api/library/changes` / `/snapshot` |

nagisa から Workers を呼ぶ経路は存在しない。したがって nagisa 側に
Workers の URL も認証情報も渡す必要がない。

調査対象は `qtmleap/nagisa` の HEAD `726f833`。以下の行番号はこのコミット基準。

---

## 1. 現状の問題点

P1〜P4 は「webhook を真実源にできない」ことの根拠であり、
**webhook を廃止する判断そのものの材料**として残している。
nagisa 側で直すべきものは P5・P6 (と R1〜R5) だけ。

### P1. webhook が無言で無効化される (実測で確定)

`nagisa/server/webhook.py`:

```python
def webhook_enabled() -> bool:
    return bool(TRACKER_URL and CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET)

def send_webhook(...) -> None:
    if not webhook_enabled():
        return          # ← ログも出ない
```

3 つの環境変数のどれか 1 つでも欠けると、webhook は 1 件も飛ばずログにも何も残らない。
そして `compose.yaml` には `TRACKER_URL` / `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` の
定義が **無い**。

**本番コンテナの `printenv` で 3 つとも存在しないことを確認済み** (2026-09-23)。
つまり webhook は実装完了以来 1 件も送信されていない。

Workers 側の staging D1 では `episodes.recorded = 1` が **1 件 / 260,328 件**。
その 1 件も手動 PATCH (`PATCH /api/recordings/:id`) で立つため、
webhook 由来の成功記録はゼロ。実測値と完全に整合する。

> **これが webhook を廃止する決定打**。環境変数を入れれば今日は直るが、
> 「設定漏れが誰にも気づかれないまま数か月動き続ける」という失敗モード自体は残る。
> pull であれば、失敗は Workers 側の fetch エラーとして `SyncRun` に必ず現れる。

なお anime-tracker 側の旧ドキュメント `nagisa-recording-integration.md` は
この変数を `WORKERS_URL` と記載していたが、実装は `TRACKER_URL` が正しい。
(このドキュメントと同時に訂正済み。ただし変数自体が不要になる)

### P2. 既存ファイルをスキップしたとき通知が出ない

`nagisa/cli/pipeline_amazon.py:143`:

```python
if output_file.exists() and not force and not dry_run:
    logger.warning("Already exists — skipped (%s)", output_file)
    ok += 1
    continue          # ← notify_start / notify_complete を通らない
```

同じ分岐が `pipeline_hulu.py:73`、`pipeline_abema/modes.py:138`、
`pipeline_crunchyroll/pipeline.py:117` にある。

`ok` にはカウントされるので nagisa 自身は「成功」と扱うが、Workers には何も届かない。
**「ディスクにはあるが Workers は知らない」という乖離を構造的に生み出している箇所**で、
既に 146 GB / 687,420 件の変換済み資産がある以上、実際に踏んでいるはず。

> pull 方式ではこの分岐に手を入れる必要が無い。③ の実体照合が
> 「ディスクにあるか」だけを見るため、通知の有無と無関係に解消する。
> ただし R1 のインデックス追記だけはスキップ時にも必要 (→ R1)。

### P3. webhook の送信失敗が回復しない

`send_webhook` は `requests.RequestException` を握って `logger.warning` を出すだけ。
リトライもキューイングも無い。Workers 側の一時的な 5xx / Cloudflare Access の
トークン期限切れ / ネットワーク瞬断のいずれでも、その 1 話分の状態は永久に失われる。

これを webhook のまま直すには outbox + リトライ + 滞留監視が要る。
**pull なら失敗した回を次の cron がそのまま拾い直す**ので、その機構ごと不要。

### P4. ジョブ全体が落ちたときに通知が出ない

webhook を送るのは `nagisa/server/tasks/common.py` の `EpisodeCallbacks` だけで、
**エピソード単位のコールバックに到達する前に例外が出ると何も通知されない**。

`worker.py:handler` の `except Exception` は `job.log` に書いて re-raise するのみ。
つまり以下は Workers から見て「投げたきり無反応」になる:

- 作品情報の取得 (`get_episodes`) に失敗
- Cookie 失効 / 認証エラー
- `run_download` の provider 分岐より手前で落ちるケース
- BullMQ 側でジョブが stalled → failed になったケース

これも pull なら R5 の snapshot に `state: "failed"` として現れるので、
nagisa 側に通知コードを足す必要が無い。**BullMQ が既に持っている情報を読むだけで済む。**

### P5. ディスクの中身を問い合わせる手段が無い

現在の HTTP API は 5 本のみ (`nagisa/server/app.py`):

| エンドポイント | 用途 |
|---|---|
| `POST /api/queues` | ジョブ投入 |
| `GET /api/status` | バージョン / キュー統計 / 状態別ジョブ最大 10 件 |
| `GET /health` | ヘルスチェック |
| `GET /docs`, `GET /openapi.json` | ドキュメント |

`GET /api/status` はジョブを **状態ごとに 10 件までしか返さない** (`status.py:56` `_JOBS_PER_STATE`)。
待機ジョブが 10 件を超えると、Workers は自分が投げたジョブがキューに残っているのか
消えたのかを判別できない。

そして「どのファイルが実在するか」を返す API は存在しない。

### P6. content_id がディスクに残らない provider がある

出力先は `{output_dir.series}/{folder_name}/Season NN/SNNENN.mkv`
(`config.yaml.example` の既定では `output_dir.series: content`)。

`folder_name` の決まり方:

| provider | TMDb 解決成功 | TMDb 解決失敗 |
|---|---|---|
| amazon | `tmdb.jellyfin_folder` = `Title (Year) [tmdbid-NNN]` | `series_asin` (`pipeline_amazon.py:94`) |
| hulu | `tmdb.hulu_folder` | `content_id` (`pipeline_hulu.py:53`) |
| abema | `tmdb.abema_folder` | `content_id` (`pipeline_abema/pipeline.py:77`) |
| crunchyroll | `tmdb.crunchyroll_folder` | `content_id` (`pipeline_crunchyroll/pipeline.py:73`) |

TMDb 解決に成功するとディレクトリ名から `content_id` が消える。

Amazon だけは `save_season_json` が `content/{folder_name}/{asin}.json` を書くので
(`nagisa/providers/amazon/episodes/persist.py:44`)、ディレクトリ内に ASIN とエピソード一覧
(`episodes[].episode_id` / `episode_number` / `season_number`) が残る。
**この仕組みが amazon にしか無い** (`save_season_json` の呼び出しは `cli/run.py:195`、
`cli/batch.py:92`、`server/tasks/amazon.py:108` のみ)。

Workers 側は `Anime` に TMDb ID を持っていない (`aniListId` のみ) ので、
フォルダ名からの逆引きはタイトル一致頼みになり実用にならない。

> 結論: **provider 非依存の録画インデックスを nagisa 側に持たせる必要がある。**

---

## 2. 要求仕様

同期の背骨は **「nagisa 側に録画台帳 (SQLite) を持ち、その変更ログを Workers が
カーソルで読み進める」** の一点である。Workers が全件を取りに行くのは
初期化とカーソル失効からの復旧のときだけで、定常運転では発生しない。

| 要求 | 内容 | 役割 |
|---|---|---|
| R1 | 録画インデックス (SQLite) と変更ログ | 台帳そのもの |
| R2 | `GET /api/library/changes` | 定常の差分同期 |
| R3 | `GET /api/library/snapshot` | 初期化・失効からの復旧 |
| R4 | `POST /api/library/reindex` | 既存 146 GB 資産の取り込み |
| R5 | `GET /api/queue/snapshot` | 進行中 / 失敗の把握 |
| R6 | webhook の撤去 | 逆向き経路の廃止 |

### R1. 録画インデックス (SQLite)

**置き場所**: `{output_dir.series}/.nagisa/library.db`

Python 標準の `sqlite3` を使う。**依存パッケージの追加は不要**。
`.nagisa/` はドット始まりなので Jellyfin のライブラリスキャンから外れる。

設計上の原則:

- **真実源はあくまでディスク上のファイル。** DB は索引であって権威ではない。
  壊れたら R4 の reindex で作り直せる状態を保つ
- **メタデータ (タイトル / TMDb ID / あらすじ) は入れない。** 録画実体の所在だけを持つ。
  カタログは Workers 側 D1 の責務
- `journal_mode=WAL` と `busy_timeout` を設定し、書き込みは `BEGIN IMMEDIATE` で取る
  (gunicorn の複数ワーカーと BullMQ ワーカーから同時に触られるため)

#### R1-1. スキーマ

```sql
CREATE TABLE library_meta (
    id                 INTEGER PRIMARY KEY CHECK (id = 1),
    epoch              TEXT    NOT NULL,            -- UUID。履歴の identity (→ R1-5)
    last_seq           INTEGER NOT NULL DEFAULT 0,
    pruned_through_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE recordings (
    recording_id   TEXT PRIMARY KEY,                -- 録画実体の identity (→ 下記)
    provider       TEXT    NOT NULL,                -- amazon / hulu / abema / crunchyroll
    content_id     TEXT,                            -- 復元できない場合のみ NULL (→ R4)
    episode_id     TEXT,
    season_number  INTEGER,
    episode_number INTEGER,
    path           TEXT    NOT NULL UNIQUE,         -- output_dir.series からの相対パス
    size           INTEGER NOT NULL,                -- バイト
    mtime          TEXT,                            -- ISO 8601 / UTC
    indexed_at     TEXT    NOT NULL                 -- ISO 8601 / UTC
);
CREATE INDEX idx_recordings_content ON recordings (provider, content_id);

CREATE TABLE library_changes (
    seq          INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT    NOT NULL,
    op           TEXT    NOT NULL CHECK (op IN ('upsert', 'delete')),
    payload      TEXT,                              -- upsert のときだけ。行の JSON (→ R1-3)
    changed_at   TEXT    NOT NULL
);
```

`recording_id` は **`path` から決まる安定した値** (例: `sha1(path)` の先頭 16 文字)。
`(season_number, episode_number)` を identity にしてはいけない。同じ話に対して
別 provider・別画質・`part2` の複数ファイルがありうるためで、
そこを潰すと「1 本消えたが別の 1 本は残っている」が表現できなくなる。

> `path` の一意性は **ライブラリルートが 1 つである**前提に立っている。
> 将来ボリュームを複数持つなら `(root_id, path)` に拡張すること。

#### R1-2. 更新は必ず 1 トランザクションで

**変更が無いときにイベントを発行してはいけない。** 発行するのは実際に
内容が変わったときだけ。ここを守らないと、スキップのたびに変更ログが伸び、
Workers が毎回無意味な D1 書き込みをする。

```python
with conn:                                  # BEGIN IMMEDIATE
    cur = conn.execute("SELECT * FROM recordings WHERE recording_id = ?", (rid,))
    before = cur.fetchone()

    if before is not None and _same(before, after):
        # ファイルもメタも変わっていない → indexed_at も触らない。イベントも出さない
        return

    conn.execute("INSERT INTO recordings ... ON CONFLICT(recording_id) DO UPDATE SET ...")
    conn.execute(
        "INSERT INTO library_changes (recording_id, op, payload, changed_at) VALUES (?,?,?,?)",
        (rid, "upsert", json.dumps(after), now_iso()),
    )
    conn.execute("UPDATE library_meta SET last_seq = ? WHERE id = 1", (new_seq,))
```

- `_same` の比較対象は **Workers に同期するフィールド一式** (`provider` / `content_id` /
  `episode_id` / `season_number` / `episode_number` / `path` / `size` / `mtime`)。
  `indexed_at` は比較に含めない
- `last_seq` は **イベントを発行したときだけ**更新する
- `seq` は `AUTOINCREMENT` なので、ロールバックで**欠番が生じる**。
  これは許容し、Workers 側は `seq > cursor` で検索する (連番を期待しない)

#### R1-3. upsert の `payload` にはその時点のデータ一式を入れる

イベントには**発行時点の行の内容をそのまま埋め込む**。
配信時に `recordings` と JOIN して現在値を返してはいけない。
JOIN すると、イベント発行から配信までの間に起きた更新でイベントの意味が変わり、
「seq 順に適用すれば同じ状態になる」という保証が崩れる。

#### R1-4. 書くタイミング

| 契機 | 場所 | 備考 |
|---|---|---|
| ダウンロード成功時 | 現在 `notify_complete` を呼んでいる地点 | |
| **既存ファイルのスキップ時** | P2 の 4 箇所 | 初回だけイベントが出て、以後は R1-2 により無発行 |
| 日次走査 | R1-6 | 追加・サイズ変更・**消失**を検出 |
| reindex | R4 | |

#### R1-5. `epoch` — 履歴の identity

`epoch` は UUID で、**変更ログの履歴が連続しているかどうか**を表す。
`seq` (履歴の中の位置) とは役割が別で、片方では代用できない。

| 事象 | epoch |
|---|---|
| DB を新規作成した | **新しい UUID** |
| 履歴を捨てて index を作り直した | **新しい UUID** |
| 古いバックアップから DB を復元した | **新しい UUID** (復元手順に必ず含めること) |
| 通常の再起動 | 変えない |
| 既存 DB に対する R4 reindex | 変えない (追記として扱う) |

> 旧設計の「単調増加 `generation` を持ち、巻き戻ったら作り直しとみなす」は**誤り**だった。
> 永続ファイルを失ったときに現在時刻由来の値から再開すると、その値は前回より
> **大きい**ので巻き戻り判定が発動せず、履歴の喪失を検出できないまま
> Workers が差分の続きを読んだつもりになる。世代の識別を大小比較で代用しないこと。

#### R1-6. 日次走査 — 走査失敗を「ファイルが無い」と解釈しないこと

nagisa の外でファイルが消える経路 (手動削除、Jellyfin 側の整理、ディスク障害、
ボリュームの付け替え) を拾えるのはここだけなので、日次 (`0 3 * * *` 相当) で
ライブラリルートを走査し、`recordings` と突き合わせる。

- 実ファイルがあるのに行が無い → `upsert` イベント
- 行はあるが内容 (`size` / `mtime` / `path`) が変わった → `upsert` イベント
- 行はあるが実ファイルが無い → 行を削除し **`delete` イベント (tombstone)**

**ここが最も壊しやすい箇所である。** 走査に失敗した範囲を「空ディレクトリ」として
扱うと、マウント障害が 1 回あっただけで全録画の tombstone が発行され、
Workers 側の全話が `missing` に落ちる。**tombstone の発行は消失の宣言であり、
巻き戻すにはもう一度全部を録画済みと再宣言するしかない。**

したがって:

- ライブラリルートに marker ファイル (例: `.nagisa/.mounted`) を置き、
  **これが読めなければ走査自体を中止**する
- ディレクトリ列挙が例外で落ちた範囲は「未確認」として扱い、その範囲の
  tombstone は**発行しない**。正常に列挙できた範囲についてだけ発行する
- 1 回の走査で削除される割合が閾値 (例: 既存行の 10%) を超えたら中止してログに出す
- 走査中に完了した録画との競合を避けるため、消失判定の直前に
  `os.stat` で再確認してから tombstone を出す

#### R1-7. ログの保持

**初期は `library_changes` を削除しない。** 1 行あたり数百バイトで、
録画実体が数千本の規模では放置しても数 MB にしかならない。
`pruned_through_seq` は将来ログを捨てるときのための予約で、当面 0 のままでよい。
捨てる契約だけ先に決めておけば (→ R2 の `410 Gone`)、後から導入しても
クライアントを壊さない。

### R2. `GET /api/library/changes`

定常の差分同期。**これが 15 分ごとに叩かれる唯一のエンドポイント**になる。

```
GET /api/library/changes?cursor=<opaque-token>&limit=500
```

| クエリ | 説明 |
|---|---|
| `cursor` | 前回レスポンスの `next_cursor`。**省略時は「初期化が必要」を意味し `409` を返す** (全件を返さない) |
| `limit` | 既定 500 / 最大 1000 |

```json
{
  "epoch": "b1f0c2e4-7a3d-4c5e-9f11-2d8a6b0c4e77",
  "changes": [
    {
      "seq": 10482,
      "op": "upsert",
      "recording_id": "3f9a1c77b2e04d81",
      "changed_at": "2026-09-23T02:10:00Z",
      "item": {
        "provider": "amazon",
        "content_id": "B0DXV9MP4Y",
        "episode_id": "B0DYPFS8CT",
        "season_number": 1,
        "episode_number": 1,
        "path": "リコリス・リコイル (2022) [tmdbid-119100]/Season 01/S01E01.mkv",
        "size": 1932735283,
        "mtime": "2026-09-20T11:22:33Z"
      }
    },
    {
      "seq": 10483,
      "op": "delete",
      "recording_id": "a07c55e9d1b3f402",
      "changed_at": "2026-09-23T03:04:11Z"
    }
  ],
  "next_cursor": "eyJlIjoiYjFmMCIsInMiOjEwNDgzfQ",
  "has_more": false
}
```

- **変更が無ければ `200` + `changes: []`。** 大半の tick はこれで終わる。
  ボディは 100 バイト程度なので、`304` や `ETag` のために契約を複雑にする価値は無い
- **応答時にファイルを走査しない。** `library_changes` を `seq > cursor` で読むだけ。
  毎 15 分の呼び出しでディスクが動かないことがこの設計の要点
- `delete` に `item` は無い。Workers は `recording_id` で自分の側を引ければよい
- `has_more` が `true` の間、Workers は `next_cursor` で続けて叩く

#### R2-1. カーソルは `(epoch, seq)`

`cursor` は不透明トークンとして扱わせるが、中身は `epoch` と `seq` の組。
`seq` だけを渡させてはいけない (別の履歴の同じ番号と区別できない)。

| 条件 | 応答 |
|---|---|
| `epoch` 一致・`seq >= pruned_through_seq` | `200` + 差分 |
| `seq < pruned_through_seq` | `410 Gone` / `{"error": "cursor_expired"}` |
| `epoch` 不一致 | `410 Gone` / `{"error": "epoch_changed"}` |
| `epoch` 一致だが `seq > last_seq` | `409 Conflict` / `{"error": "cursor_ahead"}` |
| `cursor` 省略 | `409 Conflict` / `{"error": "not_initialized"}` |

**`seq > last_seq` を「変更なし (空の成功)」として返してはいけない。**
これは Workers が nagisa の知らない履歴を持っている状態 (= 古いバックアップからの
復元など) であり、空を返すと Workers は永久に同期できたつもりで止まる。
エラーにして R3 の再同期へ落とす。

`409` / `410` を受けた Workers は R3 のスナップショット同期に切り替える
(→ `recording-sync.md` §7-3)。

### R3. `GET /api/library/snapshot`

**初期化とカーソル失効からの復旧専用。** 定常運転では叩かれない。

```
GET /api/library/snapshot?cursor=&limit=1000
```

```json
{
  "epoch": "b1f0c2e4-7a3d-4c5e-9f11-2d8a6b0c4e77",
  "snapshot_seq": 10483,
  "items": [ { "recording_id": "...", "provider": "...", "...": "..." } ],
  "next_cursor": "eyJzIjoxMDQ4MywibyI6MTAwMH0",
  "has_more": true
}
```

- `snapshot_seq` は **このスナップショットが対応する `seq`**。全ページを適用し終えた
  Workers は、カーソルをここへ進めて以後 R2 の `seq > snapshot_seq` を読む
- **全ページが同一の読み取りスナップショットから返ること**を保証する。
  ページの途中で `recordings` の更新が混ざると、適用後の状態がどの `seq` にも
  一致しなくなる。SQLite の場合は同一の読み取りトランザクションを保持するか、
  一時テーブル / 一時ファイルに固定してからページを切り出す
- `snapshot_seq` より後の変更は R2 で拾われるので、スナップショットに
  含まれていなくてよい (at-least-once で重複しても冪等に適用される)

現在の規模 (録画実体は 146 GB ÷ 0.5〜1.5 GB/話 ≒ **1,000〜3,000 本**、
1 件 280 バイトで全件 1 MB 以下) では実質 1〜3 ページで終わるが、
**将来の増加に備えてページングの契約は最初から持たせる**。

### R4. `POST /api/library/reindex`

既存資産 (インデックス導入前にダウンロード済みのもの) を `recordings` に取り込む。

```
POST /api/library/reindex
{"provider": "amazon", "content_id": "B0DXV9MP4Y"}   // 省略時は全件
```

同期実行せず BullMQ のジョブとして投入し、`{"job_id": "...", "status": "queued"}` を返す。
**`epoch` は変えない** — 既存 DB への追記であり、履歴は途切れていないため。
取り込んだぶんは通常どおり `upsert` イベントとして発行され、Workers には差分で届く。

**復元ロジック**:

| provider | content_id / episode_id の取得元 |
|---|---|
| amazon | 同ディレクトリの `{asin}.json` (`season_to_dict` の `episodes[].episode_id` と `episode_number`) |
| hulu / abema / crunchyroll | ディレクトリ名が `content_id` のものだけ復元可能 |

復元できなかったディレクトリは、`content_id` を `NULL` にした行として
`recordings` に残す。この行も **`upsert` イベントとして Workers に届ける**
(捨てない)。Workers 側は「録画実体はあるが作品に紐付いていないもの」として
件数を表示し、手動紐付けの対象にする (→ `recording-sync.md` §7-5)。

> TMDb 解決済みかつ amazon 以外のディレクトリは、この時点では自動復元できない。
> R1 のインデックスは再ダウンロード / スキップの両方で書かれるので、
> 次にそのシーズンへジョブを投げた時点 (全話スキップでも可) に自然に埋まる。
> **この取りこぼしは同期プロトコルでは解決できない**ので、未解決件数が
> 画面に出ていること自体が要件になる。

### R5. `GET /api/queue/snapshot`

Workers が「投げたジョブが今どうなっているか」を確実に知るための API。
`GET /api/status` の 10 件上限とは別物として新設する。

```
GET /api/queue/snapshot?states=active,wait,delayed&since=
```

```json
{
  "jobs": [
    {
      "job_id": "42",
      "state": "active",
      "provider": "amazon",
      "content_id": "B0DXV9MP4Y",
      "seasons": [{"season_number": 1, "episodes": [1, 2]}],
      "progress": {"current": 1, "total": 2},
      "attempts": 1,
      "failed_reason": null,
      "timestamp": 1774567545049,
      "processed_on": 1774567546000,
      "finished_on": null
    }
  ],
  "counts": {"wait": 3, "active": 1, "completed": 1920, "failed": 7, "delayed": 0},
  "generated_at": "2026-09-23T04:00:00Z"
}
```

- `active` / `wait` / `delayed` は **全件返す** (上限なし)。これらが多くても数百件
- `completed` / `failed` は `since` (Unix ms) 以降に終了したものだけ返す。
  `since` 省略時は直近 100 件
- `job_id` は `POST /api/queues` のレスポンスで返したものと同じ値。
  **Workers はこの値で突合する**ため、`episode_id` の表記揺れの影響を受けない
- `failed_reason` は BullMQ が保持している値をそのまま返す (先頭 500 文字で可)。
  stalled → failed も同じ経路で現れること

webhook を廃止したため、**これが「進行中である」「失敗した」を知る唯一の手段**になる。
Workers 側はこれを cron `* * * * *` (毎分) で叩く:

| snapshot 上の状態 | Workers の遷移 |
|---|---|
| `active` | `pending` → `downloading` |
| `wait` / `delayed` | `pending` のまま (触らない) |
| `failed` | `pending` / `downloading` → `failed` (`failed_reason` を保存) |
| どこにも居ない かつ 30 分無音 | → `stale` |
| `completed` | **何も書かない** (成功の確定は ③ のみ) |

`completed` を成功として扱わないのは、P2 のスキップ・途中での部分失敗・
ワーカー再起動をジョブ状態から区別できないため。

毎分叩くので、レスポンスは軽く保つこと (`completed` は `since` で絞る前提)。

### R6. webhook の撤去

**Workers へ POST を送る経路は廃止する。** P1 で確定したとおり本番では一度も
動いていないので、消しても失われる機能は無い。

削除対象:

| ファイル | 内容 |
|---|---|
| `nagisa/server/webhook.py` | ファイルごと削除 |
| `nagisa/tasks/common.py` | `notify_start` / `notify_complete` などの呼び出し |
| (各 pipeline) | 上記ヘルパーの import と呼び出し |

`webhook.py` に定義されているエラーコード定数
(`CONTENT_NOT_FOUND` / `MPD_NOT_FOUND` / `KEY_FETCH_FAILED` / `DOWNLOAD_FAILED` ほか)
は**残す価値がある**ので、`nagisa/errors.py` などへ移して R1 のインデックス行と
BullMQ の `failed_reason` に載せること。Workers 側はこの文字列を
`Episode.recordError` に保存して画面に出す。

`compose.yaml` に `TRACKER_URL` / `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` を
**追加しない**。nagisa は Workers の URL も資格情報も知らなくてよい。

---

## 3. 検証環境 (mock サイドカー)

実ダウンロードを走らせずに Workers 側の同期ロジックを検証するためのモード。

`compose.yaml` に `nagisa-mock` サービスを足し、環境変数 `NAGISA_MOCK=1` で
`run_download` をスタブへ差し替える。pull 方式なので mock 側は
**キューの状態とディスクの状態を動かすだけ**でよく、Workers を呼ぶ必要が無い:

| 挙動 | 再現したい事象 |
|---|---|
| `MOCK_DURATION_SEC` (既定 30) だけジョブを `active` に留めてから `completed` にする | 正常系 (② が `downloading` を拾えるか) |
| `MOCK_FAIL_RATE` でジョブを例外終了させる | ② が `failed` と `failed_reason` を拾えるか |
| `MOCK_SKIP_RATE` でファイルを書かずに `completed` する | P2 の回帰 (② が `completed` を信じないこと) |
| ダミーファイル (数 KB) を実際に `content/` へ書き、R1 の台帳にも `upsert` を積む | ③ 実体照合 |
| `DELETE /mock/files?content_id=` でファイルだけ消す | 日次走査 → `delete` イベント → ③ で `missing` へ落ちるか |
| `POST /mock/library/reset-epoch` で `library_meta.epoch` を振り直す | Workers のカーソルが `410 epoch_changed` を受けて R3 へ落ちるか |
| `POST /mock/library/prune?through_seq=` で `pruned_through_seq` を進める | `410 cursor_expired` からの復旧 |
| ジョブを Redis から直接消す | ② の `stale` 検出 |

検証環境に **Workers の URL も CF-Access のトークンも渡さなくてよい**。
Workers 側は `wrangler dev` から mock の `/api/queue/snapshot` と
`/api/library/changes` / `/api/library/snapshot` を叩く。

mock でも台帳は本番と同じ SQLite スキーマを使う。`epoch` と `seq` の振る舞いこそが
Workers 側の同期ロジックの検証対象なので、ここだけ別実装にすると意味が無い。

---

## 4. 実装順序

### Step 1 — 識別子の突き合わせ (実装前提の確認)

- [ ] amazon 1 作品の `content/{folder}/{asin}.json` を取り出し、
      `episodes[].episode_id` が Workers 側 `Episode.episodeId` と一致するか確認
- [ ] hulu で 1 話ダウンロードし、`episode_id` の表記
      (`ASSET-` プレフィックスの有無) を確認
- [ ] ずれていれば R1 のインデックスへ書く時点で正規化する

### Step 2 — キュースナップショット (R5)

- [ ] `GET /api/queue/snapshot` を追加し `openapi.json` を更新
- [ ] `active` / `wait` / `delayed` が全件返ることをジョブ 20 件で確認
- [ ] `job_id` が `POST /api/queues` の返値と一致することを確認
- [ ] `failed` に `failed_reason` が載ること (stalled → failed を含む)

これだけで ①+② が成立し、「指示したのに進んでいない」が見えるようになる。
**ここまでが最優先**。

### Step 3 — 録画台帳 (R1)

- [ ] `.nagisa/library.db` のスキーマ作成 (`library_meta` / `recordings` / `library_changes`)
      と WAL・`busy_timeout` の設定
- [ ] 台帳への書き込みを全 provider のパイプラインに入れる
- [ ] スキップ時 (P2 の 4 箇所) にも書かれることを確認
- [ ] 同一エピソードの再ダウンロードで `recordings` が更新され、
      `library_changes` に `upsert` が 1 件積まれること
- [ ] **内容が変わらない再実行でイベントが増えないこと** (R1-2 の `_same`)。
      日次走査を 2 回続けて回しても `last_seq` が動かない
- [ ] `recordings` と `library_changes` と `last_seq` の更新が
      単一トランザクション内で行われること (途中で落ちても片側だけ残らない)
- [ ] 日次走査で消えたファイルに `delete` イベントが積まれること
- [ ] **走査が失敗したときに `delete` を出さないこと** (R1-6)。
      `.nagisa/.mounted` を隠す / ライブラリルートを umount した状態で走らせ、
      `library_changes` が 1 件も増えないことを確認する — ここが最大の事故点
- [ ] 日次走査が既存の 146 GB 資産に対して現実的な時間で終わるか計測

### Step 4 — ライブラリ API (R2 / R3)

- [ ] `GET /api/library/changes?cursor=&limit=` (ページング / `seq` 昇順 / `has_more`)
- [ ] 変更が無いとき `200` + `changes: []` を返すこと (`304` は使わない)
- [ ] `upsert` の `payload` が発行時点の値であること (配信時に `recordings` と JOIN しない)
- [ ] カーソル契約 (R2-1) の 4 分岐をそれぞれ再現する:
      `410 cursor_expired` / `410 epoch_changed` / `409 cursor_ahead` / `409 not_initialized`
- [ ] **`seq > last_seq` のカーソルを空の成功で返さないこと**。
      ここを `200 []` にすると Workers が永久に静かなまま壊れる
- [ ] `epoch` を振り直した直後に古いカーソルが `410` になること
- [ ] **API がディスクを走査しないこと**。`changes` を 100 回叩いても
      `content/` への I/O が増えないこと (台帳を読むだけ)
- [ ] `GET /api/library/snapshot?cursor=&limit=` が全ページを
      **同一の読み取りスナップショット**から返すこと。
      ページング中に録画が完了しても `snapshot_seq` と items が整合すること
- [ ] snapshot 完了後に `snapshot_seq` を起点としたカーソルで
      `changes` が続きから読めること (取りこぼしも重複適用エラーも無いこと)

### Step 5 — 既存資産の取り込み (R4)

- [ ] `POST /api/library/reindex` (BullMQ ジョブ)
- [ ] amazon の `{asin}.json` 経由の復元
- [ ] **reindex が `epoch` を変えないこと** (既存 DB への追記であって作り直しではない)
- [ ] `content_id` を復元できなかった行も `content_id = NULL` で台帳に入り、
      `upsert` イベントとして Workers へ届くこと (捨てない)

### Step 6 — webhook の撤去 (R6)

- [ ] `webhook.py` の削除とエラーコード定数の移設
- [ ] `tasks/common.py` の通知呼び出しを削除
- [ ] Workers 側の `POST /api/webhooks/record-status` も同時に削除する
      (→ `recording-sync.md` §10)

### Step 7 — mock サイドカー

- [ ] `NAGISA_MOCK=1` のスタブと `compose.yaml` のサービス定義
- [ ] Workers 側の ② / ③ を mock 相手に通す

---

## 5. 環境変数

本番で**追加する変数は無い**。webhook を廃止したため、nagisa は Workers の
所在も資格情報も知らなくてよい。

| 変数名 | 説明 | 必須 |
|---|---|---|
| `NAGISA_MOCK` | `1` で実ダウンロードをスタブ化 | 検証環境のみ |
| `MOCK_DURATION_SEC` | ジョブを `active` に留める秒数 (既定 30) | 検証環境のみ |
| `MOCK_FAIL_RATE` | ジョブを失敗させる確率 (0.0〜1.0) | 検証環境のみ |
| `MOCK_SKIP_RATE` | ファイルを書かずに `completed` する確率 | 検証環境のみ |

削除する変数: `TRACKER_URL` / `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`
(そもそも `compose.yaml` に定義されていない → 追加せずコード側を消す)。

---

## 6. Workers 側との対応表

すべて Workers から nagisa を叩く向き。逆向きの通信は存在しない。

| nagisa | Workers | 用途 |
|---|---|---|
| `POST /api/queues` の `job_id` | `Episode.recordJobId` / `recordStatus = "pending"` | ① 指示の自己記録 |
| `GET /api/queue/snapshot` の `active` | `recordStatus = "downloading"` | ② 進行中 |
| 同 `failed` + `failed_reason` | `recordStatus = "failed"` / `recordError` | ② 失敗 |
| snapshot に不在 + 30 分無音 | `recordStatus = "stale"` | ② 取りこぼし検出 |
| `GET /api/library/changes` の `next_cursor` | `SyncState.libraryCursor` | ③ 読み進めた位置 |
| `changes[].op == "upsert"` | `recordStatus = "completed"` / `recordPath` / `recordSizeMb` | ③ 実体照合 (最終権威) |
| `changes[].op == "delete"` | `recordStatus = "missing"` | ③ ファイル消失検出 |
| `410` / `409` | `GET /api/library/snapshot` へフォールバック | ③ カーソル失効からの復旧 |
| `item.content_id == null` | どの作品にも紐づかない録画として件数表示 | ③ 未解決の可視化 |

`completed` を書けるのは ③ だけ。snapshot の `completed` は
スキップ・部分失敗と区別できないので信用しない。

詳細は [`recording-sync.md`](./recording-sync.md) を参照。

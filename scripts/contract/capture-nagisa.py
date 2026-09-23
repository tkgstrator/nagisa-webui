"""nagisa の実物 (Flask test client) から Workers が読む 4 経路の JSON を取り出す。

Redis もディスク上の録画も要らない: 台帳は SQLite なので tmp に本物を作り、
pipeline が呼ぶのと同じ record_file で行を入れる。キューだけは Redis が要るので、
bullmq の Job / Queue の属性をなぞった偽物を `_QUEUE` に差し込む。

    uv run --project ~/nagisa python scripts/contract/capture-nagisa.py \
        ~/nagisa scripts/contract/nagisa-1.5.2.json

(nagisa の依存が要るので、素の python ではなく nagisa 側の venv で走らせる)

採取した JSON は verify-nagisa-contract.ts が Workers 側の Zod DTO で parse する。
nagisa を上げたら採り直して、両側の契約が一致していることを確かめること。
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

NAGISA_ROOT = sys.argv[1] if len(sys.argv) > 1 else "/home/vscode/nagisa"
OUT_PATH = Path(sys.argv[2] if len(sys.argv) > 2 else "scripts/contract/nagisa-1.5.2.json")

sys.path.insert(0, NAGISA_ROOT)

from nagisa.library import connect, record_file  # noqa: E402
from nagisa.library.db import marker_path  # noqa: E402

tmp = Path(tempfile.mkdtemp())
root = tmp / "series"
root.mkdir()
marker_path(root).parent.mkdir(parents=True, exist_ok=True)
marker_path(root).touch()

# 実ファイルを置く (item_from_file が stat する)
for rel, meta in [
    ("Show/Season 01/S01E01.mkv", dict(provider="abema", content_id="420-78", episode_id="ep-1", season_number=1, episode_number=1)),
    ("Show/Season 01/S01E02.mkv", dict(provider="abema", content_id="420-78", episode_id="ep-2", season_number=1, episode_number=2)),
    ("Other/Season 01/S01E01.mkv", dict(provider="amazon", content_id="B0ABC", episode_id="B0EP1", season_number=1, episode_number=1)),
]:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"0" * 4096)
    conn = connect(root, create=True)
    try:
        ok = record_file(conn, root, p, **meta)
        assert ok, f"record_file failed for {rel}"
    finally:
        conn.close()


# --- 偽 BullMQ キュー -------------------------------------------------------
# Redis は無いが、Workers が読む /api/queue/snapshot の形は実コード
# (_get_queue_snapshot → _snapshot_job → _serialize_job) に通して作る。
# job オブジェクトの属性名は bullmq のものをそのまま真似る。
class FakeJob:
    def __init__(self, jid, data, **kw):
        self.id = jid
        self.data = data
        self.progress = kw.get("progress")
        self.timestamp = kw.get("timestamp", 1758614400000)
        self.processedOn = kw.get("processedOn")
        self.finishedOn = kw.get("finishedOn")
        self.failedReason = kw.get("failedReason")
        self.attemptsMade = kw.get("attemptsMade", 0)


_FAKE_JOBS = {
    "active": [
        FakeJob(
            "job-active-1",
            {"provider": "abema", "content_id": "420-78", "title": "テスト番組", "seasons": [{"season_number": 1, "episodes": [1, 2]}]},
            progress={"current": 3, "total": 12},
            processedOn=1758614460000,
            attemptsMade=1,
        )
    ],
    "wait": [FakeJob("job-wait-1", {"provider": "amazon", "content_id": "B0ABC", "title": None, "seasons": None})],
    "delayed": [],
    "completed": [
        FakeJob(
            "job-done-1",
            {"provider": "abema", "content_id": "420-78", "title": "テスト番組", "seasons": [{"season_number": 1, "episodes": [1, 2]}]},
            processedOn=1758610000000,
            finishedOn=1758610900000,
            attemptsMade=1,
        )
    ],
    "failed": [
        FakeJob(
            "job-failed-1",
            {"provider": "amazon", "content_id": "B0XYZ", "title": None, "seasons": None},
            finishedOn=1758611000000,
            failedReason="Traceback (most recent call last):\n  RuntimeError: drm",
            attemptsMade=3,
        )
    ],
}


class FakeQueue:
    async def getJobCounts(self, *states):
        return {s: len(_FAKE_JOBS.get(s, [])) for s in states}

    async def getJobs(self, states, start, end):
        out = []
        for s in states:
            out.extend(_FAKE_JOBS.get(s, [])[start : end + 1])
        if not out:
            raise ValueError("empty")
        return out


cfg = SimpleNamespace(output_dir=SimpleNamespace(series=str(root)))
out: dict[str, object] = {}

with patch("nagisa.server.library.load_config", return_value=cfg):
    from nagisa.server.app import app

    app.config["TESTING"] = True
    with app.test_client() as c:
        snap = c.get("/api/library/snapshot?limit=2")
        out["library_snapshot"] = {"status": snap.status_code, "body": snap.get_json()}
        cursor = (snap.get_json() or {}).get("next_cursor")
        # 2 ページ目 (Workers は next_cursor を渡して続きを取る)
        if cursor:
            p2 = c.get(f"/api/library/snapshot?cursor={cursor}&limit=2")
            out["library_snapshot_page2"] = {"status": p2.status_code, "body": p2.get_json()}
            done = p2.get_json() or {}
            ch_cursor = done.get("cursor") or done.get("next_cursor")
        else:
            ch_cursor = None
        stats = c.get("/api/library/stats")
        out["library_stats"] = {"status": stats.status_code, "body": stats.get_json()}
        # changes: snapshot 応答が持ち回る changes_cursor で引く
        # (`cursor` ではない — snapshot のページ送りとは別の連番)
        tail = (out.get("library_snapshot_page2") or {}).get("body") or {}
        head = (out.get("library_snapshot") or {}).get("body") or {}
        ccur = tail.get("changes_cursor") or head.get("changes_cursor")
        # 取り込み後に 1 件増やす: これが Workers の 15 分 tick が拾う差分そのもの
        add = root / "Show/Season 01/S01E03.mkv"
        add.write_bytes(b"0" * 8192)
        conn = connect(root, create=True)
        try:
            assert record_file(
                conn, root, add,
                provider="abema", content_id="420-78", episode_id="ep-3",
                season_number=1, episode_number=3,
            )
        finally:
            conn.close()
        ch = c.get(f"/api/library/changes?cursor={ccur}") if ccur else c.get("/api/library/changes")
        out["library_changes"] = {"status": ch.status_code, "body": ch.get_json()}
        # 取り込み済みの位置から引けば差分は空 (Workers はこれを見て止まる)
        ch_tail = (ch.get_json() or {}).get("next_cursor")
        if ch_tail:
            ch2 = c.get(f"/api/library/changes?cursor={ch_tail}")
            out["library_changes_empty"] = {"status": ch2.status_code, "body": ch2.get_json()}
        # cursor 無し = 409 not_initialized を宣言すること
        ch0 = c.get("/api/library/changes")
        out["library_changes_no_cursor"] = {"status": ch0.status_code, "body": ch0.get_json()}
        st = c.get("/api/status")
        out["status"] = {"status": st.status_code, "body": st.get_json()}
        with patch("nagisa.server.app._QUEUE", FakeQueue()):
            qs = c.get("/api/queue/snapshot")
            out["queue_snapshot"] = {"status": qs.status_code, "body": qs.get_json()}
            st2 = c.get("/api/status")
            out["status_with_queue"] = {"status": st2.status_code, "body": st2.get_json()}

OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False))
for k, v in out.items():
    print(k, "->", v["status"])

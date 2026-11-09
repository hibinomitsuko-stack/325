#!/usr/bin/env python3
"""Threads 自動運用の「機械的な部分」をまとめたスクリプト（標準ライブラリのみ）。

判断（NGチェック・分析・執筆）は Claude のスキルが担当し、
API を叩く・ファイルを書き換えるといった確実性が必要な処理はこのスクリプトが担当する。

使い方:
  python3 threads/scripts/threads_api.py check            # トークンが有効か確認
  python3 threads/scripts/threads_api.py status           # 運用ファイルの状態を集計（スーパーバイザー用）
  python3 threads/scripts/threads_api.py post --dry-run   # 投稿予定の1本を表示（投稿しない）
  python3 threads/scripts/threads_api.py post             # キュー先頭の承認済み1本を投稿
  python3 threads/scripts/threads_api.py fetch            # 24時間以上経った投稿の数字を回収
  python3 threads/scripts/threads_api.py search "キーワード"  # Threadsキーワード検索（要権限）
  python3 threads/scripts/threads_api.py refresh-token    # 長期トークンを延長（新トークンを表示）

環境変数:
  THREADS_ACCESS_TOKEN      必須。Threads の長期アクセストークン
  THREADS_REQUIRE_APPROVAL  "true"(既定) なら approved: true の原稿だけ投稿する
  THREADS_DIR               運用フォルダ（既定: このスクリプトの1つ上 = threads/）
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://graph.threads.net/v1.0"
JST = ZoneInfo("Asia/Tokyo")
BASE = Path(os.environ.get("THREADS_DIR", Path(__file__).resolve().parent.parent))
OPS = BASE / "ops"
KNOWLEDGE = BASE / "knowledge"
QUEUE = OPS / "post-queue.md"
HISTORY = OPS / "post-history.md"
TOPICS = OPS / "next-topics.md"
MAX_CHARS = 500  # Threads のテキスト上限
QUESTION_WORDS = ("？", "?", "教えて", "どうしたら", "どうすれば", "どうやって", "知りたい")


# ---------------------------------------------------------------- API helpers
def token() -> str:
    t = os.environ.get("THREADS_ACCESS_TOKEN", "").strip()
    if not t:
        sys.exit("ERROR: 環境変数 THREADS_ACCESS_TOKEN が設定されていません。")
    return t


def call(method: str, path: str, params: dict | None = None) -> dict:
    params = dict(params or {})
    params["access_token"] = token()
    url = path if path.startswith("http") else f"{API}/{path.lstrip('/')}"
    data = None
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode()
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from None


def call_with_retry(method: str, path: str, params: dict | None = None) -> dict:
    """リトライは1回まで（ガイドのルール）。"""
    try:
        return call(method, path, params)
    except Exception as e:  # noqa: BLE001
        print(f"WARN: API失敗、5秒後に1回だけ再試行します: {e}", file=sys.stderr)
        time.sleep(5)
        return call(method, path, params)


def publish_text(text: str, reply_to: str | None = None) -> str:
    params = {"media_type": "TEXT", "text": text}
    if reply_to:
        params["reply_to_id"] = reply_to
    container = call_with_retry("POST", "me/threads", params)["id"]
    time.sleep(3)  # コンテナ準備待ち
    return call_with_retry("POST", "me/threads_publish", {"creation_id": container})["id"]


# ---------------------------------------------------------------- Markdown helpers
def split_entries(text: str) -> tuple[str, list[str]]:
    """'## ' 見出しごとに分割。(前置き, [エントリ...]) を返す。"""
    parts = re.split(r"(?m)^(?=## )", text)
    head = parts[0] if parts and not parts[0].startswith("## ") else ""
    entries = [p for p in parts if p.startswith("## ")]
    return head, entries


def field(entry: str, key: str) -> str | None:
    m = re.search(rf"(?m)^- {re.escape(key)}:\s*(.*)$", entry)
    return m.group(1).strip() if m else None


def set_field(entry: str, key: str, value: str) -> str:
    pat = rf"(?m)^- {re.escape(key)}:.*$"
    if re.search(pat, entry):
        return re.sub(pat, lambda _: f"- {key}: {value}", entry, count=1)
    return entry.rstrip("\n") + f"\n- {key}: {value}\n"


def section(entry: str, name: str) -> str:
    m = re.search(rf"(?ms)^### {re.escape(name)}\s*\n(.*?)(?=^### |\Z)", entry)
    return m.group(1).strip() if m else ""


def norm(s: str) -> str:
    return re.sub(r"\s+", "", s)


# ---------------------------------------------------------------- commands
def cmd_check(_):
    me = call("GET", "me", {"fields": "id,username,name"})
    print(f"OK: @{me.get('username')} (id={me.get('id')})")


def cmd_status(_):
    now = datetime.now(JST)
    _, q = split_entries(QUEUE.read_text(encoding="utf-8")) if QUEUE.exists() else ("", [])
    _, h = split_entries(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else ("", [])
    _, t = split_entries(TOPICS.read_text(encoding="utf-8")) if TOPICS.exists() else ("", [])
    approved = [e for e in q if (field(e, "approved") or "").lower() == "true"]
    unfetched = [e for e in h if (field(e, "metrics_fetched") or "").lower() == "false"]
    unanalyzed = [e for e in h if (field(e, "analyzed") or "").lower() == "false"]
    last = None
    for e in h:
        m = re.match(r"## (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?", e)
        if m:
            d = datetime.strptime(f"{m.group(1)} {m.group(2) or '00:00'}", "%Y-%m-%d %H:%M").replace(tzinfo=JST)
            last = max(last, d) if last else d
    empty_knowledge = []
    for f in sorted(KNOWLEDGE.glob("0*.md")):
        body = f.read_text(encoding="utf-8")
        if "TODO" in body or re.search(r"(?m)^## .*\n\s*(?=^## |\Z)", body):
            empty_knowledge.append(f.name)
    out = {
        "now_jst": now.strftime("%Y-%m-%d %H:%M"),
        "last_post_jst": last.strftime("%Y-%m-%d %H:%M") if last else None,
        "days_since_last_post": round((now - last).total_seconds() / 86400, 1) if last else None,
        "topics_left": len(t),
        "queue_total": len(q),
        "queue_approved": len(approved),
        "metrics_unfetched": len(unfetched),
        "not_analyzed": len(unanalyzed),
        "knowledge_with_todo_or_empty": empty_knowledge,
        "token_set": bool(os.environ.get("THREADS_ACCESS_TOKEN")),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_post(args):
    require = os.environ.get("THREADS_REQUIRE_APPROVAL", "true").lower() != "false"
    head, q = split_entries(QUEUE.read_text(encoding="utf-8"))
    idx = next((i for i, e in enumerate(q)
                if not require or (field(e, "approved") or "").lower() == "true"), None)
    if idx is None:
        sys.exit("STOP: 投稿できる原稿がありません（approved: true の原稿が0件）。")
    entry = q[idx]
    qid = entry.splitlines()[0][3:].strip()
    body, comment = section(entry, "本文"), section(entry, "コメント欄")
    # コメント欄は '---' だけの行で区切ると、複数の続き（スレッド連投）として順につなげて投稿する
    parts = [p.strip() for p in re.split(r"(?m)^---\s*$", comment) if p.strip()]
    theme = field(entry, "theme") or ""
    if not body:
        sys.exit(f"STOP: {qid} の『### 本文』が空です。")
    for label, s in [("本文", body)] + [(f"コメント欄{i + 1}", p) for i, p in enumerate(parts)]:
        if len(s) > MAX_CHARS:
            sys.exit(f"STOP: {qid} の{label}が{len(s)}文字です（上限{MAX_CHARS}）。")
    hist_text = HISTORY.read_text(encoding="utf-8") if HISTORY.exists() else "# 投稿履歴\n\n"
    _, h = split_entries(hist_text)
    head40 = norm(body)[:40]
    for e in h:
        if field(e, "queue_id") == qid or (field(e, "text_head") or "") == head40:
            sys.exit(f"STOP: 二重投稿の疑い。{qid} は post-history.md に既にあります。キューから削除してください。")

    print(f"--- 投稿予定: {qid} / theme: {theme}\n[本文]\n{body}\n\n" + "".join(f"\n[コメント欄{i + 1}/{len(parts)}] ({len(p)}文字)\n{p}\n" for i, p in enumerate(parts)) + "---")
    if args.dry_run:
        print("DRY-RUN: 投稿していません。")
        return

    post_id = publish_text(body)
    reply_ids, prev = [], post_id
    for i, part in enumerate(parts):
        time.sleep(5)
        try:
            prev = publish_text(part, reply_to=prev)  # 直前の投稿にぶら下げて連投にする
            reply_ids.append(prev)
        except Exception as e:  # noqa: BLE001  本文は出ているので記録は必ず残す
            print(f"WARN: 続き{i + 1}の投稿失敗（本文は投稿済み・残りは中断）: {e}", file=sys.stderr)
            reply_ids.append("failed")
            break
    reply_id = ",".join(reply_ids) or "-"

    now = datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    new = (f"## {now}\n\n- post_id: {post_id}\n- reply_id: {reply_id}\n- queue_id: {qid}\n"
           f"- theme: {theme}\n- type: {field(entry, 'type') or '-'}\n- text_head: {head40}\n"
           f"- metrics_fetched: false\n- fetched_at: -\n- analyzed: false\n- likes: -\n- replies: -\n"
           f"- reposts: -\n- quotes: -\n- shares: -\n- views: -\n- comments: []\n\n"
           f"### 本文\n{body}\n\n")
    hist_head, _ = split_entries(hist_text)
    HISTORY.write_text((hist_head or "# 投稿履歴\n\n") + new + "".join(h), encoding="utf-8")
    del q[idx]
    QUEUE.write_text(head + "".join(q), encoding="utf-8")
    print(f"POSTED: post_id={post_id} reply_id={reply_id} at {now} JST")


def cmd_fetch(args):
    text = HISTORY.read_text(encoding="utf-8")
    head, h = split_entries(text)
    now = datetime.now(JST)
    done, skipped, failed = 0, 0, 0
    for i, e in enumerate(h):
        if (field(e, "metrics_fetched") or "").lower() != "false":
            continue
        m = re.match(r"## (\d{4}-\d{2}-\d{2} \d{2}:\d{2})", e)
        pid = field(e, "post_id")
        if not m or not pid:
            continue
        posted = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M").replace(tzinfo=JST)
        if now - posted < timedelta(hours=args.min_age_hours):
            skipped += 1
            continue
        try:
            ins = call("GET", f"{pid}/insights",
                       {"metric": "views,likes,replies,reposts,quotes,shares"})
            vals = {d["name"]: (d.get("values") or [{}])[0].get("value", d.get("total_value", {}).get("value"))
                    for d in ins.get("data", [])}
            reps = call("GET", f"{pid}/replies", {"fields": "id,text,timestamp,username"}).get("data", [])
        except Exception as ex:  # noqa: BLE001  false のまま次回へ
            print(f"WARN: {pid} の取得失敗（次回に回します）: {ex}", file=sys.stderr)
            failed += 1
            continue
        for k in ("likes", "replies", "reposts", "quotes", "shares", "views"):
            e = set_field(e, k, str(vals.get(k, "-")))
        lines = []
        for r in reps:
            t = (r.get("text") or "").replace("\n", " ")
            if r.get("id") in (field(e, "reply_id") or "").split(","):
                continue  # 自分のセルフリプライは除外
            tag = "[質問]" if any(w in t for w in QUESTION_WORDS) else "[感想]"
            lines.append(f"  - {tag} {r.get('timestamp', '')[:16]} @{r.get('username', '?')}: {t}")
        e = re.sub(r"(?ms)^- comments:.*?(?=^- |^### |\Z)",
                   lambda _: "- comments:" + (" []\n\n" if not lines else "\n" + "\n".join(lines) + "\n\n"),
                   e, count=1)
        e = set_field(e, "metrics_fetched", "true")
        e = set_field(e, "fetched_at", now.strftime("%Y-%m-%d %H:%M"))
        h[i] = e
        done += 1
    HISTORY.write_text(head + "".join(h), encoding="utf-8")
    print(f"FETCHED: {done} 件 / 24h未満で保留: {skipped} 件 / 失敗: {failed} 件")


def cmd_search(args):
    res = call("GET", "keyword_search", {
        "q": args.query, "search_type": args.type, "limit": args.limit,
        "fields": "id,text,permalink,timestamp,username"})
    for p in res.get("data", []):
        t = (p.get("text") or "").replace("\n", " ")[:140]
        print(f"- {p.get('timestamp', '')[:10]} @{p.get('username')}: {t}\n  {p.get('permalink')}")


def cmd_refresh(_):
    r = call("GET", "https://graph.threads.net/refresh_access_token",
             {"grant_type": "th_refresh_token"})
    days = int(r.get("expires_in", 0)) // 86400
    print(f"新しいトークン（有効 約{days}日）。環境変数 THREADS_ACCESS_TOKEN を差し替えてください:")
    print(r.get("access_token"))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("status").set_defaults(fn=cmd_status)
    sp = sub.add_parser("post")
    sp.add_argument("--dry-run", action="store_true")
    sp.set_defaults(fn=cmd_post)
    sf = sub.add_parser("fetch")
    sf.add_argument("--min-age-hours", type=float, default=24)
    sf.set_defaults(fn=cmd_fetch)
    ss = sub.add_parser("search")
    ss.add_argument("query")
    ss.add_argument("--type", default="TOP", choices=["TOP", "RECENT"])
    ss.add_argument("--limit", type=int, default=25)
    ss.set_defaults(fn=cmd_search)
    sub.add_parser("refresh-token").set_defaults(fn=cmd_refresh)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()

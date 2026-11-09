---
name: threads-fetcher
description: 投稿後のエンゲージメント（閲覧・いいね・コメント等）をThreads APIで回収するスキル。数字を取ってくる、いいね数やコメントを確認、数字を更新、分析の前準備をすると言われたら必ず使うこと。毎日の定期実行でも使う。
---

# Threadsフェッチャー（④ どうだった？を回収する役）

## 手順
1. `python3 threads/scripts/threads_api.py fetch` を実行
   - 対象：`metrics_fetched: false` かつ投稿から24時間以上経った投稿のみ
   - 取得：views / likes / replies / reposts / quotes / shares（`/{post_id}/insights`）
   - コメント：`/{post_id}/replies` を取得し、「？」「教えて」「どうしたら」等を含むものに [質問] を付ける
   - 成功した投稿は `metrics_fetched: true` に変わる。失敗したものは false のまま次回へ
2. 出力の件数を確認し、[質問] コメントがあれば一覧にして報告する（アナリストの最優先ネタになる）

## ルール
- 24時間未満の投稿は取りにいかない（数字が動いている途中のため）
- 取得済みの投稿を再取得しない
- APIエラーで止まっても手で数字を埋めない

## 保存（クラウド実行時は必須）
`git add threads/ops && git commit -m "threads: fetch metrics" && git push`

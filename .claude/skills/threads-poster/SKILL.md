---
name: threads-poster
description: post-queue.mdの原稿をThreadsへ実際に投稿するスキル。投稿する、公開する、予約分を出す、キューを消化すると言われたら必ず使うこと。定期実行の投稿タイミングでも必ず使う。
---

# Threadsポスター（③ 出す役）

post-queue.md の先頭にある**承認済み**の原稿を1本だけ公開する。
APIを叩く・ファイルを更新する部分はスクリプトが行い、このスキルは公開前の最終確認を担当する。

## 手順
1. 下見：`python3 threads/scripts/threads_api.py post --dry-run`
   - 「STOP」が出たら投稿せず、その内容を報告して終了
2. 公開前の最終確認（表示された本文・コメント欄を読む）
   - 07_ng-rules.md に抵触していないか
   - 誤字・事実と違う数字・壊れた改行がないか
   - 問題があれば投稿せず、post-queue.md の該当原稿を `approved: false` に戻し、理由を報告して終了
3. 公開：`python3 threads/scripts/threads_api.py post`
   - スクリプトが 本文投稿 → コメント欄をセルフリプライ → キューから削除 → post-history.md に追記（metrics_fetched: false）まで行う
4. 結果（post_id・時刻）を報告

## ルール
- 1回の実行で1投稿のみ。まとめて出さない
- APIエラー時のリトライは1回まで（スクリプトが実施）。2回失敗したら中断して状況を報告
- 二重投稿の防止はスクリプトが post-history.md と照合して行う。STOPを無視して手で投稿しない
- post-queue.md / post-history.md を手で書き換えて投稿したことにしない

## 保存（クラウド実行時は必須）
`git add threads/ops && git commit -m "threads: posted 1" && git push`
（投稿が成功したのに push を忘れると、次回二重投稿の原因になる。必ず実行する）

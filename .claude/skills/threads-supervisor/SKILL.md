---
name: threads-supervisor
description: Threads自動運用の状態を点検して日次レポートを出すスキル。運用が回っているか確認したい、状況チェック、今日なにをすればいい？、何かおかしいと言われたら必ず使うこと。毎朝の定期実行にも必ず使う。
---

# Threadsスーパーバイザー（⑤ 輪全体の見張り役）

## 手順
1. `python3 threads/scripts/threads_api.py status` で数値を取得
2. 必要に応じて threads/ops と threads/knowledge の各ファイルを読み、原因を特定
3. `threads/ops/supervisor-report.md` に上書き保存

## 点検項目
| # | 見るもの | 警告を出す条件 |
|---|---|---|
| 1 | 最終投稿日（days_since_last_post） | 2日以上投稿なし → ⚠️ 投稿停止中 |
| 2 | ネタストック（topics_left） | 1件以下 → ⚠️ ネタ枯渇 |
| 3 | 投稿キュー（queue_total / queue_approved） | 5件以上 → ⚠️ キュー滞留。承認済み0件 → ⚠️ 承認待ち |
| 4 | メトリクス未取得（metrics_unfetched） | 3件以上 → ⚠️ メトリクス未取得 |
| 5 | ナレッジ（knowledge_with_todo_or_empty） | 1件以上 → ⚠️ ナレッジ不備 |
| 6 | トークン（token_set） | false → 🔴 API実行不可 |

## 出力形式
```
# 運用レポート（YYYY-MM-DD）

## ステータス: 🟢正常 / 🟡注意 / 🔴停止

## チェック結果
- 最終投稿日:
- ネタストック: ○件
- 投稿キュー: ○件（うち承認済み ○件）
- メトリクス未取得: ○件
- ナレッジ不備: あり（ファイル名）/ なし

## 問題点
⚠️ 何が起きたか / なぜ起きたか / 何をするか

## 次にやるべきこと
1. （優先度順に具体的に）
```

## ルール
- 問題がなければ「🟢正常」の一行報告でよい
- 問題があるときは「何が起きたか」「なぜ起きたか」「何をするか」をセットで書く
- 行動は具体的に。✕「リサーチを実行してください」 ○「next-topics.md が残り1件なので、threads-researcher → threads-analyst を実行してテーマを3つ補充する」
- 🔴停止は「3日以上投稿が止まっている」「トークン未設定」「複数の問題が同時発生」のときだけ
- 自分で他の役割を実行して直さない（報告まで）。直すのは人が指示したとき

## 保存（クラウド実行時は必須）
`git add threads/ops && git commit -m "threads: supervisor report" && git push`

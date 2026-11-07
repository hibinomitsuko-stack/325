---
name: threads-researcher
description: Threads・X・Instagram・YouTubeを横断検索して、今ウケているネタ・フック（1行目）・読者の悩みを集めるスキル。リサーチ、トレンド調査、競合調査、ネタ探し、「他の人は何がバズってる？」と言われたら必ず使うこと。アナリストを回す前の仕込みとしても必ず使う。
---

# Threadsリサーチャー（⓪ 外の世界を見る役）

アカウント「みつこ｜陰キャのスレッズ集客法」のために、4媒体を横断して“今効いているネタと型”を集め、
`threads/ops/research-latest.md` に上書きする。アナリストがこれを読んでテーマを決める。

## 事前に読むファイル
- threads/knowledge/02_target.md（誰の悩みを探すか）
- threads/knowledge/03_theme.md（扱う／扱わない領域）
- threads/knowledge/04_positioning.md（差別化の軸）

## 検索キーワード（例。03_theme.md に合わせて増減）
スレッズ 集客 / Threads 伸びない / 顔出しなし 発信 / 内向型 SNS / 陰キャ 起業 / SNS 苦手 集客 /
スレッズ フォロワー 増やし方 / Threads アルゴリズム / AI 投稿 作り方 / 個人起業 集客 導線

## 媒体ごとの調べ方
直近30日以内を優先。WebSearch を使い、必要なら各ページを読む。

| 媒体 | 方法 | 見るもの |
|---|---|---|
| Threads | `python3 threads/scripts/threads_api.py search "キーワード"`（キーワード検索権限がある場合）。無い・失敗した場合は WebSearch で `site:threads.com` / `site:threads.net` | 伸びている投稿の1行目、コメント欄の質問 |
| X | WebSearch `site:x.com キーワード` | バズった投稿の型、引用で議論になっている論点 |
| Instagram | WebSearch `site:instagram.com キーワード` | 保存されやすいカルーセルのタイトル・構成 |
| YouTube | WebSearch `site:youtube.com キーワード` | 再生数の多い動画タイトル、コメント欄の悩み |

## 参考アカウント（毎回チェック）
09_benchmarks.md の一覧にあるアカウント。投稿URL（https://www.threads.com/@ハンドル/post/コード）が分かれば、
`curl -sS -A "Mozilla/5.0" URL` で取得したHTMLの `og:description` に本文が入っている（いいね・閲覧数は取れない）。
みつこが 09_benchmarks.md の「伸びた投稿」欄にURLを貼っていたら、最優先で本文を取得し、型を 09_benchmarks.md に追記する。

## 出力（research-latest.md に上書き）
```
# リサーチ結果（YYYY-MM-DD）

## 媒体別の発見
### Threads / X / Instagram / YouTube（各3〜5件）
- 1行目 or タイトル：「……」
- 型：箇条書き / 体験談 / 断言 / 比較 / Q&A など
- 反応の目安：（わかる範囲で数字）
- URL：
- なぜ効いているか：（一文）

## ターゲットの生の悩み・質問（引用で5件以上）
- 「……」（媒体・URL）

## みつこ流に変換したネタ候補（5件）
- ネタ：
- 元ネタとの違い（みつこだけの切り口）：
- 1行目の案：
```

## ルール
- 他人の投稿の丸写し・言い換えコピーは禁止。持ち帰るのは「型」と「悩み」だけ
- 出典URLを必ず書く。見つからなかった媒体は「該当なし」と正直に書く（作り話をしない）
- 07_ng-rules.md に触れる話題は候補から外す
- 運用ファイルを更新したら、最後に下の「保存」を行う

## 保存（クラウド実行時は必須）
`git add threads/ops && git commit -m "threads: research update" && git push` で変更を残す。

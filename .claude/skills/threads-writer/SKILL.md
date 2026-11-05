---
name: threads-writer
description: Threads投稿の原稿を作るスキル。投稿を書く、ネタから本文を作る、キューに原稿を足す、下書きを作ると頼まれたら必ず使うこと。post-queue.mdが空・残り少ないときも必ず使う。
---

# Threadsライター（② どう書く？の役）

next-topics.md をもとに投稿を3本書き、`threads/ops/post-queue.md` の末尾に追記する。

## 事前に読むファイル
- threads/knowledge/01_profile.md / 02_target.md（誰が誰に書くか）
- threads/knowledge/05_writing.md（文体ルール）
- threads/knowledge/06_references.md（伸びた投稿の構造見本）
- threads/knowledge/07_ng-rules.md（禁止事項）
- threads/ops/next-topics.md（今回のテーマ）
- threads/ops/analysis-latest.md（直近の学び。あれば）

## 手順（1本ごと）
1. next-topics.md の上からテーマを1つ選ぶ
2. 06_references.md から借りる「構造」を1つ選ぶ（丸写し禁止。型だけ）
3. **1行目を5案書き出し、一番強い1つを選ぶ**（5案と選んだ理由は会話に表示する）
   - 「有益そう」「意外」「続きが気になる」のどれかを必ず満たす
   - 固有名詞か数字を必ず含める（例：3ヶ月、月7桁、1日15分、顔出しゼロ）
4. 本文を200〜350文字で書く（上限500文字）
5. コメント欄に落とす続きを書く（本文だけで完結させない。100〜300文字）
6. セルフチェック。1つでも×なら直してから次へ
   - [ ] 1行目で読む手が止まるか
   - [ ] AIっぽい言い回しが混ざっていないか
   - [ ] 07_ng-rules.md に触れていないか
   - [ ] 05_writing.md の口調とズレていないか
   - [ ] みつこの実体験・数字が1つ以上入っているか

## 出力形式（崩すとポスターが読めない）
```
## Q-YYYYMMDD-01
- theme: テーマ名
- type: 箇条書き
- approved: false
- created: YYYY-MM-DD

### 本文
……

### コメント欄
……
```
- 3本を post-queue.md の末尾に追記（IDは日付＋連番。既存IDと重複させない）
- 使い終わったテーマを next-topics.md から削除
- `approved` は必ず `false` で書く（公開してよいかは、みつこ本人が決める）

## ルール
- 3本は必ず違う型（箇条書き / 体験談 / 断言 / Before→After / 失敗談 / Q&A など）
- 「〜って知ってましたか？」で始めるのは禁止
- 時間配分は1行目に最も多く割く

## 保存（クラウド実行時は必須）
`git add threads/ops && git commit -m "threads: add drafts to queue" && git push`

# Threads 自動運用（みつこ｜陰キャのスレッズ集客法 @mitsukoihle）

「調べる → 決める → 書く → 出す → 数字を取る → 次に活かす」を、6つの役割（Claude Codeスキル）に分けて回す仕組みです。
役割どうしの受け渡しは、すべて `threads/ops/` のMarkdownファイルで行います（会話の記憶に頼らない）。

## 1. 全体の流れ

```
 ⓪リサーチャー → ①アナリスト → ②ライター →（みつこが承認）→ ③ポスター → ④フェッチャー
 (4媒体を検索)   (何を書く？)   (どう書く？)                     (1本出す)     (どうだった？)
       ↑                                                                          │
       └──────────────────────── 数字・質問コメントを戻す ─────────────────────────┘
                     ⑤スーパーバイザー（毎朝この輪全体を点検）
```

| 役割 | スキル | 読む | 書く |
|---|---|---|---|
| ⓪リサーチャー | `threads-researcher` | knowledge 02〜04 | ops/research-latest.md |
| ①アナリスト | `threads-analyst` | post-history / research-latest / knowledge全部 | analysis-latest / next-topics |
| ②ライター | `threads-writer` | knowledge 01,02,05〜07 / next-topics | post-queue（approved: false で追加） |
| ③ポスター | `threads-poster` | post-queue / 07_ng-rules | post-history（＋キューから削除） |
| ④フェッチャー | `threads-fetcher` | post-history | post-history（数字・コメント） |
| ⑤スーパーバイザー | `threads-supervisor` | 全部 | supervisor-report |

リサーチャーが検索する媒体：**Threads / X / Instagram / YouTube**

API を叩く・ファイルを書き換える処理は `threads/scripts/threads_api.py` が担当し、
スキル（Claude）は判断（分析・執筆・NGチェック）を担当します。二重投稿チェックや「1回1本」はスクリプト側で強制されます。

## 2. ファイル構成

```
.claude/skills/threads-*/SKILL.md   … 6つの役割
threads/knowledge/01〜08_*.md       … ナレッジ（自分で書く。TODOを埋める）
threads/ops/*.md                    … 運用ファイル（自動で育つ）
threads/scripts/threads_api.py      … Threads API 用スクリプト（標準ライブラリのみ）
```

## 3. 初回セットアップ

### ① ナレッジを埋める（ここだけは自力で）
`threads/knowledge/` の 01〜08 にプロフィールから分かる範囲は下書き済みです。`TODO` の箇所を埋めてください。
特に **05_writing.md（文体）** と **06_references.md（伸びた投稿の見本）** が薄いと「AIっぽい投稿」になります。
コツ：自分の過去投稿を10本 05_writing.md に貼り、Claude に「文体の特徴を抽出して埋めて」と頼む。

### ② Threads API のアクセストークンを取得
1. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、ユースケース「Threads APIにアクセス」を追加
2. 権限：`threads_basic` `threads_content_publish` `threads_manage_insights` `threads_read_replies`
   （Threads内のキーワード検索も使うなら `threads_keyword_search`。無くてもリサーチャーはWeb検索で動きます）
3. 自分のThreadsアカウントをテスターに追加して承認 → アクセストークンを発行し、**長期トークン（60日）**に交換
4. 60日ごとに延長が必要：`python3 threads/scripts/threads_api.py refresh-token` → 表示された新トークンに差し替え

### ③ トークンとネットワークを設定（Claude Code クラウドで動かす場合）
セッション上部の環境メニュー → **Edit** で：
- **環境変数**に `THREADS_ACCESS_TOKEN=（長期トークン）` を追加（チャットには貼らないでください）
- **Network access** の Allowed domains に `graph.threads.net` を追加（現在の環境ではブロックされています）
- 新しいセッションから有効になります

確認：
```bash
python3 threads/scripts/threads_api.py check
```

### ④ 最初の原稿をためる
Claude Code に順番に頼む：
1. 「threads-researcher を実行して」
2. 「threads-analyst を実行して」
3. 「threads-writer を実行して」
4. `threads/ops/post-queue.md` を読み、出してOKな原稿を `approved: false` → `approved: true` に書き換える

## 4. 日々の回し方

| タイミング | 実行するスキル | 備考 |
|---|---|---|
| 毎朝 | ⑤スーパーバイザー | 🟢なら確認1秒で終わり |
| 投稿時刻（例 7:30 / 21:00 JST） | ③ポスター | 承認済みの先頭1本だけ出る |
| 毎日1回 | ④フェッチャー | 24時間以上経った投稿の数字を回収 |
| 週1（例 日曜） | ⓪リサーチャー → ①アナリスト → ②ライター | 仕込み直し。その後キューを承認 |

### 自動実行（定期実行）にする方法
- **Claude Code のスケジュール実行（おすすめ）**：上の表のとおり「毎朝8:00に threads-supervisor を実行して結果を push」などをスケジュール登録します。
  Claudeに「スーパーバイザーを毎朝実行するよう設定して」と頼めば登録できます。各スキルは最後に `git push` して状態を残すので、
  **このフォルダが main ブランチにマージされていること**が前提です。
- **自分のPCで回す場合**：cron などから `claude -p "threads-poster スキルを実行して"` を呼ぶ。

### 安全装置
- `THREADS_REQUIRE_APPROVAL`（既定 true）：`approved: true` の原稿しか投稿しません。原稿の質が安定したら `false` にすると完全自動になります
- 1回の実行で1投稿のみ／APIリトライは1回まで／post-history.md と照合して二重投稿を止める
- 投稿前に `post --dry-run` で中身を表示 → ポスターがNGルールで最終チェック

## 5. ファイル形式（崩さないこと）

post-queue.md
```
## Q-20261106-01
- theme: 顔出しなしで信頼される3つの工夫
- type: 箇条書き
- approved: false
- created: 2026-11-06

### 本文
（500文字以内）

### コメント欄
（セルフリプライで出す続き）
```

post-history.md（ポスターが自動で追記）
```
## 2026-11-06 07:30

- post_id: 17841400000000000
- reply_id: 17841400000000001
- queue_id: Q-20261106-01
- theme: 顔出しなしで信頼される3つの工夫
- metrics_fetched: false
- analyzed: false
- likes: -
- views: -
- comments: []
```

## 6. つまずきやすいところ

| 症状 | 原因 | 対処 |
|---|---|---|
| 投稿がAIっぽい | 05_writing.md が薄い | 自分の投稿を10本貼って文体を抽出させる |
| ネタがすぐ尽きる | 質問コメントを拾えていない | フェッチャーの [質問] が付いているか確認 |
| 同じような投稿が続く | 06_references.md の型が偏っている | 別タイプの投稿を追加／リサーチ結果から型を足す |
| 「STOP: approved: true の原稿が0件」 | 承認していない | post-queue.md で approved を true に |
| 二重投稿の疑いで止まる | 投稿後に push されず履歴が戻った | post-history.md を確認し、キューから該当原稿を削除 |
| API が 403 / 接続できない | ネットワーク許可がない | 環境設定で `graph.threads.net` を許可 |
| API が 401/190 エラー | トークン期限切れ | refresh-token で延長（期限後は再発行） |
| スキルが呼ばれない | description が控えめ | 「〜のときは必ず使うこと」を追記 |

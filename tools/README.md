# ココナラ検索順位チェッカー

`coconala-rank.mjs` は、メモにある手順

1. シークレットタブを開く（検索履歴の影響を受けないように）
2. ココナラで「LP」などのキーワードで検索する
3. `mitsuandco` が出てくるまでページを進める
4. 見つかったページと順位を記録する

をそのまま自動化したスクリプトです。Playwright が起動するブラウザは
毎回まっさらな状態（＝シークレットウィンドウ相当）なので、
普段の検索履歴やログイン状態の影響を受けません。

## 準備（初回のみ）

```bash
npm install -g playwright
npx playwright install chromium
```

## 使い方

```bash
# 「LP」で mitsuandco の順位を調べる
node tools/coconala-rank.mjs --keyword "LP"

# 複数キーワードをまとめて、結果を CSV に追記する
node tools/coconala-rank.mjs --keyword "LP,ロゴ,ラベル,wix" --csv coconala-rank.csv

# ブラウザの動きを目で見ながら実行する
node tools/coconala-rank.mjs --keyword "LP" --headed
```

### オプション

| オプション | 意味 | 既定値 |
| --- | --- | --- |
| `--keyword <語>` | 検索キーワード。カンマ区切りで複数指定可 | `LP` |
| `--seller <ID>` | 探す出品者ID | `mitsuandco` |
| `--max-pages <数>` | 何ページ目まで見るか | `30` |
| `--headed` | ブラウザ画面を表示する | （非表示） |
| `--csv <パス>` | 結果を CSV に追記する | （出力しない） |

### 出力例

```
■ キーワード「LP」を mitsuandco で検索中…
  1ページ目: 20件
  2ページ目: 20件
  ...
  21ページ目: 20件 ← ヒット
  → 21ページ目の1番目（通算 401位）
     LP制作★洗練されたランディングページを制作します
     https://coconala.com/services/xxxxxxx
```

CSV は `日付,キーワード,ページ,ページ内順位,通算順位,サービス名,URL` の形式なので、
そのままスプレッドシートに貼り付けられます。

## 注意

- ココナラの検索結果ページの HTML 構造が変わると、件数の拾い方がずれることがあります。
  1ページあたりの件数（通常20件前後）が表示されるので、明らかにおかしい数字が出たら
  `--headed` を付けて実際の画面と見比べてください。
- 検索順位は時間帯やログイン状態でも変わるため、毎日同じ時刻に測るのがおすすめです。

#!/usr/bin/env node
// ココナラ検索順位チェッカー
//
// メモの手順（シークレットタブでココナラ検索 → Command+F で自分の出品を探す）を
// そのまま自動化したものです。
//
//   node tools/coconala-rank.mjs --keyword "LP" --seller mitsuandco
//
// 主なオプション:
//   --keyword <語>      検索キーワード（複数指定可。カンマ区切りも可）
//   --seller <ID>       探す出品者ID（既定: mitsuandco）
//   --max-pages <数>    何ページまで見るか（既定: 30）
//   --headed            ブラウザ画面を表示して実行する
//   --csv <パス>        結果を CSV に追記する（日付,キーワード,ページ,ページ内順位,通算順位,サービス名,URL）
//
// 実行にはブラウザが必要です:
//   npm i -g playwright && npx playwright install chromium

import { chromium } from 'playwright';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const keywords = (flag('keyword', 'LP') || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);
const seller = (flag('seller', 'mitsuandco') || '').toLowerCase();
const maxPages = Number(flag('max-pages', '30'));
const csvPath = flag('csv');

// 1ページ分の検索結果を、表示順のまま取り出す。
// ココナラのクラス名は変わりやすいので、クラス名には依存せず
// 「/services/ へのリンクを最も多く含む、いちばん内側のコンテナ」を
// 検索結果リストとみなして拾っています。
function extractResults() {
  const serviceHref = 'a[href*="/services/"]';
  const anchors = Array.from(document.querySelectorAll(serviceHref));
  if (anchors.length === 0) return [];

  // 結果リストのコンテナを推定する
  let container = document.body;
  for (let el = anchors[0]; el && el !== document.body; el = el.parentElement) {
    if (el.querySelectorAll(serviceHref).length >= 5) {
      container = el;
      break;
    }
  }

  const seen = new Set();
  const out = [];
  for (const a of container.querySelectorAll(serviceHref)) {
    const m = (a.getAttribute('href') || '').match(/\/services\/(\d+)/);
    if (!m) continue;
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);

    // カード要素（出品者リンクを含む最小の祖先）まで遡る
    let card = a;
    for (let i = 0; i < 8 && card.parentElement; i += 1) {
      card = card.parentElement;
      if (card.querySelector('a[href*="/users/"]')) break;
    }
    const userLink = card.querySelector('a[href*="/users/"]');
    const userId = userLink
      ? decodeURIComponent((userLink.getAttribute('href').match(/\/users\/([^/?#]+)/) || [])[1] || '')
      : '';

    out.push({
      id,
      url: `https://coconala.com/services/${id}`,
      title: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      seller: userId,
      text: (card.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500),
    });
  }
  return out;
}

async function rankFor(context, keyword) {
  const page = await context.newPage();
  let overall = 0;

  try {
    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const url = `https://coconala.com/search?keyword=${encodeURIComponent(keyword)}&page=${pageNo}`;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      } catch (err) {
        if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_PROXY|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/.test(err.message)) {
          throw new Error(
            `coconala.com に接続できませんでした（${url}）。\n` +
              'プロキシやネットワーク制限で coconala.com がブロックされていないか確認してください。',
          );
        }
        throw err;
      }

      // 遅延読み込みのカードを描画させる
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 800) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);

      const results = await page.evaluate(extractResults);
      if (results.length === 0) {
        process.stdout.write(`  ${pageNo}ページ目: 結果なし（ここで終了）\n`);
        break;
      }

      const hitIndex = results.findIndex(
        (r) => r.seller.toLowerCase() === seller || r.text.toLowerCase().includes(seller),
      );
      process.stdout.write(`  ${pageNo}ページ目: ${results.length}件${hitIndex === -1 ? '' : ' ← ヒット'}\n`);

      if (hitIndex !== -1) {
        const hit = results[hitIndex];
        return {
          keyword,
          page: pageNo,
          rankInPage: hitIndex + 1,
          overallRank: overall + hitIndex + 1,
          title: hit.title || hit.text.slice(0, 60),
          url: hit.url,
        };
      }
      overall += results.length;
    }
    return { keyword, page: null, rankInPage: null, overallRank: null, title: '', url: '' };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ headless: !has('headed') });
// 新しい context = シークレットウィンドウ相当（Cookie も履歴も持たない）
const context = await browser.newContext({
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
  viewport: { width: 1280, height: 900 },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

const today = new Date().toISOString().slice(0, 10);
const rows = [];

try {
  for (const keyword of keywords) {
    process.stdout.write(`\n■ キーワード「${keyword}」を ${seller} で検索中…\n`);
    const r = await rankFor(context, keyword);
    rows.push(r);
    if (r.overallRank) {
      process.stdout.write(
        `  → ${r.page}ページ目の${r.rankInPage}番目（通算 ${r.overallRank}位）\n     ${r.title}\n     ${r.url}\n`,
      );
    } else {
      process.stdout.write(`  → ${maxPages}ページまでに見つかりませんでした\n`);
    }
  }
} finally {
  await browser.close();
}

process.stdout.write(`\n=== ${today} の順位 ===\n`);
for (const r of rows) {
  process.stdout.write(
    r.overallRank
      ? `${r.keyword}\t${r.page}ページ目 ${r.rankInPage}番目（通算 ${r.overallRank}位）\n`
      : `${r.keyword}\t圏外（${maxPages}ページまで）\n`,
  );
}

if (csvPath) {
  if (!existsSync(csvPath)) {
    writeFileSync(csvPath, '日付,キーワード,ページ,ページ内順位,通算順位,サービス名,URL\n');
  }
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  for (const r of rows) {
    appendFileSync(
      csvPath,
      [today, r.keyword, r.page ?? '', r.rankInPage ?? '', r.overallRank ?? '', r.title, r.url].map(esc).join(',') + '\n',
    );
  }
  process.stdout.write(`\nCSV に追記しました: ${csvPath}\n`);
}

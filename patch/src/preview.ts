/**
 * 入稿する前に、noteでどうなるかをターミナルで確認する。
 *   npx tsx src/preview.ts articles/<記事フォルダ>
 * 実際の入稿と同じ解析（articleParser）を通すので、見たままが入る。
 */
import { parseArticle } from './articleParser.js';
import type { RichLine } from './types.js';

const dir = process.argv[2];
if (!dir) {
  console.error('使い方: npx tsx src/preview.ts articles/<記事フォルダ>');
  process.exit(1);
}

const a = parseArticle(dir);

const LABEL: Record<string, string> = {
  h2: '【大見出し】',
  h3: '【小見出し→太字】',
  quote: '【引用】　　',
  p: '　　　　　　',
};

function lineText(l: RichLine): string {
  return l.spans.map((s) => s.text).join('');
}
function boldsOf(l: RichLine): string[] {
  return l.spans.filter((s) => s.bold).map((s) => s.text);
}

console.log('');
console.log('タイトル：' + a.frontmatter.title);
console.log('タグ　　：' + (a.frontmatter.tags ?? []).join(' / '));
console.log('='.repeat(64));
console.log('');

const count = { h2: 0, h3: 0, quote: 0, p: 0, bold: 0, img: 0 };
let anchor = '(なし)';

for (const b of a.blocks) {
  if (b.type === 'image') {
    count.img++;
    console.log('');
    console.log('  ★ 画像  ' + (b.image.rawPath.split('/').pop() ?? b.image.rawPath));
    console.log('     ここに入ります（目印にする行 → 「' + anchor.slice(-28) + '」）');
    console.log('');
    continue;
  }
  for (const l of b.lines ?? []) {
    const text = lineText(l);
    if (!text.trim()) { console.log(''); continue; }
    anchor = text.trim();
    count[l.kind]++;
    console.log(LABEL[l.kind] + ' ' + text);
    const bolds = boldsOf(l);
    if (bolds.length) {
      count.bold += bolds.length;
      console.log('              └ 太字：' + bolds.map((s) => '「' + s + '」').join('　'));
    }
  }
}

console.log('');
console.log('='.repeat(64));
console.log(
  `大見出し ${count.h2} ／ 小見出し(太字) ${count.h3} ／ 引用 ${count.quote} ／ ` +
    `太字 ${count.bold}か所 ／ 画像 ${count.img}枚 ／ 本文 ${a.bodyText.replace(/\s/g, '').length}字`,
);
console.log('');

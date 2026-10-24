import matter from 'gray-matter';
import { readFileSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import type {
  ArticleFrontmatter,
  ArticleImageRef,
  ArticleBlock,
  ParsedArticle,
  RichLine,
  RichSpan,
} from './types.js';

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

/** 記事フォルダ基準で画像パスを絶対パスに解決する */
function resolveImagePath(dir: string, rawPath: string): string {
  const clean = rawPath.trim().replace(/^\.\//, '');
  return isAbsolute(clean) ? clean : resolve(dir, clean);
}

/** 行の中の装飾だけを落とす（太字の ** は残す。あとで spans に分けるため） */
function stripInlineExceptBold(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1') // リンクはテキストだけ
    .replace(/`([^`]+)`/g, '$1') // インラインコード
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1'); // 斜体
}

/** 「ここは**太字**です」→ [{text:'ここは'},{text:'太字',bold:true},{text:'です'}] */
function toSpans(line: string): RichSpan[] {
  const spans: RichSpan[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) spans.push({ text: stripInlineExceptBold(line.slice(last, m.index)) });
    spans.push({ text: stripInlineExceptBold(m[1]), bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) spans.push({ text: stripInlineExceptBold(line.slice(last)) });
  return spans.filter((s) => s.text.length > 0);
}

/** 表の1行「| a | b |」を読みやすい1行に畳む。区切り行（|---|---|）は null */
function tableRowToText(line: string): string | null {
  const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return null; // 区切り行
  return cells.filter((c) => c.length > 0).join('　／　');
}

/**
 * Markdown を「書式つきの行の並び」に変換する。
 * 記号は落とさずに kind（見出し/引用）と bold に変換して持ち回り、
 * note のエディタ側で実際の書式として適用する。
 */
export function mdToRichLines(md: string): RichLine[] {
  const out: RichLine[] = [];
  let inFence = false;

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');

    // コードフェンス ``` は記号を出さず、中身は引用にする
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push({ kind: 'quote', spans: line.trim() ? [{ text: line }] : [{ text: '' }] });
      continue;
    }

    if (!line.trim()) {
      out.push({ kind: 'p', spans: [] }); // 空行
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) continue; // 水平線は出さない

    // 表
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const t = tableRowToText(line);
      if (t) out.push({ kind: 'p', spans: toSpans(t) });
      continue;
    }

    // 見出し（「## 1. タイトル」の番号は note が番号リストにしてしまうので落とす）
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const text = h[2].replace(/^\d+[.．]\s*/, '');
      out.push({ kind: h[1].length >= 3 ? 'h3' : 'h2', spans: toSpans(text) });
      continue;
    }

    // 引用
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) {
      out.push({ kind: 'quote', spans: toSpans(q[1]) });
      continue;
    }

    // 箇条書きは中黒にして普通の行にする（note のリストUIに触らない）
    const b = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (b) {
      out.push({ kind: 'p', spans: toSpans('・' + b[1]) });
      continue;
    }

    out.push({ kind: 'p', spans: toSpans(line) });
  }

  // 先頭と末尾の空行、3行以上続く空行を詰める
  const trimmed: RichLine[] = [];
  let blank = 0;
  for (const l of out) {
    const isBlank = l.spans.length === 0;
    if (isBlank) {
      blank++;
      if (blank > 1 || trimmed.length === 0) continue;
    } else {
      blank = 0;
    }
    trimmed.push(l);
  }
  while (trimmed.length && trimmed[trimmed.length - 1].spans.length === 0) trimmed.pop();
  return trimmed;
}

/** RichLine を、今までどおりのプレーンテキストに戻す（文字数表示・画像の目印に使う） */
export function richLinesToText(lines: RichLine[]): string {
  return lines.map((l) => l.spans.map((s) => s.text).join('')).join('\n');
}

export function parseArticle(articleDir: string): ParsedArticle {
  const dir = resolve(articleDir);
  const mdPath = resolve(dir, 'article.md');
  const raw = readFileSync(mdPath, 'utf8');
  const { data, content } = matter(raw);

  const fm: ArticleFrontmatter = {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail.trim() : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t)) : undefined,
  };

  // 本文をブロック（テキスト / 画像）に分割
  const blocks: ArticleBlock[] = [];
  const images: ArticleImageRef[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  IMAGE_RE.lastIndex = 0;

  const pushText = (segment: string) => {
    const lines = mdToRichLines(segment);
    const text = richLinesToText(lines);
    if (text.length > 0) blocks.push({ type: 'text', text, lines });
  };

  while ((match = IMAGE_RE.exec(content)) !== null) {
    const [, alt, rawPath] = match;
    pushText(content.slice(lastIndex, match.index));
    const image: ArticleImageRef = {
      alt: alt ?? '',
      rawPath: rawPath.trim(),
      absPath: resolveImagePath(dir, rawPath),
      position: images.length,
    };
    images.push(image);
    blocks.push({ type: 'image', image });
    lastIndex = match.index + match[0].length;
  }
  pushText(content.slice(lastIndex));

  const bodyText = blocks
    .filter((b): b is { type: 'text'; text: string; lines?: RichLine[] } => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n');

  const thumbnailAbsPath = fm.thumbnail ? resolveImagePath(dir, fm.thumbnail) : undefined;

  return { dir, frontmatter: fm, bodyText, images, blocks, thumbnailAbsPath };
}

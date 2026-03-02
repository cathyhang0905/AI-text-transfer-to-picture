/**
 * 智能分页引擎 v5 — Two-pass (Greedy Fill + Rebalance)
 *
 * v4 问题：贪心算法只向前填充，遇到截面边界时容易产生稀疏页：
 *   - Page N+1 开头只有标题 + 一句话 → 剩余空间大
 *   - Page N+2 开头是超大列表 → 触发溢出，N+1 被提前 flush
 *
 * v5 新增第二轮 Rebalance：
 *   遍历所有页，若当前页填充率 < 55%，则从下一页"借"原子
 *   直到达标或下一页原子不可借（会溢出、只剩1个、或是标题起始）为止。
 *   保证：① 不溢出（所有页 ≤ availableHeight）② 不丢失内容
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { preprocessHighlight } from './highlight';

export type Spacing  = '1.0' | '1.15' | '1.5' | '2.0';
export type FontSize = '12' | '14' | '16' | '18';
export type Font     = 'inter' | 'yahei' | 'noto-sans' | 'noto-serif' | 'serif';

// Total padding (all four sides combined = p-N * 2 in Tailwind)
const PADDING_PX: Record<Spacing, number> = {
  '1.0':  48,   // p-6  → 24px/side
  '1.15': 64,   // p-8  → 32px/side
  '1.5':  80,   // p-10 → 40px/side
  '2.0':  96,   // p-12 → 48px/side
};

const LINE_HEIGHT: Record<Spacing, number> = {
  '1.0':  1.0,
  '1.15': 1.15,
  '1.5':  1.5,
  '2.0':  2.0,
};

const FONT_SIZE_PX: Record<FontSize, number> = {
  '12': 12,
  '14': 14,
  '16': 16,
  '18': 18,
};

const FONT_FAMILY: Record<Font, string> = {
  'inter':      '"Inter", "Noto Sans SC", system-ui, sans-serif',
  'yahei':      '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  'noto-sans':  '"Noto Sans SC", "Microsoft YaHei", sans-serif',
  'noto-serif': '"Noto Serif SC", "SimSun", "STSong", serif',
  'serif':      'Georgia, "Times New Roman", serif',
};

const BADGE_HEIGHT = 44;

// ---------------------------------------------------------------------------
// Atom: 最小可渲染单元
// ---------------------------------------------------------------------------
interface Atom {
  text: string;
  isList: boolean;
}

// ---------------------------------------------------------------------------
// 谓词
// ---------------------------------------------------------------------------
const isHeading  = (a: Atom) => /^#{1,6}\s/.test(a.text.split('\n')[0]);
const allHeadings = (batch: Atom[]) => batch.every(isHeading);

// ---------------------------------------------------------------------------
// 将 section 拆成原子
// ---------------------------------------------------------------------------
function splitIntoAtoms(section: string, isPlainText = false): Atom[] {
  // 纯文本模式：每行独立成 atom，不合并连续行
  if (isPlainText) {
    return section.split('\n')
      .filter(line => line.trim())
      .map(line => ({ text: line.trim(), isList: false }));
  }

  const result: Atom[] = [];
  const lines = section.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    if (/^#{1,6}\s/.test(trimmed)) {
      result.push({ text: line, isList: false });
      i++;
      continue;
    }

    if (/^[-*+]\s|^\d+\.\s/.test(trimmed)) {
      const itemLines = [line];
      i++;
      while (i < lines.length && /^\s+/.test(lines[i]) && lines[i].trim()) {
        itemLines.push(lines[i]);
        i++;
      }
      result.push({ text: itemLines.join('\n'), isList: true });
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrimmed = next.trim();
      if (!nextTrimmed) break;
      if (/^#{1,6}\s/.test(nextTrimmed)) break;
      if (/^[-*+]\s|^\d+\.\s/.test(nextTrimmed)) break;
      paraLines.push(next);
      i++;
    }
    result.push({ text: paraLines.join('\n'), isList: false });
  }

  return result.filter(a => a.text.trim());
}

// ---------------------------------------------------------------------------
// 原子数组 → Markdown 字符串
// 连续列表原子用 \n 拼（紧凑列表），其余用 \n\n 分隔
// ---------------------------------------------------------------------------
function atomsToMarkdown(atoms: Atom[]): string {
  if (atoms.length === 0) return '';
  const parts: string[] = [];
  let i = 0;
  while (i < atoms.length) {
    if (atoms[i].isList) {
      const listLines: string[] = [];
      while (i < atoms.length && atoms[i].isList) {
        listLines.push(atoms[i].text);
        i++;
      }
      parts.push(listLines.join('\n'));
    } else {
      parts.push(atoms[i].text);
      i++;
    }
  }
  return parts.join('\n\n').trim();
}

// ---------------------------------------------------------------------------
// Markdown → HTML（测量用）
// ---------------------------------------------------------------------------
function markdownToHTML(md: string): string {
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown as any, {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeRaw],
      children: preprocessHighlight(md),
    }),
  );
}

// ---------------------------------------------------------------------------
// 创建隐藏测量容器
// ---------------------------------------------------------------------------
function createMeasureContainer(
  contentWidth: number,
  fontSizePx: number,
  fontFamily: string,
  lineHeight: number,
): HTMLDivElement {
  const div = document.createElement('div');
  const h1Size = fontSizePx * 1.5;
  const h2Size = fontSizePx * 1.25;
  // Paragraph gap scales with line height so measurement matches the rendered card
  const paraGap    = `${(lineHeight * 0.4).toFixed(2)}em`;
  const headingGap = `${(lineHeight * 0.35).toFixed(2)}em`;
  const listGap    = `${(lineHeight * 0.15).toFixed(2)}em`;

  div.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: ${contentWidth}px;
    font-size: ${fontSizePx}px;
    line-height: ${lineHeight};
    font-family: ${fontFamily};
    visibility: hidden;
    word-break: break-word;
    overflow-wrap: break-word;
    pointer-events: none;
  `;

  const style = document.createElement('style');
  style.textContent = `
    h1 { font-size: ${h1Size}px; font-weight: 700; line-height: ${lineHeight}; margin-bottom: ${headingGap}; }
    h2 { font-size: ${h2Size}px; font-weight: 600; line-height: ${lineHeight}; margin-bottom: ${headingGap}; }
    p  { margin-bottom: ${paraGap}; }
    ul, ol { margin-bottom: ${paraGap}; padding-left: 1.5em; }
    li { margin-bottom: ${listGap}; }
    mark { background: #FEF3C7; border-radius: 3px; padding: 0 3px; }
    strong { font-weight: 700; }
  `;
  div.appendChild(style);
  document.body.appendChild(div);
  return div;
}

// ---------------------------------------------------------------------------
// 第一轮：贪心填充，返回 Atom[][] 供第二轮使用
// ---------------------------------------------------------------------------
function greedyFill(
  atoms: Atom[],
  availableHeight: number,
  measure: (batch: Atom[]) => number,
): Atom[][] {
  const pages: Atom[][] = [];
  let pageAtoms: Atom[] = [];

  for (const atom of atoms) {
    const testAtoms = [...pageAtoms, atom];
    const height = measure(testAtoms);

    if (height > availableHeight && pageAtoms.length > 0) {
      if (allHeadings(pageAtoms)) {
        // 全标题页：强制并入下一 atom，避免空洞
        pageAtoms = testAtoms;
      } else {
        // 防孤儿标题：末尾标题携带到下一页
        let toFlush = pageAtoms;
        let carried: Atom[] = [];
        const last = toFlush[toFlush.length - 1];
        if (toFlush.length > 1 && isHeading(last)) {
          const remainder = toFlush.slice(0, -1);
          if (remainder.some(a => !isHeading(a))) {
            carried = [last];
            toFlush = remainder;
          }
        }
        pages.push(toFlush);
        pageAtoms = [...carried, atom];
      }
    } else {
      pageAtoms = testAtoms;
    }
  }

  if (pageAtoms.length > 0) pages.push(pageAtoms);
  return pages.length > 0 ? pages : [[]];
}

// ---------------------------------------------------------------------------
// 第二轮：Rebalance — 从下一页借原子填满稀疏页
//
// 规则：
//  1. 当前页填充率 < 55% → 尝试从下一页头部借原子
//  2. 候选原子不能是标题（防止标题与内容分离）
//  3. 借入后不能超过 availableHeight
//  4. 下一页至少保留 1 个原子
// ---------------------------------------------------------------------------
function rebalancePages(
  pages: Atom[][],
  availableHeight: number,
  measure: (batch: Atom[]) => number,
): void {
  const MIN_FILL = availableHeight * 0.75;

  for (let i = 0; i < pages.length - 1; i++) {
    let currentH = measure(pages[i]);

    while (currentH < MIN_FILL && pages[i + 1].length > 1) {
      const candidate = pages[i + 1][0];

      // 不借标题（标题必须和其内容在同一页）
      if (isHeading(candidate)) break;

      const newH = measure([...pages[i], candidate]);
      if (newH > availableHeight) break;

      pages[i] = [...pages[i], candidate];
      pages[i + 1] = pages[i + 1].slice(1);
      currentH = newH;
    }
  }
}

// ---------------------------------------------------------------------------
// 主函数：两轮合并
// ---------------------------------------------------------------------------
function packAtomsIntoPages(
  atoms: Atom[],
  availableHeight: number,
  contentWidth: number,
  fontSizePx: number,
  fontFamily: string,
  lineHeight: number,
): string[] {
  if (atoms.length === 0) return [];

  const container = createMeasureContainer(contentWidth, fontSizePx, fontFamily, lineHeight);

  const measure = (batch: Atom[]): number => {
    if (batch.length === 0) return 0;
    const html = markdownToHTML(atomsToMarkdown(batch));
    const style = container.querySelector('style')!;
    container.innerHTML = '';
    container.appendChild(style);
    const content = document.createElement('div');
    content.innerHTML = html;
    container.appendChild(content);
    return container.scrollHeight;
  };

  // 第一轮：贪心填充
  const atomPages = greedyFill(atoms, availableHeight, measure);

  // 第二轮：填满稀疏页
  rebalancePages(atomPages, availableHeight, measure);

  document.body.removeChild(container);

  const result = atomPages.map(atomsToMarkdown).filter(s => s.trim());
  return result.length > 0 ? result : [''];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function paginateContent(
  content: string,
  cardWidth: number,
  spacing: Spacing,
  fontSize: FontSize,
  font: Font,
  splitSections = true,
  isPlainText = false,
): string[] {
  if (cardWidth <= 0) {
    if (!splitSections) return content.trim() ? [content] : [''];
    const fallback = content.split('---').map(s => s.trim()).filter(Boolean);
    return fallback.length > 0 ? fallback : [''];
  }

  const fontSizePx = FONT_SIZE_PX[fontSize];
  const fontFamily = FONT_FAMILY[font];
  const paddingPx  = PADDING_PX[spacing];
  const lineHeight = LINE_HEIGHT[spacing];
  const cardHeight = cardWidth * (4 / 3);
  const availableH = cardHeight - paddingPx - BADGE_HEIGHT;
  const contentW   = cardWidth - paddingPx;

  const userSections = splitSections
    ? content.split('---').map(s => s.trim()).filter(Boolean)
    : [content.trim()].filter(Boolean);
  const allPages: string[] = [];

  for (const section of userSections) {
    const atoms = splitIntoAtoms(section, isPlainText);
    const pages = packAtomsIntoPages(atoms, availableH, contentW, fontSizePx, fontFamily, lineHeight);
    allPages.push(...pages);
  }

  return allPages.length > 0 ? allPages : [''];
}

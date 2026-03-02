import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

interface EditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onPreviewContentChange: (content: string) => void;
  format: 'markdown' | 'text';
  onFormatChange: (format: 'markdown' | 'text') => void;
}

// ---------------------------------------------------------------------------
// AI 返回的标注 JSON：
//   title      → AI 基于内容理解生成的主标题字符串（插入文档最前，全文唯一）
//   highlights → 原文词组字符串（词级精准匹配）
//   bolds      → 原文词组字符串（词级精准匹配）
// ---------------------------------------------------------------------------
interface Annotations {
  title?:      string;
  highlights?: string[];
  bolds?:      string[];
}

// ---------------------------------------------------------------------------
// 空白标准化模糊查找
// 先尝试精确匹配；若失败，将 phrase 中的空白序列替换为 \s* 进行宽松匹配。
// 返回在 text 中实际匹配到的区间（start 含、end 不含），或 null。
// ---------------------------------------------------------------------------
function findPhrase(
  text: string,
  phrase: string,
  fromIndex = 0,
): { start: number; end: number } | null {
  // 快速路径：精确匹配
  const exact = text.indexOf(phrase, fromIndex);
  if (exact !== -1) return { start: exact, end: exact + phrase.length };

  // 宽松路径：将 phrase 按空白拆词，词内字符间与词间均插入 \s*
  // 同时兼容"AI 多空格"（phrase 有空格、原文无）和
  //         "AI 少空格"（phrase 无空格、原文有）两个方向的偏差
  const tokens = phrase.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const flexible = tokens
    .map(token =>
      Array.from(token)
        .map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\s*'),
    )
    .join('\\s*');

  try {
    const re = new RegExp(flexible, 'g');
    re.lastIndex = fromIndex;
    const m = re.exec(text);
    if (m) return { start: m.index, end: m.index + m[0].length };
  } catch {
    // 正则构建失败时静默回退
  }
  return null;
}

function applyAnnotations(text: string, ann: Annotations): string {
  // Phase 1: 在原始文本上定位所有词组位置，highlights 优先入队
  type Range = { start: number; end: number; open: string; close: string };
  const ranges: Range[] = [];

  const collect = (phrases: string[], open: string, close: string) => {
    for (const phrase of (phrases ?? [])) {
      if (!phrase) continue;
      const match = findPhrase(text, phrase, 0);
      if (!match) continue;
      const { start, end } = match;
      if (!ranges.some(r => start < r.end && end > r.start)) {
        ranges.push({ start, end, open, close });
      }
    }
  };

  collect(ann.highlights ?? [], '==', '==');
  collect(ann.bolds      ?? [], '**', '**');
  ranges.sort((a, b) => a.start - b.start);

  // Phase 2: 单次重建字符串，无嵌套污染
  let result = '';
  let cursor = 0;
  for (const { start, end, open, close } of ranges) {
    result += text.slice(cursor, start) + open + text.slice(start, end) + close;
    cursor = end;
  }
  result += text.slice(cursor);

  // Phase 3: 若 AI 生成了主标题，插入到文档最前面
  const title = ann.title?.trim();
  if (title) {
    result = `# ${title}\n\n${result}`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function Editor({ content, onContentChange, onPreviewContentChange, format, onFormatChange }: EditorProps) {
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');

  // Track latest content via ref so async handlers can detect stale closures
  const contentRef = useRef(content);
  useEffect(() => { contentRef.current = content; }, [content]);

  const handleFormatChange = (newFormat: 'markdown' | 'text') => {
    if (newFormat !== format) onFormatChange(newFormat);
  };

  const buildPrompt = (text: string): string => {
    if (format === 'text') {
      return `你是一位专业的内容编辑。请分析以下文本，以 JSON 格式输出标注信息，不输出任何其他内容。

JSON 格式：
{
  "title": "主题标题（20字以内，不以句号结尾；若无法归纳则省略此字段）",
  "highlights": ["原文短语或完整句子（核心结论、关键观点，可高亮整句）"],
  "bolds": ["原文短语（关键数据、数字、专业术语）"]
}

要求：
① highlights 和 bolds 中的内容必须是原文中的精确字符串片段，不得改动任何字符
② 优先高亮完整的句子或较长短语，不要只摘取单个词
③ 中英文括注是同一个概念，必须整体包裹，例如"幻觉产生 (Hallucination)"

示例：
输入：幻觉产生 (Hallucination) 是AI常见问题，增长率高达50%。这直接影响了用户的使用体验。
输出：{"title":"AI幻觉问题","highlights":["幻觉产生 (Hallucination) 是AI常见问题","这直接影响了用户的使用体验"],"bolds":["50%"]}

原文：
${text}`;
    } else {
      return `你是一位专业的文字校对员。请对以下 Markdown 内容仅做语法校对，严格遵守以下规则：

1. 修正错别字和明显的语法错误
2. 修正不规范的 Markdown 语法（如标题缺少空格、列表缩进错误等）
3. 不修改任何内容表达、不调整结构、不添加或删减任何段落和要点
4. 直接返回校对后的完整内容，不要加任何说明或前缀

原始内容：
${text}`;
    }
  };

  const handlePolish = async () => {
    if (isPolishing) return;
    if (!content.trim()) {
      setPolishError('编辑器内容为空，请先输入文字');
      return;
    }

    setPolishError('');
    setIsPolishing(true);
    const snapshotContent = content; // capture snapshot — detect if user edits while we wait

    try {
      const response = await fetch('/api/claude/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-14B-Instruct',
          max_tokens: 1024,
          messages: [{ role: 'user', content: buildPrompt(content) }],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message ?? `请求失败 (${response.status})`);
      }

      const raw = data?.choices?.[0]?.message?.content ?? '';
      if (!raw) throw new Error('AI 返回内容为空');

      if (format === 'text') {
        // 解析 JSON 格式标注
        let ann: Annotations = {};
        try {
          // 去掉 AI 可能包裹的 ```json ... ``` 代码块
          const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          ann = JSON.parse(jsonStr);
        } catch {
          // JSON 解析失败时静默降级：不标注，仅规范化内容
        }

        // 验证词组确实存在于原文，过滤掉 AI 幻觉（不存在的词组）
        const safeArr = (arr: string[] | undefined) =>
          (arr ?? []).filter(p => p && findPhrase(content, p) !== null);

        const title      = ann.title?.trim() ?? '';
        const highlights = safeArr(ann.highlights);
        const bolds      = safeArr(ann.bolds);

        // 将原文每行规范化为独立 Markdown 段落（\n\n 分隔），
        // 确保 Markdown 分页引擎能将每行拆成独立 atom，避免无空行时所有内容塌缩为 1 页
        const normalizedContent = content.split('\n').filter(l => l.trim()).join('\n\n');
        const annotated = applyAnnotations(normalizedContent, { title, highlights, bolds });
        // Discard result if user edited content while AI was processing
        if (contentRef.current !== snapshotContent) return;
        onPreviewContentChange(annotated);
      } else {
        // 清理 AI 常见的多余包装：代码块、前缀说明行
        let cleaned = raw.trim();
        const mdBlock = cleaned.match(/^```(?:markdown)?\n([\s\S]+?)\n```\s*$/);
        if (mdBlock) cleaned = mdBlock[1].trim();
        onContentChange(cleaned);
      }
    } catch (e: any) {
      setPolishError(e.message ?? '处理失败，请重试');
    } finally {
      setIsPolishing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">编辑器</h2>
          <div className="flex gap-1 ml-3 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => handleFormatChange('text')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                format === 'text'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => handleFormatChange('markdown')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                format === 'markdown'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Markdown
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {/* 清空按钮 */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onContentChange('')}
            disabled={!content}
          >
            <Trash2 className="w-4 h-4" />
            清空
          </Button>

          {/* AI 按钮 */}
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:opacity-60"
            onClick={handlePolish}
            disabled={isPolishing}
          >
            {isPolishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {'AI 润色中...'}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {format === 'text' ? 'AI 润色' : 'AI 润色'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {polishError && (
        <div className="mx-6 mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 flex-shrink-0">
          {polishError}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
          placeholder={
            format === 'markdown'
              ? `开始输入内容...\n\n支持 Markdown 语法：\n# 标题\n## 二级标题\n- 列表项\n**加粗文字**\n==高亮文字==`
              : `开始输入纯文本内容...\n\n点击「AI 润色」，自动识别标题、高亮关键结论、加粗重要数据。`
          }
          className="w-full h-full resize-none outline-none font-sans text-base leading-relaxed p-4 bg-transparent placeholder:text-gray-400"
          style={{ lineHeight: '1.8', minHeight: '400px' }}
        />
        {format === 'text' && (
          <p className="mt-3 px-4 text-xs text-gray-400">
            Text 模式下，AI 润色会帮你自动生成标题，针对内容进行视觉排版
          </p>
        )}
      </div>
    </div>
  );
}

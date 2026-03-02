import React, {
  useState, useRef, useMemo,
  forwardRef, useImperativeHandle,
  Component,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { templates } from './TemplateGallery';
import { preprocessHighlight } from '../utils/highlight';

// ---------------------------------------------------------------------------
// Error boundary — if ReactMarkdown throws, fall back to raw text (zero-loss)
// ---------------------------------------------------------------------------
interface EBProps { rawText: string; children: React.ReactNode }
interface EBState { hasError: boolean }

class MarkdownErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(): EBState { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'inherit', fontFamily: 'inherit' }}>
          {this.props.rawText}
        </pre>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CardPreviewProps {
  content: string;
  templateId: string;
  pageNumber: number;
  totalPages: number;
  spacing?: '1.0' | '1.15' | '1.5' | '2.0';
  font?: 'inter' | 'yahei' | 'noto-sans' | 'noto-serif' | 'serif';

  titleAlign?: 'left' | 'center' | 'right';
  fontSize?: '12' | '14' | '16' | '18';
  contentAlign?: 'left' | 'center' | 'right';
  isPlainText?: boolean;
}

export interface CardPreviewRef {
  exportImage: () => Promise<string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const CardPreview = forwardRef<CardPreviewRef, CardPreviewProps>(function CardPreview({
  content,
  templateId,
  pageNumber,
  totalPages,
  spacing = '1.15',
  font = 'inter',
  titleAlign = 'left',
  fontSize = '14',
  contentAlign = 'left',
  isPlainText = false,
}, ref) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const template = templates.find(t => t.id === templateId) || templates[0];

  // 判断是否深色模版（文字为浅色说明背景深）
  const isDarkTemplate = template.textColor.startsWith('#ff') || template.textColor.startsWith('#fe');

  const spacingMap = {
    '1.0':  { padding: 'p-6',  gap: 'mb-1', titleMb: 'mb-2', lineHeight: 1.0  },
    '1.15': { padding: 'p-8',  gap: 'mb-2', titleMb: 'mb-3', lineHeight: 1.15 },
    '1.5':  { padding: 'p-10', gap: 'mb-3', titleMb: 'mb-5', lineHeight: 1.5  },
    '2.0':  { padding: 'p-12', gap: 'mb-4', titleMb: 'mb-6', lineHeight: 2.0  },
  };

  const fontMap: Record<string, string> = {
    'inter':      '"Inter", "Noto Sans SC", system-ui, sans-serif',
    'yahei':      '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    'noto-sans':  '"Noto Sans SC", "Microsoft YaHei", sans-serif',
    'noto-serif': '"Noto Serif SC", "SimSun", "STSong", serif',
    'serif':      'Georgia, "Times New Roman", serif',
  };

  const fontSizeMap = {
    '12': { base: '12px', h1: '18px',   h2: '15px'   },
    '14': { base: '14px', h1: '21px',   h2: '17.5px' },
    '16': { base: '16px', h1: '24px',   h2: '20px'   },
    '18': { base: '18px', h1: '27px',   h2: '22.5px' },
  };

  const alignMap = { left: 'text-left', center: 'text-center', right: 'text-right' };

  const sp  = spacingMap[spacing];
  const fontFamily = fontMap[font];
  const tAlign  = alignMap[titleAlign];
  const cAlign  = alignMap[contentAlign];
  const fSize   = fontSizeMap[fontSize];

  // Export
  const exportImage = async (): Promise<string> => {
    if (!cardRef.current) return '';
    return toPng(cardRef.current, { pixelRatio: 2, cacheBust: true });
  };
  useImperativeHandle(ref, () => ({ exportImage }));

  const handleExport = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await exportImage();
      const link = document.createElement('a');
      link.download = `card-${pageNumber}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  // Memoised ReactMarkdown component map (avoids full re-render on every keystroke)
  const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = useMemo(() => ({
    h1: ({ children }) => (
      <h1 className={`font-bold ${sp.titleMb} ${tAlign}`}
          style={{ color: template.titleColor, fontSize: fSize.h1, lineHeight: sp.lineHeight }}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={`font-semibold ${sp.gap} ${tAlign}`}
          style={{ color: template.titleColor, fontSize: fSize.h2, lineHeight: sp.lineHeight }}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`font-semibold ${sp.gap} ${tAlign}`}
          style={{ color: template.titleColor, fontSize: fSize.base, lineHeight: sp.lineHeight }}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className={`font-medium ${sp.gap} ${tAlign}`}
          style={{ color: template.titleColor, fontSize: fSize.base, lineHeight: sp.lineHeight }}>
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className={`${sp.gap} ${cAlign}`}
         style={{ color: template.textColor, fontSize: fSize.base, lineHeight: sp.lineHeight }}>
        {children}
      </p>
    ),
    ul: ({ children }) => <ul className="list-disc ml-5 space-y-1">{children}</ul>,
    ol: ({ children, start }: any) => <ol className="list-decimal ml-5 space-y-1" start={start}>{children}</ol>,
    li: ({ children }) => (
      <li className={`${sp.gap} ${cAlign}`}
          style={{ color: template.textColor, fontSize: fSize.base, lineHeight: sp.lineHeight }}>
        {children}
      </li>
    ),
    strong: ({ children }) => (
      <strong style={{ color: template.boldColor, fontWeight: 700 }}>{children}</strong>
    ),
    em: ({ children }) => <em style={{ color: template.textColor }}>{children}</em>,
    mark: ({ children }: any) => (
      <mark style={{ backgroundColor: template.highlightBg, borderRadius: '3px', padding: '0 3px', color: template.highlightText }}>
        {children}
      </mark>
    ),
    code: ({ children, className }: any) => {
      const isBlock = className?.includes('language-');
      // 飞书风格：浅色模版用 #1F2329，深色模版用 rgba(255,255,255,0.65)
      const codeTextColor = isDarkTemplate ? 'rgba(255,255,255,0.65)' : '#1F2329';
      if (isBlock) {
        return (
          <code style={{
            display: 'block',
            color: codeTextColor,
            fontSize: '0.85em',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            lineHeight: 1.6,
          }}>
            {children}
          </code>
        );
      }
      return (
        <code style={{ color: codeTextColor, fontSize: '0.9em' }}>{children}</code>
      );
    },
    pre: ({ children }: any) => (
      // 飞书风格：浅色模版 #F0F1F3，深色模版 rgba(255,255,255,0.08)
      <pre style={{
        backgroundColor: isDarkTemplate ? 'rgba(255,255,255,0.08)' : '#F0F1F3',
        borderRadius: '6px',
        padding: '8px 10px',
        marginBottom: '0.5em',
        overflowX: 'hidden',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {children}
      </pre>
    ),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [templateId, spacing, font, titleAlign, fontSize, contentAlign]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const renderContent = () => {
    if (!content) {
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-center text-sm">
            开始在左侧编辑器输入内容<br />实时预览将在此显示
          </p>
        </div>
      );
    }

    // Text mode: render as plain text — no Markdown parsing, no tag leakage
    if (isPlainText) {
      return (
        <div className={`${cAlign}`} style={{ color: template.textColor, fontSize: fSize.base, lineHeight: sp.lineHeight }}>
          {content.split('\n').map((line, i) => (
            line.trim()
              ? <p key={i} style={{ marginBottom: '0.4em' }}>{line}</p>
              : <br key={i} />
          ))}
        </div>
      );
    }

    // Markdown mode: ReactMarkdown with ErrorBoundary fallback (zero-loss guarantee)
    return (
      <MarkdownErrorBoundary rawText={content}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={mdComponents}
        >
          {preprocessHighlight(content)}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    );
  };

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Export Button */}
      {isHovered && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            size="sm"
            className="gap-2 bg-white hover:bg-gray-50 text-gray-900 shadow-lg border"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="w-4 h-4" />
            {isExporting ? '导出中...' : '导出'}
          </Button>
        </div>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        className={`relative w-full ${template.background} rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.05)] border overflow-hidden`}
        style={{ aspectRatio: '3/4' }}
      >
        {/* Accent Border */}
        {template.borderPosition === 'left' && (
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: template.accentColor }} />
        )}
        {template.borderPosition === 'top' && (
          <div className="absolute left-0 right-0 top-0 h-0.5" style={{ backgroundColor: template.accentColor }} />
        )}

        {/* Content — overflow:visible so pagination clipping is the only boundary */}
        <div className={`${sp.padding} h-full flex flex-col`}>
          <div className="flex-1 overflow-visible" style={{ fontFamily }}>
            {renderContent()}
          </div>

          {/* Page Badge — hidden when card is empty */}
          {content && (
            <div className="flex justify-center mt-4 flex-shrink-0">
              <div className="text-xs font-medium" style={{ color: template.accentColor }}>
                Page {pageNumber}/{totalPages}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

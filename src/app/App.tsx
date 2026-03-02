import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Sparkles } from 'lucide-react';
import JSZip from 'jszip';
import { Editor } from './components/Editor';
import { CardPreview, CardPreviewRef } from './components/CardPreview';
import { TemplateGallery, templates } from './components/TemplateGallery';
import { StyleSettings } from './components/StyleSettings';
import { Button } from './components/ui/button';
import { paginateContent } from './utils/paginate';

export default function App() {
  const [markdownContent, setMarkdownContent] = useState(`# 欢迎使用图片生成器

这是一个不需大🧠的 Markdown 相框生成工具，让你的想法轻松化身为可公开分享的卡片。

## 详细说明

**封面图**：从第一个 **标题** 到第一个 **---** 之前的内容作为封面图片。

您可以灵活组合页面版式：

- 纯黑文字
- 作者署名
- 作者署名/日期
- ==高亮文字== 效果

---

## 主要特性

**Markdown 渲染** 支持完整的 Markdown 语法，标题、列表、加粗一应俱全。

**智能分页** 内容超出单张卡片时，==自动分页==，无需手动插入 ---。

主要功能：

- 支持 Markdown 语法
- 支持 ==文字高亮==
- 智能自动分页
- 一键导出 PNG / ZIP

---`);
  const [textContent, setTextContent] = useState('');
  // AI-processed version for text mode preview only — editor stays untouched
  const [textPreviewContent, setTextPreviewContent] = useState('');

  // format is lifted here so CardPreview can know whether to render plain text
  const [format,       setFormat]       = useState<'markdown' | 'text'>('markdown');

  const content = format === 'markdown' ? markdownContent : textContent;
  const setContent = (val: string) => {
    if (format === 'markdown') {
      setMarkdownContent(val);
    } else {
      setTextContent(val);
      setTextPreviewContent(''); // user edited — discard AI preview
    }
  };

  // What the preview actually renders (may differ from editor in text mode)
  const previewContent = format === 'text' && textPreviewContent ? textPreviewContent : content;
  const isPreviewPlainText = format === 'text' && !textPreviewContent;
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].id);
  const [spacing,      setSpacing]      = useState<'1.0' | '1.15' | '1.5' | '2.0'>('1.15');
  const [font,         setFont]         = useState<'inter' | 'yahei' | 'noto-sans' | 'noto-serif' | 'serif'>('inter');
  const [titleAlign,   setTitleAlign]   = useState<'left' | 'center' | 'right'>('left');
  const [fontSize,     setFontSize]     = useState<'12' | '14' | '16' | '18'>('14');
  const [contentAlign, setContentAlign] = useState<'left' | 'center' | 'right'>('left');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Measure preview area width for smart pagination
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);

  useEffect(() => {
    const el = previewAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const containerW = entry.contentRect.width;
      const computed = Math.min(containerW - 64, 448);
      setCardWidth(Math.max(computed, 100));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Smart paginated pages — real DOM measurement via useMemo
  const pages = useMemo(
    () => paginateContent(previewContent, cardWidth, spacing, fontSize, font, format === 'markdown', isPreviewPlainText),
    [previewContent, cardWidth, spacing, fontSize, font, format, isPreviewPlainText],
  );
  const totalPages = pages.length;

  const cardRefs = useRef<(CardPreviewRef | null)[]>([]);

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < pages.length; i++) {
        const cardRef = cardRefs.current[i];
        if (cardRef) {
          const dataUrl = await cardRef.exportImage();
          const base64 = dataUrl.split(',')[1];
          zip.file(`card-${i + 1}.png`, base64, { base64: true });
        }
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.download = 'cards.zip';
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 flex items-center justify-center flex-shrink-0">
        <div className="max-w-[1600px] w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Cardify</h1>
              <p className="text-xs text-gray-500">AI 文字转卡片生成器</p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
            onClick={handleDownloadAll}
            disabled={isDownloadingAll}
          >
            <Download className="w-4 h-4" />
            {isDownloadingAll ? '打包中...' : '全部下载'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden justify-center min-h-0">
        <div className="max-w-[1600px] w-full flex overflow-hidden">

          {/* Left – Template Gallery */}
          <div className="w-48 border-r flex-shrink-0 bg-white overflow-y-auto">
            <TemplateGallery
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
            />
          </div>

          {/* Middle – Editor */}
          <div className="flex-[1.8] bg-white border-r overflow-hidden flex flex-col min-w-0">
            <Editor
              content={content}
              onContentChange={setContent}
              onPreviewContentChange={setTextPreviewContent}
              format={format}
              onFormatChange={setFormat}
            />
          </div>

          {/* Right – Preview */}
          <div ref={previewAreaRef} className="flex-1 bg-gray-50 overflow-y-auto min-w-0">
            <div className="p-8">
              <div className="max-w-md mx-auto space-y-8">
                {pages.map((pageContent, index) => (
                  <div
                    key={index}
                    className="transform transition-all hover:scale-[1.02]"
                  >
                    <CardPreview
                      ref={(el) => { cardRefs.current[index] = el; }}
                      content={pageContent}
                      templateId={selectedTemplate}
                      pageNumber={index + 1}
                      totalPages={totalPages}
                      spacing={spacing}
                      font={font}
                      titleAlign={titleAlign}
                      fontSize={fontSize}
                      contentAlign={contentAlign}
                      isPlainText={isPreviewPlainText}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Far Right – Style Settings */}
          <StyleSettings
            spacing={spacing}
            font={font}
            titleAlign={titleAlign}
            fontSize={fontSize}
            contentAlign={contentAlign}
            onSpacingChange={setSpacing}
            onFontChange={setFont}
            onTitleAlignChange={setTitleAlign}
            onFontSizeChange={setFontSize}
            onContentAlignChange={setContentAlign}
          />
        </div>
      </div>
    </div>
  );
}

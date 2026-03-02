import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface StyleSettingsProps {
  spacing: '1.0' | '1.15' | '1.5' | '2.0';
  font: 'inter' | 'yahei' | 'noto-sans' | 'noto-serif' | 'serif';
  titleAlign: 'left' | 'center' | 'right';
  fontSize: '12' | '14' | '16' | '18';
  contentAlign: 'left' | 'center' | 'right';
  onSpacingChange: (value: '1.0' | '1.15' | '1.5' | '2.0') => void;
  onFontChange: (value: 'inter' | 'yahei' | 'noto-sans' | 'noto-serif' | 'serif') => void;
  onTitleAlignChange: (value: 'left' | 'center' | 'right') => void;
  onFontSizeChange: (value: '12' | '14' | '16' | '18') => void;
  onContentAlignChange: (value: 'left' | 'center' | 'right') => void;
}

export function StyleSettings({
  spacing,
  font,
  titleAlign,
  fontSize,
  contentAlign,
  onSpacingChange,
  onFontChange,
  onTitleAlignChange,
  onFontSizeChange,
  onContentAlignChange,
}: StyleSettingsProps) {
  return (
    <div className="w-64 border-l bg-white overflow-y-auto flex-shrink-0">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-6">设置样式</h3>
        
        {/* Spacing */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">行距</label>
          <Select value={spacing} onValueChange={onSpacingChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.0">单倍行距 (1.0)</SelectItem>
              <SelectItem value="1.15">1.15（默认）</SelectItem>
              <SelectItem value="1.5">1.5 倍行距</SelectItem>
              <SelectItem value="2.0">双倍行距 (2.0)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Font */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">字体</label>
          <Select value={font} onValueChange={onFontChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inter">Inter</SelectItem>
              <SelectItem value="yahei">微软雅黑</SelectItem>
              <SelectItem value="noto-sans">思源黑体</SelectItem>
              <SelectItem value="noto-serif">思源宋体</SelectItem>
              <SelectItem value="serif">Georgia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Title Alignment */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">标题对齐</label>
          <Select value={titleAlign} onValueChange={onTitleAlignChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">居左</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="right">居右</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Font Size */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">字体大小</label>
          <Select value={fontSize} onValueChange={onFontSizeChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12</SelectItem>
              <SelectItem value="14">14（默认）</SelectItem>
              <SelectItem value="16">16</SelectItem>
              <SelectItem value="18">18</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Alignment */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mb-2 block">内容对齐</label>
          <Select value={contentAlign} onValueChange={onContentAlignChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">居左</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="right">居右</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
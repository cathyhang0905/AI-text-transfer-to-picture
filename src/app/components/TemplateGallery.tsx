import { Check } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  background: string;
  textColor: string;
  titleColor: string;
  boldColor: string;
  accentColor: string;
  highlightBg: string;
  highlightText: string;
  preview: string;
  borderPosition?: 'left' | 'top' | 'none';
}

const templates: Template[] = [
  {
    id: 'blue-classic',
    name: '蓝色经典',
    background: 'bg-white',
    textColor: '#374151',
    titleColor: '#002FA7',
    boldColor: '#002FA7',
    accentColor: '#002FA7',
    highlightBg: '#DBEAFE',   // 蓝-100：浅蓝底
    highlightText: '#1E40AF', // 蓝-800：深蓝字
    borderPosition: 'left',
    preview: 'linear-gradient(to right, #002FA7 4px, #ffffff 4px)',
  },
  {
    id: 'monochrome-blue',
    name: '卡布里白粉',
    background: 'bg-[#fff2df]',
    textColor: '#1f2937',
    titleColor: '#015697',
    boldColor: '#374151',
    accentColor: '#015697',
    highlightBg: '#FDE68A',   // 琥珀-200：温暖黄底，搭配奶油背景
    highlightText: '#92400E', // 琥珀-800：深棕字
    borderPosition: 'left',
    preview: 'linear-gradient(to right, #015697 4px, #fff2df 4px)',
  },
  {
    id: 'elegant-gray',
    name: '雅致灰调',
    background: 'bg-[#E9F1F6]',
    textColor: '#1f2937',
    titleColor: '#15559A',
    boldColor: '#15559A',
    accentColor: '#15559A',
    highlightBg: '#BFDBFE',   // 蓝-200：比蓝经典稍深，适配蓝灰背景
    highlightText: '#1E3A8A', // 蓝-900：深蓝字
    borderPosition: 'top',
    preview: 'linear-gradient(to bottom, #15559A 2px, #E9F1F6 2px)',
  },
  {
    id: 'sage-green',
    name: '雾霭青绿',
    background: 'bg-[#FFFFF0]',
    textColor: '#6b7280',
    titleColor: '#1A6840',
    boldColor: '#1A6840',
    accentColor: '#1A6840',
    highlightBg: '#BBF7D0',   // 绿-200：薄荷绿底
    highlightText: '#14532D', // 绿-900：深绿字
    borderPosition: 'left',
    preview: 'linear-gradient(to right, #1A6840 4px, #FFFFF0 4px)',
  },
  {
    id: 'capri-night',
    name: '静谧海域',
    background: 'bg-[#013E75]',
    textColor: '#fffbf0',
    titleColor: '#ff9999',
    boldColor: '#ff9999',
    accentColor: '#ff9999',
    highlightBg: '#A5F3FC',   // 浅青色，呼应海洋主题，深蓝背景上清爽醒目
    highlightText: '#0E7490', // 青色-700，深色字保证可读性
    borderPosition: 'left',
    preview: 'linear-gradient(to right, #ff9999 4px, #013E75 4px)',
  },
];

interface TemplateGalleryProps {
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateGallery({ selectedTemplate, onSelectTemplate }: TemplateGalleryProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-6">选择模版</h3>
        <div className="space-y-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template.id)}
              className="w-full group relative"
            >
              <div
                className="w-full h-32 rounded-lg border-2 transition-all"
                style={{
                  background: template.preview,
                  borderColor: selectedTemplate === template.id ? '#8b5cf6' : '#e5e7eb',
                }}
              >
                {selectedTemplate === template.id && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs mt-2 text-center text-gray-600">{template.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { templates };
export type { Template };
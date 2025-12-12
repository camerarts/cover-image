import React, { useState } from 'react';
import { OptimizationResult } from '../types';
import { Loader2, Download, Copy, CheckCircle2, XCircle, ZoomIn, X, Image as ImageIcon, Sparkles, Cpu } from 'lucide-react';

// Shared Helper for Status Icon
const StatusIcon = ({ status, hasResult }: { status: string, hasResult: boolean }) => {
  if (status === 'analyzing' && !hasResult) {
     return <Loader2 className="w-4 h-4 animate-spin text-purple-400" />;
  }
  if (hasResult) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  }
  if (status === 'error' && !hasResult) {
      return <XCircle className="w-4 h-4 text-red-500" />;
  }
  return <div className="w-4 h-4 rounded-full border border-slate-600" />;
};

// 1. Analysis Section
export const AnalysisSection: React.FC<{ 
  status: string; 
  result: OptimizationResult | null; 
  modelName?: string;
}> = ({ status, result, modelName = "Gemini 2.5 Flash" }) => {
  return (
    <div className={`bg-slate-800/50 rounded-xl p-4 border transition-colors duration-500 ${result ? 'border-purple-500/30' : 'border-slate-700/50'}`}>
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider">AI 分析 & 策略</h3>
                <StatusIcon status={status} hasResult={!!result} />
            </div>
            {result && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                    <Cpu className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-mono text-slate-400">{modelName}</span>
                </div>
            )}
        </div>
        {result ? (
            <p className="text-slate-300 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                {result.analysis}
            </p>
        ) : (
            status === 'analyzing' ? 
            <div className="space-y-2">
                <div className="h-4 bg-slate-700/50 rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-slate-700/50 rounded w-1/2 animate-pulse" />
            </div> :
            <div className="text-slate-600 text-sm italic">等待生成策略...</div>
        )}
    </div>
  );
};

// 2. Prompt Section
export const PromptSection: React.FC<{
  status: string;
  result: OptimizationResult | null;
  modelName?: string;
}> = ({ status, result, modelName = "Gemini 2.5 Flash" }) => {
   const [modalContent, setModalContent] = useState<{ title: string; text: string } | null>(null);

   const PromptBox = ({ title, text, colorClass, borderColor }: { title: string; text: string; colorClass: string; borderColor: string }) => (
    <div className={`relative bg-slate-900/50 rounded-xl border ${borderColor} p-3 group flex flex-col h-40 transition-all hover:bg-slate-900`}>
        <div className="flex items-center justify-between mb-2 shrink-0">
             <h4 className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{title}</h4>
             <button 
                onClick={() => setModalContent({ title, text })}
                className="text-slate-500 hover:text-white transition-colors p-1"
                title="放大查看"
            >
                <ZoomIn className="w-4 h-4" />
            </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
             <p className="text-slate-400 text-xs font-mono leading-relaxed break-words whitespace-pre-wrap line-clamp-5">
                {text}
            </p>
        </div>
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
                onClick={() => navigator.clipboard.writeText(text)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-md shadow-sm transition-colors"
                title="复制文本"
            >
                <Copy className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
  );

  return (
    <>
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">Prompt (绘图提示词)</h3>
                    <StatusIcon status={status} hasResult={!!result} />
                </div>
                 {result && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                        <Cpu className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-mono text-slate-400">{modelName}</span>
                    </div>
                )}
            </div>
            
            {result ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-3">
                    <PromptBox 
                        title="Prompt (English)" 
                        text={result.finalPrompt} 
                        colorClass="text-emerald-400"
                        borderColor="border-emerald-500/30"
                    />
                    <PromptBox 
                        title="中文提示词" 
                        text={result.chinesePrompt || "（未生成中文提示词）"} 
                        colorClass="text-blue-400"
                        borderColor="border-blue-500/30"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                        <div className={`h-40 bg-slate-800/30 rounded-xl border border-slate-700/30 flex items-center justify-center ${status === 'analyzing' ? 'animate-pulse' : ''}`}>
                            <span className="text-slate-600 text-xs">Waiting...</span>
                        </div>
                        <div className={`h-40 bg-slate-800/30 rounded-xl border border-slate-700/30 flex items-center justify-center ${status === 'analyzing' ? 'animate-pulse' : ''}`}>
                             <span className="text-slate-600 text-xs">Waiting...</span>
                        </div>
                </div>
            )}
        </div>

        {/* Modal */}
        {modalContent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-800">
                        <h3 className="font-bold text-white">{modalContent.title}</h3>
                        <button 
                            onClick={() => setModalContent(null)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        <p className="text-slate-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                            {modalContent.text}
                        </p>
                    </div>
                    <div className="p-4 border-t border-slate-800 flex justify-end">
                        <button 
                            onClick={() => navigator.clipboard.writeText(modalContent.text)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors font-medium"
                        >
                            <Copy className="w-4 h-4" /> 复制全部内容
                        </button>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

// 3. Image Preview Section
export const ImagePreviewSection: React.FC<{
    status: string;
    generatedImage: string | null;
    modelName?: string;
}> = ({ status, generatedImage, modelName = "Gemini 3 Pro Image" }) => {
    return (
        <div className="space-y-2">
             <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">封面图预览</h3>
                    {status === 'generating_image' && <Loader2 className="w-4 h-4 animate-spin text-teal-400" />}
                    {status === 'complete' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {status === 'error' && generatedImage === null && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                 {generatedImage && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700">
                        <Cpu className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-mono text-slate-400">{modelName}</span>
                    </div>
                )}
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl group">
                {generatedImage ? (
                <>
                    <img src={generatedImage} alt="Generated Cover" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                    <a 
                        href={generatedImage} 
                        download="viral-cover.png"
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors"
                    >
                        <Download className="w-4 h-4" /> 下载原图
                    </a>
                    </div>
                </>
                ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-900/50 border border-slate-800/50">
                    {status === 'generating_image' ? (
                        <>
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin mb-4" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-emerald-500/50" />
                                </div>
                            </div>
                            <p className="text-white font-medium animate-pulse">
                                正在绘制高清封面...
                            </p>
                            <p className="text-xs text-slate-500 mt-2">AI 绘图可能需要几秒钟</p>
                        </>
                    ) : (
                        <div className="text-slate-600 flex flex-col items-center">
                            <ImageIcon className="w-10 h-10 mb-3 opacity-20" />
                            <p>等待生成图片</p>
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    )
}

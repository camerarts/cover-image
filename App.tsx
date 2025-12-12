import React, { useState } from 'react';
import { CoverFormData, OptimizationResult } from './types';
import { DROPDOWN_OPTIONS, INITIAL_FORM_STATE, SPECIFIC_PERSON_IMAGE_URL } from './constants';
import { SelectInput, TextInput, FileInput } from './components/UIComponents';
import { AnalysisSection, PromptSection, ImagePreviewSection } from './components/ResultCard';
import { optimizePrompt, generateCoverImage, fileToGenerativePart, ImagePart } from './services/geminiService';
import { Sparkles, Image as ImageIcon, LayoutTemplate, Loader2, User, BadgeCheck, Aperture } from 'lucide-react';

// Local BentoCard Component for layout consistency
const BentoCard = ({ children, className = "", title, icon: Icon, gradient }: { children: React.ReactNode, className?: string, title?: string, icon?: any, gradient?: string }) => (
    <div className={`bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl ring-1 ring-white/5 flex flex-col ${className}`}>
        {title && (
            <div className={`flex items-center gap-3 mb-6 p-3 rounded-xl bg-gradient-to-r ${gradient || 'from-slate-800 to-transparent'} border-l-4 border-white/20`}>
                {Icon && <Icon className="w-5 h-5 text-white/80" />}
                <h2 className="text-lg font-bold tracking-wide text-white drop-shadow-md">
                    {title}
                </h2>
            </div>
        )}
        <div className="flex-1">
            {children}
        </div>
    </div>
);

const App: React.FC = () => {
  const [formData, setFormData] = useState<CoverFormData>(INITIAL_FORM_STATE);
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'prompt_success' | 'generating_image' | 'complete' | 'error'>('idle');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaste = async (fieldName: keyof CoverFormData) => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            setFormData(prev => ({ ...prev, [fieldName]: text }));
        }
    } catch (err) {
        console.error('Failed to read clipboard', err);
    }
  };

  const validateForm = (): boolean => {
    setErrorMsg(null);

    if (formData.personSource === '1' && !personImage) {
        setErrorMsg("请完成 [Q5]：您选择了使用上传照片，请上传一张真人照片。");
        return false;
    }
    if (formData.logoType === '2' && !logoImage) {
        setErrorMsg("请完成 [Q10-2]：您选择了图片 Logo，请上传 Logo 文件。");
        return false;
    }
    return true;
  };

  // Step 1: Generate Prompt & Strategy
  const handleGenerateStrategy = async () => {
    if (!validateForm()) return;

    setStatus('analyzing');
    setOptimizationResult(null);
    setGeneratedImage(null);

    try {
      const result = await optimizePrompt(formData);
      setOptimizationResult(result);
      setStatus('prompt_success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : "策略生成失败");
    }
  };

  // Step 2: Generate Image
  const handleGenerateImage = async () => {
    if (!optimizationResult) return;

    setStatus('generating_image');
    setErrorMsg(null);
    
    try {
      let personPart: ImagePart | null = null;
      let logoPart: ImagePart | null = null;

      // Handle Person Image Source
      if (formData.personSource === '1' && personImage) {
        const base64Data = await fileToGenerativePart(personImage);
        personPart = { mimeType: personImage.type, data: base64Data };
      } else if (formData.personSource === '3') {
        try {
            const response = await fetch(SPECIFIC_PERSON_IMAGE_URL);
            if (!response.ok) throw new Error("Failed to load preset person image");
            const blob = await response.blob();
            const base64Data = await fileToGenerativePart(blob);
            personPart = { mimeType: blob.type, data: base64Data };
        } catch (fetchErr) {
            console.error(fetchErr);
            throw new Error("无法加载预设人物图片，请检查网络");
        }
      }

      if (formData.logoType === '2' && logoImage) {
        const base64Data = await fileToGenerativePart(logoImage);
        logoPart = { mimeType: logoImage.type, data: base64Data };
      }

      const imageUrl = await generateCoverImage(optimizationResult.finalPrompt, personPart, logoPart);
      setGeneratedImage(imageUrl);
      setStatus('complete');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : "图片生成失败");
    }
  };

  const isProcessing = status === 'analyzing' || status === 'generating_image';

  return (
    <div className="min-h-screen bg-slate-950 relative text-slate-200 p-4 md:p-6 lg:p-10 overflow-x-hidden font-sans selection:bg-purple-500/30">
      
      {/* High-end Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 brightness-150 contrast-150"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-[1600px] mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4 group">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-600 blur-lg opacity-40 group-hover:opacity-80 transition-opacity rounded-full"></div>
                <div className="relative w-10 h-10 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Aperture className="text-white w-6 h-6" />
                </div>
            </div>
            <div>
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight font-[Inter]">
                    ViralCover <span className="text-purple-400">AI</span>
                </h1>
            </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        
        {/* Left Column: Input Grid (Bento Style) */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
            
            {/* 1. Content (Wide) */}
            <BentoCard 
                title="核心文案" 
                icon={LayoutTemplate} 
                className="md:col-span-2"
                gradient="from-purple-500/20 to-transparent"
            >
                <div className="space-y-6">
                    <TextInput 
                        id="mainTitle" name="mainTitle" label="Q1. 主标题 (必填)" placeholder="输入封面主标题"
                        value={formData.mainTitle} onChange={handleInputChange} 
                        onPasteClick={() => handlePaste('mainTitle')}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <TextInput 
                            id="subTitle" name="subTitle" label="Q2. 副标题" placeholder="输入副标题 (可选)"
                            value={formData.subTitle} onChange={handleInputChange} 
                            onPasteClick={() => handlePaste('subTitle')}
                        />
                         <SelectInput 
                            id="promiseLevel" name="promiseLevel" label="Q3. 副标题承诺力度"
                            options={DROPDOWN_OPTIONS.promiseLevel}
                            value={formData.promiseLevel} onChange={handleInputChange}
                        />
                    </div>
                </div>
            </BentoCard>

            {/* 2. Visual (Square-ish) */}
             <BentoCard 
                title="视觉与构图" 
                icon={ImageIcon} 
                gradient="from-blue-500/20 to-transparent"
             >
                 <div className="space-y-4">
                     <SelectInput 
                        id="coverType" name="coverType" label="Q4. 封面比例"
                        options={DROPDOWN_OPTIONS.coverType}
                        value={formData.coverType} onChange={handleInputChange}
                    />
                    <SelectInput 
                        id="colorStyle" name="colorStyle" label="Q8. 色彩风格"
                        options={DROPDOWN_OPTIONS.colorStyle}
                        value={formData.colorStyle} onChange={handleInputChange}
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <SelectInput 
                            id="backgroundElement" name="backgroundElement" label="Q9. 背景"
                            options={DROPDOWN_OPTIONS.backgroundElement}
                            value={formData.backgroundElement} onChange={handleInputChange}
                        />
                        <SelectInput 
                            id="textLayout" name="textLayout" label="Q11. 排版"
                            options={DROPDOWN_OPTIONS.textLayout}
                            value={formData.textLayout} onChange={handleInputChange}
                        />
                    </div>
                 </div>
             </BentoCard>

            {/* 3. Person (Square-ish) */}
             <BentoCard 
                title="人物主体" 
                icon={User} 
                gradient="from-emerald-500/20 to-transparent"
             >
                <div className="space-y-4">
                     <div className="grid grid-cols-3 gap-2">
                        <SelectInput 
                            id="personSource" name="personSource" label="Q5. 来源"
                            options={DROPDOWN_OPTIONS.personSource}
                            value={formData.personSource} onChange={handleInputChange}
                        />
                         <SelectInput 
                            id="personPosition" name="personPosition" label="Q6. 位置"
                            options={DROPDOWN_OPTIONS.personPosition}
                            value={formData.personPosition} onChange={handleInputChange}
                        />
                         <SelectInput 
                            id="expressionStrength" name="expressionStrength" label="Q7. 表情"
                            options={DROPDOWN_OPTIONS.expressionStrength}
                            value={formData.expressionStrength} onChange={handleInputChange}
                        />
                    </div>
                    
                    {formData.personSource === '1' && (
                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                            <FileInput 
                                label="上传真人照片" 
                                selectedFile={personImage} 
                                onChange={setPersonImage} 
                            />
                        </div>
                    )}
                    {formData.personSource === '3' && (
                         <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                             <img src={SPECIFIC_PERSON_IMAGE_URL} alt="Preset" className="w-10 h-10 rounded-md object-cover" />
                             <span className="text-xs text-slate-400">已选用预设模特</span>
                         </div>
                    )}
                </div>
             </BentoCard>

            {/* 4. Brand (Wide) */}
            <BentoCard 
                title="品牌元素 & 其他" 
                icon={BadgeCheck} 
                className="md:col-span-2"
                gradient="from-orange-500/20 to-transparent"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <TextInput 
                            id="brandName" name="brandName" label="Q10-1. 品牌文本"
                            value={formData.brandName} onChange={handleInputChange}
                            onPasteClick={() => handlePaste('brandName')}
                        />
                         <SelectInput 
                            id="logoType" name="logoType" label="Q10-2. Logo 类型"
                            options={DROPDOWN_OPTIONS.logoType}
                            value={formData.logoType} onChange={handleInputChange}
                        />
                        <SelectInput 
                            id="brandIntensity" name="brandIntensity" label="Q10-3. 露出强度"
                            options={DROPDOWN_OPTIONS.brandIntensity}
                            value={formData.brandIntensity} onChange={handleInputChange}
                        />
                    </div>
                     {formData.logoType === '2' && (
                        <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/30">
                            <FileInput 
                                label="上传 Logo 图片" 
                                selectedFile={logoImage} 
                                onChange={setLogoImage} 
                            />
                        </div>
                    )}
                    <TextInput 
                        id="specialRequirements" name="specialRequirements" label="Q12. 特殊要求 (可选)" placeholder="例如: 必须有猫..."
                        value={formData.specialRequirements} onChange={handleInputChange} 
                        onPasteClick={() => handlePaste('specialRequirements')}
                    />
                </div>
            </BentoCard>

        </div>

        {/* Right Column: Sticky Output (Stacked Bento) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="lg:sticky lg:top-8 space-y-6">
                
                {/* 1. Results Card */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl ring-1 ring-white/5 flex flex-col gap-6">
                    
                    <AnalysisSection status={status} result={optimizationResult} modelName="Gemini 2.5 Flash" />
                    
                    <div className="h-px bg-white/5" />
                    
                    <PromptSection status={status} result={optimizationResult} modelName="Gemini 2.5 Flash" />
                    
                    <button
                        onClick={handleGenerateStrategy}
                        disabled={isProcessing}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 border
                            ${isProcessing 
                                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                                : 'bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border-purple-500/30 text-white'
                            }
                        `}
                    >
                        {status === 'analyzing' ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                正在分析...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" /> 1. 生成策略
                            </>
                        )}
                    </button>

                     {status === 'error' && !optimizationResult && errorMsg && (
                         <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-xs text-center">
                            {errorMsg}
                         </div>
                     )}
                </div>

                {/* 2. Preview Card */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl ring-1 ring-white/5 flex flex-col gap-6">
                    <ImagePreviewSection status={status} generatedImage={generatedImage} modelName="Gemini 3 Pro Image" />

                    <button
                        onClick={handleGenerateImage}
                        disabled={status === 'generating_image' || !optimizationResult}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-900/20 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 border
                            ${status === 'generating_image' || !optimizationResult
                                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                                : 'bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-emerald-500/30 text-white'
                            }
                        `}
                    >
                        {status === 'generating_image' ? (
                            <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    绘图中...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="w-5 h-5" /> 2. 生成图片
                            </>
                        )}
                    </button>

                     {status === 'error' && optimizationResult && errorMsg && (
                         <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-xs text-center">
                            {errorMsg}
                         </div>
                     )}
                </div>

            </div>
        </div>

      </main>

    </div>
  );
};

export default App;

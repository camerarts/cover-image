import React, { useState } from 'react';
import { CoverFormData, OptimizationResult } from './types';
import { DROPDOWN_OPTIONS, INITIAL_FORM_STATE, SPECIFIC_PERSON_IMAGE_URL } from './constants';
import { SelectInput, TextInput, FileInput } from './components/UIComponents';
import { AnalysisSection, PromptSection, ImagePreviewSection } from './components/ResultCard';
import { optimizePrompt, generateCoverImage, fileToGenerativePart, ImagePart } from './services/geminiService';
import { Sparkles, Image as ImageIcon, LayoutTemplate, Loader2, User, BadgeCheck, Aperture, Settings, LogIn, LogOut, X, Lock, Key, Code2, Copy } from 'lucide-react';

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

// Helper to translate errors to Chinese
const translateError = (err: any): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API Key is missing")) return "API Key 缺失，请先登录或在设置中配置自定义 Key。";
    if (msg.includes("403") || msg.includes("permission denied")) return "API Key 权限不足或无效 (403)，请检查您的 Key。";
    if (msg.includes("429")) return "请求过于频繁，触发限流，请稍后再试 (429)。";
    if (msg.includes("500") || msg.includes("503")) return "AI 服务暂时不可用，请稍后重试 (5xx)。";
    if (msg.includes("fetch failed") || msg.includes("NetworkError") || msg.includes("Load failed")) return "网络连接失败，请检查您的网络设置 (需可访问 Google API)。";
    if (msg.includes("SAFETY")) return "生成内容触犯安全策略被拦截，请调整提示词或输入内容。";
    if (msg.includes("candidate")) return "模型未能生成有效内容，请重试。";
    return `生成出错: ${msg}`; 
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<CoverFormData>(INITIAL_FORM_STATE);
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'prompt_success' | 'generating_image' | 'complete' | 'error'>('idle');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth & Settings State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');

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

  // Auth Logic
  const handleLogin = () => {
    if (passwordInput === process.env.PASSWORD) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setPasswordInput('');
    } else {
        alert("密码错误");
    }
  };

  const handleLogout = () => {
      setIsLoggedIn(false);
  };

  // Helper to determine which key to use
  const getEffectiveApiKey = () => {
      if (customApiKey.trim()) return customApiKey;
      if (isLoggedIn) return undefined; // Undefined means let the service use process.env.API_KEY
      return null; // Null means no valid key available
  };

  // Step 1: Generate Prompt & Strategy
  const handleGenerateStrategy = async () => {
    if (!validateForm()) return;
    
    const effectiveKey = getEffectiveApiKey();
    if (effectiveKey === null) {
        setErrorMsg("请先登录或在设置中输入自定义 API Key");
        setStatus('error');
        return;
    }

    setStatus('analyzing');
    setOptimizationResult(null);
    setGeneratedImage(null);

    try {
      // If effectiveKey is undefined (logged in), the service will use env key.
      const result = await optimizePrompt(formData, effectiveKey);
      setOptimizationResult(result);
      setStatus('prompt_success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(translateError(err));
    }
  };

  // Step 2: Generate Image
  const handleGenerateImage = async () => {
    if (!optimizationResult) return;

    const effectiveKey = getEffectiveApiKey();
    if (effectiveKey === null) {
        setErrorMsg("请先登录或在设置中输入自定义 API Key");
        setStatus('error');
        return;
    }

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

      const imageUrl = await generateCoverImage(optimizationResult.finalPrompt, personPart, logoPart, effectiveKey);
      setGeneratedImage(imageUrl);
      setStatus('complete');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg(translateError(err));
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
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight font-[Inter] flex items-center gap-3">
                    <span>ViralCover <span className="text-purple-400">AI</span></span>
                    <span className="hidden sm:block w-px h-6 bg-white/10 mx-1"></span>
                    <span className="hidden sm:block text-lg font-bold text-slate-400 tracking-normal">爆款视频封面生成器</span>
                </h1>
            </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
             {isLoggedIn && (
                 <button
                    onClick={() => setShowApiModal(true)}
                    className="p-2.5 rounded-full bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all backdrop-blur-sm"
                    title="API 文档"
                 >
                    <Code2 className="w-5 h-5" />
                 </button>
             )}

             <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2.5 rounded-full bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all backdrop-blur-sm"
                title="设置 API Key"
             >
                <Settings className="w-5 h-5" />
             </button>
             
             {isLoggedIn ? (
                 <button
                    onClick={handleLogout}
                    className="p-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all backdrop-blur-sm"
                    title="已登录 (点击退出)"
                 >
                    <LogOut className="w-5 h-5" />
                 </button>
             ) : (
                 <button
                    onClick={() => setShowLoginModal(true)}
                    className="p-2.5 rounded-full bg-slate-800/50 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all backdrop-blur-sm"
                    title="登录管理员"
                 >
                    <LogIn className="w-5 h-5" />
                 </button>
             )}
        </div>
      </header>

      <main className="relative z-10 max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
        
        {/* Left Column: Input Grid (Bento Style) - 50% */}
        <div className="lg:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-6 h-fit">
            
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

        {/* Right Column: Sticky Output (Stacked Bento) - 50% */}
        <div className="lg:col-span-6 flex flex-col gap-6">
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
    
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-3">
                        <Lock className="w-6 h-6 text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">管理员登录</h2>
                    <p className="text-sm text-slate-400 mt-1">输入密码以使用后台 API Key</p>
                </div>
                <div className="space-y-4">
                    <input 
                        type="password"
                        placeholder="请输入密码"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button 
                        onClick={handleLogin}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors"
                    >
                        确认登录
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center mb-6">
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 border border-slate-700">
                        <Key className="w-6 h-6 text-slate-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white">API Key 设置</h2>
                    <p className="text-sm text-slate-400 mt-1">使用您自己的 Gemini API Key (可选)</p>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-800/50 p-4 rounded-lg text-sm border border-slate-700/50 space-y-3">
                        <div>
                            <p className="text-slate-400 mb-2">模型使用说明：</p>
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="text-slate-300">1. 策略分析 & Prompt</span>
                                <span className="font-mono text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">Gemini 2.5 Flash</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-300">2. 高清绘图 (16:9)</span>
                                <span className="font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">Gemini 3 Pro Image</span>
                            </div>
                        </div>
                        <div className="h-px bg-white/5"></div>
                        <p className="text-slate-500 text-xs">如果您未登录管理员账号，则必须在此输入您自己的 Key 才能使用。该 Key 仅保存在当前会话中。</p>
                    </div>
                    <input 
                        type="password"
                        placeholder="sk-..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-slate-500 outline-none font-mono"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                    />
                    <button 
                        onClick={() => setShowSettingsModal(false)}
                        className="w-full bg-white text-slate-900 hover:bg-slate-200 font-bold py-3 rounded-lg transition-colors"
                    >
                        保存并关闭
                    </button>
                </div>
             </div>
        </div>
      )}

      {/* API Documentation Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl relative">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                            <Code2 className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">API 调用文档</h2>
                            <p className="text-sm text-slate-400">通过 HTTP 请求自动化生成封面</p>
                        </div>
                    </div>
                    <button onClick={() => setShowApiModal(false)} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300">接口地址 (Endpoint)</label>
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-emerald-400 flex items-center justify-between">
                            <span>{window.location.origin}/api/generate</span>
                            <span className="text-slate-600 text-xs px-2 py-1 bg-slate-900 rounded border border-slate-800">POST</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300">请求参数 (JSON Body)</label>
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm text-slate-300">
<pre>{`{
  "mainTitle": "你的主标题",  // 必填
  "subTitle": "你的副标题"    // 可选
}`}</pre>
                        </div>
                        <p className="text-xs text-slate-500">
                            * 注意：调用 API 时系统会自动采用「YouTube 16:9 + AI 人物 + 高点击率」的默认最佳配置。
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300">调用示例 (cURL)</label>
                        <div className="relative group bg-slate-950 border border-slate-800 rounded-lg p-4">
                            <pre className="font-mono text-xs text-blue-300 overflow-x-auto">
{`curl -X POST ${window.location.origin}/api/generate \\
-H "Content-Type: application/json" \\
-d '{
  "mainTitle": "AI 自动化教程",
  "subTitle": "一键生成视频封面"
}'`}
                            </pre>
                             <button 
                                onClick={() => navigator.clipboard.writeText(`curl -X POST ${window.location.origin}/api/generate -H "Content-Type: application/json" -d '{"mainTitle": "测试标题", "subTitle": "测试副标题"}'`)}
                                className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-300">返回结果 (Response)</label>
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-300 overflow-hidden">
<pre>{`{
  "success": true,
  "mainTitle": "AI 自动化教程",
  "imageUrl": "data:image/png;base64,iVBORw0KGgo...",
  "strategy": { ... }
}`}</pre>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
                    <button 
                        onClick={() => setShowApiModal(false)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-lg transition-colors"
                    >
                        关闭
                    </button>
                </div>
             </div>
        </div>
      )}
      
    </div>
  );
};

export default App;

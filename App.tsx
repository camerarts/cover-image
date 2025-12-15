
import React, { useState } from 'react';
import { CoverFormData, OptimizationResult } from './types';
import { DROPDOWN_OPTIONS, INITIAL_FORM_STATE, SPECIFIC_PERSON_IMAGE_URL } from './constants';
import { SelectInput, TextInput, FileInput, Label } from './components/UIComponents';
import { AnalysisSection, PromptSection, ImagePreviewSection } from './components/ResultCard';
import { optimizePrompt, generateCoverImage, fileToGenerativePart, ImagePart } from './services/geminiService';
import { Sparkles, Image as ImageIcon, LayoutTemplate, Loader2, User, BadgeCheck, Aperture, Settings, LogIn, LogOut, X, Lock, Key, Code2, Copy } from 'lucide-react';

// Local BentoCard Component for layout consistency
const BentoCard = ({ children, className = "", title, icon: Icon, gradient }: { children?: React.ReactNode, className?: string, title?: string, icon?: any, gradient?: string }) => (
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
                        <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/30 flex flex-col items-center text-center">
                            <Label>已选择: 上传照片 (Q5)</Label>
                            <FileInput 
                                label="点击上传真人照片" 
                                selectedFile={personImage}
                                onChange={setPersonImage}
                            />
                        </div>
                    )}
                </div>
             </BentoCard>

             {/* 4. Brand (Wide) */}
             <BentoCard 
                title="品牌与标识" 
                icon={BadgeCheck} 
                className="md:col-span-2"
                gradient="from-amber-500/20 to-transparent"
             >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <TextInput 
                        id="brandName" name="brandName" label="Q10. 品牌名称" placeholder="无"
                        value={formData.brandName} onChange={handleInputChange} 
                    />
                    <SelectInput 
                        id="logoType" name="logoType" label="Q10-2. Logo 类型"
                        options={DROPDOWN_OPTIONS.logoType}
                        value={formData.logoType} onChange={handleInputChange}
                    />
                     <SelectInput 
                        id="brandIntensity" name="brandIntensity" label="Q10-3. 品牌露出程度"
                        options={DROPDOWN_OPTIONS.brandIntensity}
                        value={formData.brandIntensity} onChange={handleInputChange}
                    />
                </div>
                {formData.logoType === '2' && (
                    <div className="mt-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                         <Label>上传 Logo 图片</Label>
                         <FileInput 
                            label="上传 Logo 图片" 
                            selectedFile={logoImage}
                            onChange={setLogoImage}
                        />
                    </div>
                )}
             </BentoCard>

            {/* Action Buttons */}
            <div className="md:col-span-2 flex flex-col gap-3">
                 {errorMsg && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        <X className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                 )}

                 <button
                    onClick={handleGenerateStrategy}
                    disabled={isProcessing}
                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
                 >
                    {status === 'analyzing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                    {status === 'analyzing' ? 'AI 正在深度分析策略...' : '✨ 生成爆款策略 & Prompt'}
                 </button>
                 
                 {optimizationResult && (
                     <button
                        onClick={handleGenerateImage}
                        disabled={status === 'generating_image'}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 group"
                     >
                         {status === 'generating_image' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                         {status === 'generating_image' ? '正在绘制高清封面 (约10秒)...' : '🎨 开始绘制最终封面图'}
                     </button>
                 )}
            </div>
        </div>

        {/* Right Column: Results - 50% */}
        <div className="lg:col-span-6 flex flex-col gap-6">
            <BentoCard title="AI 生成结果" icon={Sparkles} className="h-full min-h-[500px]" gradient="from-purple-600/20 to-transparent">
                 <div className="space-y-8">
                     <AnalysisSection status={status} result={optimizationResult} />
                     <PromptSection status={status} result={optimizationResult} />
                     <ImagePreviewSection status={status} generatedImage={generatedImage} />
                 </div>
            </BentoCard>
        </div>

      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5" /> API Key 设置
                    </h3>
                    <button onClick={() => setShowSettingsModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>

                <div className="space-y-4">
                     {/* Model Usage Info Block */}
                     <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">模型使用说明</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-300">1. 策略分析 & Prompt</span>
                                <span className="text-xs font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">Gemini 2.5 Flash</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-300">2. 高清绘图 (16:9)</span>
                                <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">Gemini 3 Pro Image</span>
                            </div>
                        </div>
                     </div>

                    <div>
                        <Label htmlFor="customApiKey">自定义 Google API Key (可选)</Label>
                        <div className="relative">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input 
                                id="customApiKey"
                                type="password" 
                                placeholder="sk-..." 
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            如果您有自己的 Gemini API Key，可在此填入。留空则尝试使用系统默认 Key (需登录)。
                        </p>
                    </div>

                    <button 
                        onClick={() => setShowSettingsModal(false)}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                    >
                        保存并关闭
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5" /> 管理员登录
                    </h3>
                    <button onClick={() => setShowLoginModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                </div>
                <div className="space-y-4">
                    <input 
                        type="password" 
                        placeholder="输入访问密码" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 outline-none text-center tracking-widest"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button 
                        onClick={handleLogin}
                        className="w-full py-2.5 bg-white text-black font-bold rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        验证
                    </button>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default App;

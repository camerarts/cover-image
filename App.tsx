import React, { useState, useEffect } from 'react';
import { CoverFormData, OptimizationResult } from './types';
import { DROPDOWN_OPTIONS, INITIAL_FORM_STATE, SPECIFIC_PERSON_IMAGE_URL } from './constants';
import { SelectInput, TextInput, FileInput } from './components/UIComponents';
import { AnalysisSection, PromptSection, ImagePreviewSection } from './components/ResultCard';
import { optimizePrompt, generateCoverImage, fileToGenerativePart, ImagePart } from './services/geminiService';
import { Sparkles, Image as ImageIcon, LayoutTemplate, Loader2, User, BadgeCheck, Aperture, Settings, LogIn, LogOut, Lock, KeyRound, X } from 'lucide-react';

// Get Environment Variables Safely
const getEnvVar = (key: string): string => {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
  }
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
  }
  // Try mapping VITE_ prefix as fallback
  const viteKey = `VITE_${key}`;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
      // @ts-ignore
      return import.meta.env[viteKey];
  }
   // @ts-ignore
   if (typeof process !== 'undefined' && process.env && process.env[viteKey]) {
      // @ts-ignore
      return process.env[viteKey];
  }

  return '';
};

const SYSTEM_API_KEY = getEnvVar('API_KEY');
const SYSTEM_PASSWORD = getEnvVar('PASSWORD');

const App: React.FC = () => {
  const [formData, setFormData] = useState<CoverFormData>(INITIAL_FORM_STATE);
  const [personImage, setPersonImage] = useState<File | null>(null);
  const [logoImage, setLogoImage] = useState<File | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'prompt_success' | 'generating_image' | 'complete' | 'error'>('idle');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auth & Settings State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Initial Check
  useEffect(() => {
    // Optional: Check local storage for persistent login if desired (skipping for now based on strict "password var" requirement)
    const storedCustomKey = localStorage.getItem('viral_cover_custom_key');
    if (storedCustomKey) setCustomApiKey(storedCustomKey);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === SYSTEM_PASSWORD) {
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setPasswordInput('');
        setErrorMsg(null);
    } else {
        alert("密码错误");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setStatus('idle');
    setOptimizationResult(null);
    setGeneratedImage(null);
  };

  const saveSettings = () => {
    localStorage.setItem('viral_cover_custom_key', customApiKey);
    setShowSettingsModal(false);
  };

  const getEffectiveApiKey = () => {
    if (customApiKey) return customApiKey;
    if (isLoggedIn) return SYSTEM_API_KEY;
    return '';
  };

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
    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        setErrorMsg("API Key 未配置。请点击右上角登录使用系统 Key，或在设置中输入您的自定义 Key。");
        return false;
    }

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
      const result = await optimizePrompt(formData, getEffectiveApiKey());
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

      const imageUrl = await generateCoverImage(optimizationResult.finalPrompt, personPart, logoPart, getEffectiveApiKey());
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
    <div className="min-h-screen bg-black relative text-slate-200 p-4 md:p-8 overflow-hidden font-sans selection:bg-purple-500/30">
      
      {/* High-end Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 max-w-7xl mx-auto mb-12 flex items-center justify-between border-b border-white/5 pb-6">
        <div className="flex items-center gap-4 group">
            <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-600 blur-lg opacity-50 group-hover:opacity-100 transition-opacity rounded-full"></div>
                <div className="relative w-12 h-12 bg-black border border-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                    <Aperture className="text-white w-7 h-7" />
                </div>
            </div>
            <div>
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 tracking-tight font-[Inter]">
                    ViralCover <span className="text-purple-400">AI</span>
                </h1>
                <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-1">
                    Next-Gen Visual Intelligence
                </p>
            </div>
        </div>

        {/* Auth & Settings Buttons */}
        <div className="flex items-center gap-3">
             {isLoggedIn ? (
                 <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                     <Lock className="w-3 h-3" /> 已登录 (System Key)
                 </div>
             ) : (
                customApiKey && (
                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
                        <KeyRound className="w-3 h-3" /> 使用自定义 Key
                    </div>
                )
             )}

             <button 
                onClick={() => setShowSettingsModal(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="设置 API Key"
             >
                <Settings className="w-5 h-5" />
             </button>

             {isLoggedIn ? (
                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm font-medium border border-slate-700"
                >
                    <LogOut className="w-4 h-4" /> 退出
                </button>
             ) : (
                <button 
                    onClick={() => setShowLoginModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-slate-200 rounded-lg transition-colors text-sm font-bold shadow-lg shadow-white/10"
                >
                    <LogIn className="w-4 h-4" /> 登录
                </button>
             )}
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5">
             
             <div className="space-y-10">
                {/* Section 1: Content */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-transparent border-l-4 border-purple-500">
                        <LayoutTemplate className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-extrabold tracking-wide text-white drop-shadow-md">
                            核心文案
                        </h2>
                    </div>
                    
                    <TextInput 
                        id="mainTitle" name="mainTitle" label="Q1. 主标题 (必填)" placeholder="输入封面主标题"
                        value={formData.mainTitle} onChange={handleInputChange} 
                        onPasteClick={() => handlePaste('mainTitle')}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
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

                {/* Section 2: Visual & Composition */}
                 <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border-l-4 border-blue-500">
                        <ImageIcon className="w-6 h-6 text-blue-400" />
                        <h2 className="text-xl font-extrabold tracking-wide text-white drop-shadow-md">
                            视觉与构图
                        </h2>
                    </div>

                     <div className="grid grid-cols-2 gap-4">
                        <SelectInput 
                            id="coverType" name="coverType" label="Q4. 封面比例/类型"
                            options={DROPDOWN_OPTIONS.coverType}
                            value={formData.coverType} onChange={handleInputChange}
                        />
                        <SelectInput 
                            id="colorStyle" name="colorStyle" label="Q8. 色彩风格"
                            options={DROPDOWN_OPTIONS.colorStyle}
                            value={formData.colorStyle} onChange={handleInputChange}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectInput 
                            id="backgroundElement" name="backgroundElement" label="Q9. 背景元素"
                            options={DROPDOWN_OPTIONS.backgroundElement}
                            value={formData.backgroundElement} onChange={handleInputChange}
                        />
                        <SelectInput 
                            id="textLayout" name="textLayout" label="Q11. 文字排版"
                            options={DROPDOWN_OPTIONS.textLayout}
                            value={formData.textLayout} onChange={handleInputChange}
                        />
                    </div>
                 </div>

                {/* Section 3: Person */}
                <div className="space-y-6">
                     <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border-l-4 border-emerald-500">
                        <User className="w-6 h-6 text-emerald-400" />
                        <h2 className="text-xl font-extrabold tracking-wide text-white drop-shadow-md">
                            人物主体
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <SelectInput 
                            id="personSource" name="personSource" label="Q5. 人物来源"
                            options={DROPDOWN_OPTIONS.personSource}
                            value={formData.personSource} onChange={handleInputChange}
                        />
                         <SelectInput 
                            id="personPosition" name="personPosition" label="Q6. 人物位置"
                            options={DROPDOWN_OPTIONS.personPosition}
                            value={formData.personPosition} onChange={handleInputChange}
                        />
                         <SelectInput 
                            id="expressionStrength" name="expressionStrength" label="Q7. 表情强度"
                            options={DROPDOWN_OPTIONS.expressionStrength}
                            value={formData.expressionStrength} onChange={handleInputChange}
                        />
                    </div>
                    
                    {/* Explicit Photo Upload Area */}
                    {formData.personSource === '1' && (
                        <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/30 animate-in fade-in slide-in-from-top-2">
                            <FileInput 
                                label="[Q5 补充] 上传真人照片 (必须上传)" 
                                selectedFile={personImage} 
                                onChange={setPersonImage} 
                            />
                            <p className="text-xs text-purple-300 mt-2 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> 建议: 正面或略微侧面、光线均匀的半身照
                            </p>
                        </div>
                    )}
                     {/* Preview for Preset Person */}
                    {formData.personSource === '3' && (
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 flex gap-4 items-center">
                            <img src={SPECIFIC_PERSON_IMAGE_URL} alt="Preset Model" className="w-16 h-16 rounded-lg object-cover border border-slate-600" />
                             <div>
                                <p className="text-sm text-slate-300 font-medium">已选择预设人物</p>
                                <p className="text-xs text-slate-500 mt-1">将使用系统指定的模特照片进行生成</p>
                            </div>
                        </div>
                    )}
                </div>

                 {/* Section 4: Brand */}
                 <div className="space-y-6">
                     <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border-l-4 border-orange-500">
                        <BadgeCheck className="w-6 h-6 text-orange-400" />
                        <h2 className="text-xl font-extrabold tracking-wide text-white drop-shadow-md">
                            品牌元素
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <TextInput 
                            id="brandName" name="brandName" label="Q10-1. 品牌文本" placeholder="例如: 铁锤人"
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
                    
                    {/* Explicit Logo Upload Area */}
                    {formData.logoType === '2' && (
                        <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/30 animate-in fade-in slide-in-from-top-2">
                            <FileInput 
                                label="[Q10-2 补充] 上传 Logo 图片 (必须上传)" 
                                selectedFile={logoImage} 
                                onChange={setLogoImage} 
                            />
                            <p className="text-xs text-orange-300 mt-2">
                                * 建议使用背景透明的 PNG 图片
                            </p>
                        </div>
                    )}
                 </div>

                 {/* Section 5: Extra */}
                 <div className="mt-8 pt-6 border-t border-white/10">
                    <TextInput 
                        id="specialRequirements" name="specialRequirements" label="Q12. 特殊要求 (可选)" placeholder="例如: 必须有猫，不要红色..."
                        value={formData.specialRequirements} onChange={handleInputChange} 
                        onPasteClick={() => handlePaste('specialRequirements')}
                    />
                 </div>

             </div>
          </div>
        </div>

        {/* Right Column: Preview & Action */}
        <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="sticky top-8">
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl ring-1 ring-white/5 min-h-[600px] flex flex-col gap-6">
                    
                    {/* 1. Analysis */}
                    <AnalysisSection status={status} result={optimizationResult} modelName="Gemini 2.5 Flash" />
                    
                    {/* 2. Prompt */}
                    <PromptSection status={status} result={optimizationResult} modelName="Gemini 2.5 Flash" />
                    
                    {/* 3. Button: Generate Strategy */}
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
                                正在分析策略...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" /> 1. 生成策略 & 提示词
                            </>
                        )}
                    </button>

                     {/* Error Message if Step 1 fails */}
                     {status === 'error' && !optimizationResult && errorMsg && (
                         <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm text-center backdrop-blur-md">
                            {errorMsg}
                         </div>
                     )}

                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-2" />

                    {/* 4. Image Preview */}
                    <ImagePreviewSection status={status} generatedImage={generatedImage} modelName="Gemini 3 Pro Image" />

                    {/* 5. Button: Generate Image */}
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
                                    AI 绘图中 (Gemini Pro Image)...
                            </>
                        ) : (
                            <>
                                <ImageIcon className="w-5 h-5" /> 2. 立即生成图片
                            </>
                        )}
                    </button>
                     
                     {/* Error Message if Step 2 fails */}
                     {status === 'error' && optimizationResult && errorMsg && (
                         <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm text-center backdrop-blur-md">
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
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-emerald-400" />
                        管理员登录
                    </h3>
                    <button onClick={() => setShowLoginModal(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">访问密码</label>
                        <input 
                            type="password"
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="输入密码以使用系统 API Key"
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold">
                        验证
                    </button>
                </form>
             </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-purple-400" />
                        设置 API Key
                    </h3>
                    <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-sm text-slate-300">
                        <p>如果您没有系统访问密码，可以在此输入您自己的 Google Gemini API Key。</p>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline mt-1 inline-block">
                            获取 API Key &rarr;
                        </a>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Google Gemini API Key</label>
                        <input 
                            type="password"
                            value={customApiKey}
                            onChange={(e) => setCustomApiKey(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="AIzaSy..."
                        />
                    </div>
                    <button onClick={saveSettings} className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold">
                        保存设置
                    </button>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};

export default App;

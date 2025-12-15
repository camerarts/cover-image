
import React, { useState } from 'react';
import { View, Text, Input, Picker, Button, Image, ScrollView, Block } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { DROPDOWN_OPTIONS, INITIAL_FORM_STATE } from '../../utils/constants';
import { optimizePrompt, generateCoverImage } from '../../utils/geminiService';
import './index.scss';

// --- UI Components for Mini Program ---

const SectionHeader = ({ title, icon }: { title: string, icon?: string }) => (
  <View className="bento-header" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), transparent)' }}>
    <Text style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{icon} {title}</Text>
  </View>
);

const FormInput = ({ label, value, onInput, placeholder, onPaste }: any) => (
  <View className="input-group">
    <View style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
      <Text className="label">{label}</Text>
      {onPaste && (
        <Text style={{ color: '#c084fc', fontSize: '12px', padding: '4px' }} onClick={onPaste}>粘贴</Text>
      )}
    </View>
    <Input 
      className="input-field" 
      value={value} 
      onInput={(e) => onInput(e.detail.value)}
      placeholder={placeholder}
      placeholderStyle="color: #64748b"
    />
  </View>
);

const FormPicker = ({ label, value, options, onChange }: any) => {
  const range = options.map((o: any) => o.label);
  const selectedIndex = options.findIndex((o: any) => o.value === value);
  
  return (
    <View className="input-group">
      <Text className="label">{label}</Text>
      <Picker mode="selector" range={range} value={selectedIndex} onChange={(e) => onChange(options[e.detail.value].value)}>
        <View className="input-field picker-inner">
          <Text>{options.find((o: any) => o.value === value)?.label || '请选择'}</Text>
          <Text style={{ color: '#94a3b8' }}>▼</Text>
        </View>
      </Picker>
    </View>
  );
};

// --- Main Page ---

export default function Index() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [personImageBase64, setPersonImageBase64] = useState<string | null>(null);
  const [logoImageBase64, setLogoImageBase64] = useState<string | null>(null);
  
  // States
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'prompt_success' | 'generating_image' | 'complete'>('idle');
  const [result, setResult] = useState<any>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Auth
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(Taro.getStorageSync('API_KEY') || '');

  // Handlers
  const handleUpdate = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePaste = async (field: string) => {
    try {
        const res = await Taro.getClipboardData();
        if (res.data) handleUpdate(field, res.data);
    } catch (e) {
        // ignore
    }
  };

  const chooseImage = async (type: 'person' | 'logo') => {
    try {
      const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'] });
      const filePath = res.tempFiles[0].tempFilePath;
      
      // Convert to Base64
      const fs = Taro.getFileSystemManager();
      const base64 = fs.readFileSync(filePath, 'base64') as string;
      
      if (type === 'person') setPersonImageBase64(base64);
      else setLogoImageBase64(base64);
      
    } catch (err) {
      console.log('User cancelled image selection');
    }
  };

  const saveApiKey = () => {
    Taro.setStorageSync('API_KEY', apiKey);
    setShowSettings(false);
    Taro.showToast({ title: '已保存', icon: 'success' });
  };

  // Logic
  const handleGenerateStrategy = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return Taro.showToast({ title: '请设置 API Key', icon: 'none' });
    }
    
    setStatus('analyzing');
    Taro.showLoading({ title: 'AI 思考中...', mask: true });

    try {
      const res = await optimizePrompt(formData, apiKey);
      
      if (!res) throw new Error("返回结果为空");
      
      setResult(res);
      setStatus('prompt_success');
      Taro.hideLoading();
    } catch (err: any) {
      Taro.hideLoading();
      console.error(err);
      Taro.showModal({ 
        title: '生成策略失败', 
        content: err.message || '请检查网络或 API Key', 
        showCancel: false 
      });
      setStatus('idle');
    }
  };

  const handleGenerateImage = async () => {
    if (!apiKey || !result) return;
    
    setStatus('generating_image');
    Taro.showLoading({ title: '正在绘图...', mask: true });

    try {
      let personPart = null;
      let logoPart = null;

      if (formData.personSource === '1' && personImageBase64) {
        personPart = { mimeType: 'image/jpeg', data: personImageBase64 };
      } else if (formData.personSource === '3') {
        Taro.showToast({ title: '小程序暂不支持直接下载预设图片，请上传', icon: 'none' });
      }

      if (formData.logoType === '2' && logoImageBase64) {
        logoPart = { mimeType: 'image/png', data: logoImageBase64 };
      }

      const imgUrl = await generateCoverImage(result.finalPrompt, personPart, logoPart, apiKey);
      setGeneratedImage(imgUrl);
      setStatus('complete');
      Taro.hideLoading();

    } catch (err: any) {
      Taro.hideLoading();
      Taro.showModal({ 
        title: '绘图失败', 
        content: err.message || '请检查 API 权限或网络', 
        showCancel: false 
      });
      setStatus('prompt_success'); // Go back to prompt success state
    }
  };

  const saveToAlbum = () => {
    if (!generatedImage) return;
    
    const fs = Taro.getFileSystemManager();
    const fileName = `${Taro.env.USER_DATA_PATH}/cover_${Date.now()}.png`;
    // Remove prefix "data:image/png;base64," which is 22 chars
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");

    const buffer = Taro.base64ToArrayBuffer(base64Data); 
    
    fs.writeFile({
      filePath: fileName,
      data: buffer,
      encoding: 'binary',
      success: () => {
        Taro.saveImageToPhotosAlbum({
          filePath: fileName,
          success: () => Taro.showToast({ title: '已保存相册', icon: 'success' }),
          fail: (err) => {
             console.error(err);
             Taro.showToast({ title: '保存失败，请授权相册权限', icon: 'none' });
          }
        })
      },
      fail: (err) => {
          console.error(err);
          Taro.showToast({ title: '写入临时文件失败', icon: 'none' });
      }
    });
  };

  return (
    <ScrollView scrollY style={{ height: '100vh', paddingBottom: '40px' }}>
      
      {/* Header */}
      <View style={{ padding: '24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>ViralCover <Text className="text-purple-400">AI</Text></Text>
          <View style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>爆款视频封面生成器</View>
        </View>
        <View onClick={() => setShowSettings(true)} style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}>
          <Text style={{ fontSize: '20px' }}>⚙️</Text>
        </View>
      </View>

      {/* Main Content Grid */}
      <View style={{ padding: '0 20px' }}>
        
        {/* Step 1: Input Forms */}
        <View className="bento-card">
          <SectionHeader title="核心文案" icon="📝" />
          <FormInput 
            label="Q1. 主标题" 
            placeholder="输入主标题"
            value={formData.mainTitle} 
            onInput={(v: string) => handleUpdate('mainTitle', v)}
            onPaste={() => handlePaste('mainTitle')}
          />
          <FormInput 
            label="Q2. 副标题" 
            placeholder="输入副标题 (可选)"
            value={formData.subTitle} 
            onInput={(v: string) => handleUpdate('subTitle', v)}
            onPaste={() => handlePaste('subTitle')}
          />
        </View>

        <View className="bento-card">
          <SectionHeader title="视觉与构图" icon="🎨" />
          <FormPicker label="Q4. 封面比例" value={formData.coverType} options={DROPDOWN_OPTIONS.coverType} onChange={(v: string) => handleUpdate('coverType', v)} />
          <FormPicker label="Q8. 色彩风格" value={formData.colorStyle} options={DROPDOWN_OPTIONS.colorStyle} onChange={(v: string) => handleUpdate('colorStyle', v)} />
          <FormPicker label="Q9. 背景元素" value={formData.backgroundElement} options={DROPDOWN_OPTIONS.backgroundElement} onChange={(v: string) => handleUpdate('backgroundElement', v)} />
        </View>

        <View className="bento-card">
          <SectionHeader title="人物主体" icon="👤" />
          <View style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <FormPicker label="Q5. 来源" value={formData.personSource} options={DROPDOWN_OPTIONS.personSource} onChange={(v: string) => handleUpdate('personSource', v)} />
            <FormPicker label="Q7. 表情" value={formData.expressionStrength} options={DROPDOWN_OPTIONS.expressionStrength} onChange={(v: string) => handleUpdate('expressionStrength', v)} />
          </View>
          
          {formData.personSource === '1' && (
             <View onClick={() => chooseImage('person')} style={{ marginTop: '12px', height: '100px', border: '2px dashed #334155', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.1)' }}>
                {personImageBase64 ? (
                   <Image src={`data:image/png;base64,${personImageBase64}`} mode="aspectFit" style={{ width: '100%', height: '100%' }} />
                ) : (
                   <Text style={{ color: '#34d399' }}>+ 上传照片</Text>
                )}
             </View>
          )}
        </View>

        {/* Action Button 1 */}
        <Button className="btn-primary" onClick={handleGenerateStrategy} loading={status === 'analyzing'}>
          ✨ 生成策略 & Prompt
        </Button>

        {/* Results Area */}
        {result && (
          <View className="bento-card" style={{ marginTop: '24px', borderColor: '#c084fc' }}>
             <SectionHeader title="AI 策略分析" icon="🧠" />
             <Text style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }} selectable>{result.analysis || '无分析内容'}</Text>
             
             <View style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />
             
             <SectionHeader title="Prompt" icon="💬" />
             <View style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
               <Text style={{ fontSize: '12px', color: '#34d399', fontFamily: 'monospace' }} selectable>{result.finalPrompt || '无 Prompt'}</Text>
             </View>
          </View>
        )}

        {/* Action Button 2 */}
        {result && (
          <Button className="btn-success" onClick={handleGenerateImage} loading={status === 'generating_image'}>
            🎨 生成最终封面图
          </Button>
        )}

        {/* Final Image */}
        {generatedImage && (
          <View className="bento-card" style={{ marginTop: '24px', padding: '0', overflow: 'hidden' }}>
            <Image src={generatedImage} mode="widthFix" style={{ width: '100%' }} />
            <View style={{ padding: '16px' }}>
              <Button onClick={saveToAlbum} style={{ background: 'white', color: 'black', fontWeight: 'bold' }}>保存到相册</Button>
            </View>
          </View>
        )}

      </View>

      {/* Settings Modal */}
      {showSettings && (
        <View className="modal-mask">
          <View className="modal-content">
             <Text style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '16px' }}>设置 API Key</Text>
             
             {/* Model Usage Info */}
             <View style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <Text style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>模型使用说明：</Text>
                <View style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <View style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: '#cbd5e1' }}>1. 策略分析 & Prompt</Text>
                        <Text style={{ fontSize: '12px', color: '#a78bfa', fontFamily: 'monospace' }}>Gemini 2.5 Flash</Text>
                    </View>
                    <View style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: '12px', color: '#cbd5e1' }}>2. 高清绘图 (16:9)</Text>
                        <Text style={{ fontSize: '12px', color: '#34d399', fontFamily: 'monospace' }}>Gemini 3 Pro Image</Text>
                    </View>
                </View>
             </View>

             <Input 
                value={apiKey} 
                onInput={(e) => setApiKey(e.detail.value)} 
                placeholder="sk-..." 
                className="input-field" 
                style={{ marginBottom: '16px' }}
             />
             <Button onClick={saveApiKey} style={{ background: '#9333ea', color: 'white' }}>保存</Button>
             <Button onClick={() => setShowSettings(false)} style={{ background: 'transparent', color: '#94a3b8', marginTop: '8px' }}>关闭</Button>
          </View>
        </View>
      )}

    </ScrollView>
  );
}

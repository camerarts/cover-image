
import Taro from '@tarojs/taro';
import { SYSTEM_INSTRUCTION } from './constants';

export interface ImagePart {
    mimeType: string;
    data: string;
}

// 注意：小程序直接调用 Google API 会因为域名不在白名单而失败。
// 建议：在开发工具详情中勾选“不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书”
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Helper to clean JSON string (remove markdown code blocks)
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  // Remove markdown code blocks like ```json ... ```
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "");
  // Remove any leading/trailing whitespace
  return cleaned.trim();
};

export const optimizePrompt = async (formData: any, apiKey: string): Promise<any> => {
  if (!apiKey) throw new Error("API Key 未设置，请在设置中配置");

  const userPrompt = `
    Analyze the following cover request and generate the optimized prompt:
    - Main Title: ${formData.mainTitle}
    - Sub Title: ${formData.subTitle}
    - Promise Level: ${formData.promiseLevel}
    - Cover Type: ${formData.coverType}
    - Person Source: ${formData.personSource}
    - Color Style: ${formData.colorStyle}
    - Background: ${formData.backgroundElement}
    - Brand Name: ${formData.brandName}
    
    Provide output in strict JSON with keys: parameterSummary, finalPrompt, chinesePrompt, analysis.
  `;

  try {
    const response = await Taro.request({
      url: `${BASE_URL}/gemini-2.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                  parameterSummary: { type: "STRING" },
                  finalPrompt: { type: "STRING" },
                  chinesePrompt: { type: "STRING" },
                  analysis: { type: "STRING" },
                },
                required: ["parameterSummary", "finalPrompt", "chinesePrompt", "analysis"]
            }
        },
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] }
      }
    });

    // 安全检查 response.data
    if (response.statusCode !== 200) {
        let errMsg = `Status ${response.statusCode}`;
        if (response.data && typeof response.data === 'object' && (response.data as any).error) {
             errMsg = (response.data as any).error.message || errMsg;
        }
        throw new Error(`API Error: ${errMsg}`);
    }

    const candidate = response.data.candidates?.[0];
    if (!candidate) {
        throw new Error("模型未返回内容 (可能被安全策略拦截)");
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("模型返回了空文本");
    }

    try {
        const parsed = JSON.parse(cleanJsonString(text));
        // 简单的结构检查
        if (!parsed.finalPrompt) throw new Error("返回数据缺失 finalPrompt");
        return parsed;
    } catch (e) {
        console.error("JSON Parse Error Raw Text:", text);
        throw new Error("解析 AI 返回的数据失败，请重试");
    }

  } catch (error: any) {
    console.error("Optimize Error Details:", error);
    throw new Error(error.message || "请求失败，请检查网络 (需科学环境或代理)");
  }
};

export const generateCoverImage = async (
    prompt: string, 
    personImagePart: ImagePart | null, 
    logoImagePart: ImagePart | null,
    apiKey: string
): Promise<string> => {
    if (!apiKey) throw new Error("API Key Missing");

    const parts: any[] = [{ text: prompt }];

    if (personImagePart) {
        parts.push({ inlineData: { mimeType: personImagePart.mimeType, data: personImagePart.data } });
        parts[0].text += "\n\n(Use attached image as person reference)";
    }
    if (logoImagePart) {
        parts.push({ inlineData: { mimeType: logoImagePart.mimeType, data: logoImagePart.data } });
        parts[0].text += "\n\n(Include attached logo)";
    }

    try {
        const response = await Taro.request({
            url: `${BASE_URL}/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: {
                contents: [{ parts }],
                generationConfig: {
                    responseMimeType: "image/png" 
                }
            }
        });

        if (response.statusCode !== 200) {
             let errMsg = `Status ${response.statusCode}`;
             if (response.data && typeof response.data === 'object' && (response.data as any).error) {
                  errMsg = (response.data as any).error.message || errMsg;
             }
             throw new Error(`API Error: ${errMsg}`);
        }

        const generatedPart = response.data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
        
        if (generatedPart) {
            return `data:image/png;base64,${generatedPart.inlineData.data}`;
        }
        
        throw new Error("未生成图片数据");
    } catch (error: any) {
        console.error("Generate Image Error", error);
        throw new Error(error.message || "绘图请求失败");
    }
};

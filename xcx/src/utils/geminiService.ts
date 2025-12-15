
import Taro from '@tarojs/taro';
import { SYSTEM_INSTRUCTION } from './constants';

export interface ImagePart {
    mimeType: string;
    data: string;
}

// 注意：小程序直接调用 Google API 会因为域名不在白名单而失败。
// 建议：将此处的 URL 改为你的 Cloudflare Worker 地址，或者在开发工具中开启“不校验合法域名”。
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Helper to clean JSON string (remove markdown code blocks)
const cleanJsonString = (str: string): string => {
  if (!str) return "{}";
  // Remove ```json and ```
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "");
  return cleaned.trim();
};

export const optimizePrompt = async (formData: any, apiKey: string): Promise<any> => {
  if (!apiKey) throw new Error("API Key is missing");

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

    if (response.statusCode !== 200) {
        throw new Error(`API Error: ${response.data.error?.message || response.statusCode}`);
    }

    const candidate = response.data.candidates?.[0];
    if (!candidate) {
        throw new Error("模型未返回任何候选项 (Blocked by safety filters?)");
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("模型返回了空文本");
    }

    try {
        return JSON.parse(cleanJsonString(text));
    } catch (e) {
        console.error("JSON Parse Error", text);
        throw new Error("解析 AI 返回的数据失败");
    }

  } catch (error: any) {
    console.error("Optimize Error Details:", error);
    // Re-throw with a user-friendly message
    throw new Error(error.message || "请求 AI 服务失败，请检查网络或 API Key");
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
                    // Note: imageConfig format varies slightly in REST vs SDK
                    responseMimeType: "image/png" 
                }
            }
        });

        if (response.statusCode !== 200) {
             throw new Error(`API Error: ${response.data.error?.message || response.statusCode}`);
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

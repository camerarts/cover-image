import { GoogleGenAI, Type } from "@google/genai";

// Duplicate constants to ensure standalone execution in Edge environment
const SYSTEM_INSTRUCTION = `
You are a "Cover Image Meta Prompt Abstract Assistant". Your goal is to take user inputs and structured data to generate a professional, high-click-through rate image generation prompt.

You act as:
1. Senior Visual Designer (16:9 expert, YouTube/WeChat aesthetic)
2. Clickbait Expert (High CTR)
3. Prompt Engineer

Your Output MUST be a JSON object with the following keys:
- "parameterSummary": A concise summary of the interpreted parameters in Chinese.
- "finalPrompt": The highly detailed, English image generation prompt optimized for a model like Gemini or Midjourney.
- "chinesePrompt": A direct translation of the "finalPrompt" into Chinese, capturing the same descriptive details and style keywords.
- "analysis": A brief explanation of why you chose this composition.

Follow these design principles:
- Text legibility is priority #1.
- Authentic human feel (if person involved).
- High visual impact.
- 16:9 Aspect Ratio.

For the "finalPrompt", ensure you describe the text placement, lighting, camera angle, and style vividly. If the user provides a title, ensure the prompt asks for the text to be legible and high contrast.
`;

// Default configuration for API automated generation
const DEFAULT_CONFIG = {
  promiseLevel: '2',
  coverType: '2', // YouTube Thumbnail
  personSource: '2', // AI Generated Person (Safest for automation)
  personPosition: '2',
  expressionStrength: '2',
  colorStyle: '3', // Blue + Yellow contrast (High CTR)
  backgroundElement: '1',
  brandName: '', // Default to empty
  logoType: '1', // Text Logo
  brandIntensity: '2',
  textLayout: '1',
  specialRequirements: ''
};

interface Env {
  API_KEY: string;
}

export const onRequestPost = async (context: { request: Request, env: Env }) => {
  try {
    const { request, env } = context;
    
    // 1. Parse Input
    const body = await request.json() as any;
    const { mainTitle, subTitle } = body;

    if (!mainTitle) {
      return new Response(JSON.stringify({ error: "Missing required parameter: mainTitle" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Auth Check (Use Env key exclusively)
    const finalApiKey = env.API_KEY;
    if (!finalApiKey) {
       return new Response(JSON.stringify({ error: "Server API Key not configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ai = new GoogleGenAI({ apiKey: finalApiKey });

    // 3. Construct Strategy Prompt
    const formData = {
        mainTitle,
        subTitle: subTitle || "获取百万流量",
        ...DEFAULT_CONFIG
    };

    const userPrompt = `
    Analyze the following cover request and generate the optimized prompt:
    
    - Main Title: ${formData.mainTitle}
    - Sub Title: ${formData.subTitle}
    - Promise Level: ${formData.promiseLevel}
    - Cover Type: ${formData.coverType}
    - Person Source: ${formData.personSource}
    - Person Position: ${formData.personPosition}
    - Expression: ${formData.expressionStrength}
    - Color Style: ${formData.colorStyle}
    - Background: ${formData.backgroundElement}
    - Brand Name: ${formData.brandName}
    - Logo Type: ${formData.logoType}
    - Brand Intensity: ${formData.brandIntensity}
    - Text Layout: ${formData.textLayout}
    - Special Req: ${formData.specialRequirements}
    
    Please provide the output in strict JSON format matching the schema.
    `;

    // 4. Generate Strategy (Gemini Flash)
    const strategyResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            parameterSummary: { type: Type.STRING },
            finalPrompt: { type: Type.STRING },
            chinesePrompt: { type: Type.STRING },
            analysis: { type: Type.STRING },
          },
          required: ["parameterSummary", "finalPrompt", "chinesePrompt", "analysis"]
        }
      }
    });

    if (!strategyResponse.text) {
        throw new Error("Failed to generate strategy");
    }

    const strategyResult = JSON.parse(strategyResponse.text);

    // 5. Generate Image (Gemini Pro Image)
    const imagePrompt = `${strategyResult.finalPrompt}\n\n(High quality, 16:9, YouTube thumbnail style)`;
    
    const imageResponse = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: { parts: [{ text: imagePrompt }] },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
                imageSize: "1K"
            }
        }
    });

    const generatedImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    let imageUrl = null;

    if (generatedImagePart?.inlineData?.data) {
        imageUrl = `data:image/png;base64,${generatedImagePart.inlineData.data}`;
    } else {
        throw new Error("Failed to generate image data");
    }

    // 6. Return Result
    return new Response(JSON.stringify({
        success: true,
        mainTitle: formData.mainTitle,
        subTitle: formData.subTitle,
        strategy: strategyResult,
        imageUrl: imageUrl
    }), {
        headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" // Allow CORS
        }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || "Internal Server Error" 
    }), {
        status: 500,
        headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
        }
    });
  }
};
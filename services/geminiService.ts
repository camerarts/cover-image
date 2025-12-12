import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { CoverFormData, OptimizationResult } from "../types";

// Helper to convert Blob/File to Base64
export const fileToGenerativePart = async (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g. "data:image/jpeg;base64,")
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
      } else {
          reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export interface ImagePart {
    mimeType: string;
    data: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Step 1: Use Gemini Flash to act as the "Meta Prompt Assistant" and generate the optimized prompt.
 */
export const optimizePrompt = async (formData: CoverFormData): Promise<OptimizationResult> => {
  try {
    const model = "gemini-2.5-flash";
    
    // Construct the user message based on the form data
    const userPrompt = `
    Analyze the following cover request and generate the optimized prompt:
    
    - Main Title: ${formData.mainTitle}
    - Sub Title: ${formData.subTitle}
    - Promise Level: ${formData.promiseLevel}
    - Cover Type: ${formData.coverType}
    - Person Source: ${formData.personSource} (Note: If '1', user has uploaded a photo. If '3', user uses a specific preset photo.)
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

    const response = await ai.models.generateContent({
      model: model,
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

    if (response.text) {
        return JSON.parse(response.text) as OptimizationResult;
    }
    throw new Error("Empty response from AI");

  } catch (error) {
    console.error("Error optimizing prompt:", error);
    throw error;
  }
};

/**
 * Step 2: Use Gemini Pro Image (or Flash Image) to generate the actual image.
 */
export const generateCoverImage = async (
    prompt: string, 
    personImagePart: ImagePart | null, 
    logoImagePart: ImagePart | null
): Promise<string> => {
    try {
        // Upgrade to pro-image-preview for high quality text rendering capabilities
        const model = "gemini-3-pro-image-preview";

        const parts: any[] = [{ text: prompt }];

        if (personImagePart) {
            parts.push({
                inlineData: {
                    mimeType: personImagePart.mimeType,
                    data: personImagePart.data
                }
            });
            parts[0].text += "\n\n(Important: Use the provided first image as the reference for the person in the composition. Maintain their likeness.)";
        }

        if (logoImagePart) {
             parts.push({
                inlineData: {
                    mimeType: logoImagePart.mimeType,
                    data: logoImagePart.data
                }
            });
             parts[0].text += "\n\n(Important: Include the provided brand logo image in the composition as requested.)";
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: {
                // Ensure we get a 16:9 aspect ratio
                imageConfig: {
                    aspectRatio: "16:9",
                    imageSize: "1K"
                }
            }
        });

        // Extract image
        const generatedImage = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        
        if (generatedImage && generatedImage.inlineData && generatedImage.inlineData.data) {
            return `data:image/png;base64,${generatedImage.inlineData.data}`;
        }
        
        throw new Error("No image generated");

    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

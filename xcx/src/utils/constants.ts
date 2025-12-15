
export const SYSTEM_INSTRUCTION = `
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

export const SPECIFIC_PERSON_IMAGE_URL = 'https://i.imgant.com/v2/xgey0S2.jpeg';

export const DROPDOWN_OPTIONS = {
  promiseLevel: [
    { value: '1', label: '1 - 温和' },
    { value: '2', label: '2 - 中等' },
    { value: '3', label: '3 - 强承诺' },
  ],
  coverType: [
    { value: '1', label: '公众号 (16:9)' },
    { value: '2', label: 'YouTube (16:9)' },
    { value: '3', label: '其他横版' },
  ],
  personSource: [
    { value: '1', label: '上传照片' },
    { value: '2', label: 'AI 生成' },
    { value: '3', label: '指定人物' },
  ],
  personPosition: [
    { value: '1', label: '左侧' },
    { value: '2', label: '右侧' },
    { value: '3', label: '中间偏下' },
  ],
  expressionStrength: [
    { value: '1', label: '轻度惊讶' },
    { value: '2', label: '中度震撼' },
    { value: '3', label: '极度夸张' },
  ],
  colorStyle: [
    { value: '1', label: '蓝紫科技' },
    { value: '2', label: '黄橙高能' },
    { value: '3', label: '蓝黄对撞' },
  ],
  backgroundElement: [
    { value: '1', label: 'AI 界面' },
    { value: '2', label: '数据曲线' },
    { value: '3', label: '社媒图标' },
    { value: '4', label: '纯色极简' },
  ],
  logoType: [
    { value: '1', label: '纯文字' },
    { value: '2', label: '图片 Logo' },
  ],
  brandIntensity: [
    { value: '1', label: '低调' },
    { value: '2', label: '中等' },
    { value: '3', label: '醒目' },
  ],
  textLayout: [
    { value: '1', label: '居中顶部' },
    { value: '2', label: '靠左顶部' },
    { value: '3', label: '靠右顶部' },
  ],
};

export const INITIAL_FORM_STATE = {
  mainTitle: '如何生成大量图片的提示词',
  subTitle: '获取百万流量',
  promiseLevel: '2',
  coverType: '2',
  personSource: '2',
  personPosition: '2',
  expressionStrength: '2',
  colorStyle: '3',
  backgroundElement: '1',
  brandName: '',
  logoType: '1',
  brandIntensity: '2',
  textLayout: '1',
  specialRequirements: '',
};

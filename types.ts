export interface CoverFormData {
  mainTitle: string;
  subTitle: string;
  promiseLevel: string;
  coverType: string;
  personSource: string;
  personPosition: string;
  expressionStrength: string;
  colorStyle: string;
  backgroundElement: string;
  brandName: string;
  logoType: string;
  brandIntensity: string;
  textLayout: string;
  specialRequirements: string;
}

export interface OptimizationResult {
  parameterSummary: string;
  finalPrompt: string;
  chinesePrompt: string;
  analysis: string;
}

export interface ImageResult {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
}
export interface TranslationVersion {
  versionNumber: number;
  text: string;
  model: string;
  timestamp: number;
  translationStyle?: TranslationStyle;
  customGlossary?: string;
  glossaryStatus?: 'none' | 'full' | 'filtered';
  glossaryRatio?: number;
  summary?: string;
  usePronouns?: boolean;
  pronounSnapshot?: string;
  pronounVersionNumber?: number;
  useGlossary?: boolean;
  glossaryVersionNumber?: number;
  useContextSummary?: boolean;
  contextSummarySnapshot?: string;
  contextSummaryChapterTitle?: string;
  useCustomInstructions?: boolean;
  customInstructionsSnapshot?: string;
}

export interface Chapter {
  id: string;
  order: number;
  title: string;
  originalText: string;
  originalPdfBase64?: string;
  originalPdfPages?: number;
  startPage?: number;
  endPage?: number;
  wordCount: number;
  translatedText?: string;
  status: 'pending' | 'translating' | 'done' | 'error';
  versions?: TranslationVersion[];
  activeVersionNumber?: number;
  latestVersionNumber?: number;
  excludeFromTranslation?: boolean;
}

export type TranslationStyle = 'general_science' | 'social_science' | 'specialized_math';

export interface TranslationConfig {
  model: 'gemini-flash-latest' | 'gemini-pro-latest';
  pronounGenModel?: string;
  glossaryGenModel?: string;
  analysisModel?: string;
  generateSummary?: boolean;
  translationStyle?: TranslationStyle;
}

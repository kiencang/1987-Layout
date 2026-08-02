declare const GEMINI_API_KEY: string;

interface Window {
  __SILA_IMAGES__?: Record<string, string>;
  MathJax?: {
    typesetPromise?: (elements?: Element[]) => Promise<void>;
    typesetClear?: (elements?: Element[]) => void;
    typeset?: (elements?: Element[]) => void;
  };
}

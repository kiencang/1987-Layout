declare const GEMINI_API_KEY: string;

interface Window {
  __SILA_IMAGES__?: Record<string, string>;
  MathJax?: {
    typesetPromise?: (elements?: (Element | ShadowRoot)[]) => Promise<void>;
    typesetClear?: (elements?: (Element | ShadowRoot)[]) => void;
    typeset?: (elements?: (Element | ShadowRoot)[]) => void;
  };
}

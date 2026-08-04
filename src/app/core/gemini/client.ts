import { Injectable } from '@angular/core';
import { GoogleGenAI } from '@google/genai';
import { TranslationStyle } from '../book.store';
import { htmlToMarkdown } from './markdown-utils';
import {
  generatePronounsRaw,
  generateGlossaryRaw
} from './setup-generator';
import { filterGlossary, normalizePronouns } from './glossary-filter';
import { translateChapter, summarizeTranslation } from './translation-engine';

@Injectable({ providedIn: 'root' })
export class GeminiClient {
  private getApiKey(): string {
    if (typeof window !== 'undefined') {
      const userKey = localStorage.getItem('user_gemini_api_key');
      if (userKey && userKey.trim()) {
        return userKey.trim();
      }
    }
    return GEMINI_API_KEY;
  }

  private get ai(): GoogleGenAI {
    return new GoogleGenAI({ 
      apiKey: this.getApiKey(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }

  private async loadPromptText(url: string): Promise<string | null> {
    const defaultOpts: RequestInit = { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, defaultOpts);
      if (res.ok) return await res.text();
    } catch (e) {
      console.error(`Failed to load ${url}`, e);
    }
    return null;
  }

  async countTokens(base64Data: string, mimeType = 'application/pdf', model = 'gemini-flash-lite-latest'): Promise<number> {
    try {
      const response = await this.ai.models.countTokens({
        model: model,
        contents: [
          { inlineData: { data: base64Data, mimeType } }
        ]
      });
      return response.totalTokens || 0;
    } catch (e) {
      console.error('Failed to count tokens', e);
      return 0;
    }
  }

  async filterGlossary(glossaryTable: string, pdfBase64: string): Promise<{ text: string; usedCount: number; totalCount: number }> {
    return filterGlossary(this.ai, this.loadPromptText.bind(this), glossaryTable, pdfBase64);
  }

  async normalizePronouns(pdfBase64: string, rawPronounTable: string, model: string, bookTitle: string, author: string): Promise<string> {
    return normalizePronouns(this.ai, this.loadPromptText.bind(this), pdfBase64, rawPronounTable, model, bookTitle, author);
  }

  async translateChapter(
    pdfBase64: string, 
    model: string, 
    bookTitle = '', 
    author = '', 
    pronounTable = '', 
    usePronouns = false, 
    glossaryTable = '', 
    useGlossary = false, 
    contextSummary?: string, 
    customInstructions?: string, 
    images?: Record<string, string>,
    translationStyle: TranslationStyle = 'general_science',
    startPageNum?: number,
    endPageNum?: number
  ): Promise<{text: string, customGlossary?: string, glossaryStatus?: 'none' | 'full' | 'filtered', glossaryRatio?: number, images?: Record<string, string>}> {
    return translateChapter(
      this.ai,
      this.loadPromptText.bind(this),
      pdfBase64,
      model,
      bookTitle,
      author,
      pronounTable,
      usePronouns,
      glossaryTable,
      useGlossary,
      contextSummary,
      customInstructions,
      images,
      translationStyle,
      startPageNum,
      endPageNum
    );
  }

  async generatePronounsRaw(pdfBase64: string, model: string, bookTitle = '', author = ''): Promise<{ originalName?: string; gender?: string; ageGroup?: string; role?: string; translatedTitles?: string; narratorPronoun?: string; dialoguePronouns?: string; reasoning?: string; notes?: string; }[]> {
    return generatePronounsRaw(this.ai, this.loadPromptText.bind(this), pdfBase64, model, bookTitle, author);
  }

  async generateGlossaryRaw(pdfBase64: string, model: string, bookTitle = '', author = ''): Promise<{ english?: string; pos?: string; vietnamese?: string; contextNotes?: string; }[]> {
    return generateGlossaryRaw(this.ai, this.loadPromptText.bind(this), pdfBase64, model, bookTitle, author);
  }

  public htmlToMarkdown(html: string): string {
    return htmlToMarkdown(html);
  }

  async summarizeTranslation(translatedText: string, model: string): Promise<string> {
    return summarizeTranslation(this.ai, this.loadPromptText.bind(this), translatedText, model);
  }
}

import { GoogleGenAI, Type } from '@google/genai';
import { DEFAULT_SAFETY_SETTINGS } from './error-parser';

export async function filterGlossary(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  glossaryTable: string,
  pdfBase64: string
): Promise<{ text: string; usedCount: number; totalCount: number }> {
  try {
    const lines = glossaryTable.split('\n').filter(l => l.trim().startsWith('|'));
    if (lines.length <= 2) return { text: glossaryTable, usedCount: 0, totalCount: 0 };

    const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
    if (headers.length < 4 || headers[0] !== 'Tiếng Anh') return { text: glossaryTable, usedCount: 0, totalCount: 0 };

    const fullGlossary: { english: string; pos: string; vietnamese: string; notes: string }[] = [];
    const compactList: { english: string; pos: string }[] = [];
    
    for (let i = 2; i < lines.length; i++) {
      const cells = lines[i].split('|').map(c => c.trim());
      if (cells.length >= 5) {
         const english = cells[1];
         const pos = cells[2];
         const vietnamese = cells[3];
         const notes = cells[4];
         fullGlossary.push({ english, pos, vietnamese, notes });
         compactList.push({ english, pos });
      }
    }

    if (compactList.length === 0) return { text: '', usedCount: 0, totalCount: fullGlossary.length };
    if (compactList.length <= 100) return { text: glossaryTable, usedCount: compactList.length, totalCount: compactList.length };

    const si = await loadPromptText('/prompts/filter_glossary_system_instruction.md') || 'You are an expert terminology extractor. Your task is to filter a given list of glossary terms and identify which ones are present in the provided document. Return ONLY a valid JSON array of objects with "english" and "pos" properties.';
    let prompt = await loadPromptText('/prompts/filter_glossary_prompt.md');
    if (!prompt) {
      prompt = "Glossary Terms:\n{{danh sách thuật ngữ}}";
    }
    
    prompt = prompt.replace('{{danh sách thuật ngữ}}', JSON.stringify(compactList));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filterConfig: any = {
      systemInstruction: si,
      thinkingConfig: { thinkingLevel: 'HIGH' },
      safetySettings: DEFAULT_SAFETY_SETTINGS,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            english: { type: Type.STRING },
            pos: { type: Type.STRING }
          },
          required: ["english", "pos"]
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentsPayload: any[] = [];
    contentsPayload.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } });
    contentsPayload.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest',
      contents: contentsPayload,
      config: filterConfig
    });
    
    const resultText = response.text || '[]';
    const matchedItems = JSON.parse(resultText);
    
    if (!Array.isArray(matchedItems) || matchedItems.length === 0) {
      return { text: '', usedCount: 0, totalCount: fullGlossary.length };
    }
    
    const matchedEnglishSet = new Set(matchedItems.map((item: { english: string; pos: string }) => (item.english || '').toLowerCase().trim()));
    const matchedFullSet = new Set(matchedItems.map((item: { english: string; pos: string }) => `${(item.english || '').trim()}_${(item.pos || '').trim()}`.toLowerCase()));

    const filteredGlossary = fullGlossary.filter(item => {
      const fullKey = `${item.english.trim()}_${item.pos.trim()}`.toLowerCase();
      const engKey = item.english.trim().toLowerCase();
      return matchedFullSet.has(fullKey) || matchedEnglishSet.has(engKey);
    });
    
    if (filteredGlossary.length === 0) return { text: '', usedCount: 0, totalCount: fullGlossary.length };
    
    let resultTable = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
    for (const item of filteredGlossary) {
      resultTable += `| ${item.english} | ${item.pos} | ${item.vietnamese} | ${item.notes} |\n`;
    }
    
    return { text: resultTable, usedCount: filteredGlossary.length, totalCount: fullGlossary.length };
    
  } catch (e) {
    console.error('Failed to filter glossary', e);
    return { text: glossaryTable, usedCount: 0, totalCount: 0 }; 
  }
}

export async function normalizePronouns(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  pdfBase64: string,
  rawPronounTable: string,
  model: string,
  bookTitle: string,
  author: string
): Promise<string> {
  try {
    if (!rawPronounTable.trim()) return '';
    
    const si = await loadPromptText('/prompts/normalize_pronouns_system_instructions.md') || 'You are an expert context analyzer. Your task is to normalize and refine the provided raw pronoun table based on the full book content.';
    let prompt = await loadPromptText('/prompts/normalize_pronouns_prompt.md');
    if (!prompt) {
      prompt = "Raw Pronoun Table:\n{{bảng đại từ}}\n\nPlease normalize it.";
    }
    
    prompt = prompt.replace('{{tên sách}}', bookTitle || 'Không rõ');
    prompt = prompt.replace('{{tên tác giả}}', author || 'Vô danh');
    prompt = prompt.replace('{{bảng đại từ}}', rawPronounTable);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [];
    contents.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } });
    contents.push({ text: prompt });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filterConfig: any = {
      systemInstruction: si,
      thinkingConfig: { thinkingLevel: 'HIGH' },
      safetySettings: DEFAULT_SAFETY_SETTINGS,
    };

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: filterConfig
    });
    
    let result = response.text || '';
    if (result.startsWith('```markdown')) {
      result = result.replace(/^```markdown\n/, '').replace(/\n```$/, '');
    } else if (result.startsWith('```')) {
      result = result.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    return result;
    
  } catch (e) {
    console.error('Failed to normalize pronouns', e);
    return rawPronounTable; 
  }
}

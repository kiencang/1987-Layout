import { GoogleGenAI } from '@google/genai';
import { DEFAULT_SAFETY_SETTINGS } from './error-parser';

export async function generatePronounsRaw(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  pdfBase64: string,
  model: string,
  bookTitle = '',
  author = ''
): Promise<{
  originalName?: string;
  gender?: string;
  ageGroup?: string;
  role?: string;
  translatedTitles?: string;
  narratorPronoun?: string;
  dialoguePronouns?: string;
  reasoning?: string;
  notes?: string;
}[]> {
  const psi = await loadPromptText('/prompts/pronouns_system_instructions.md');
  const pp = await loadPromptText('/prompts/pronouns_prompt.md');

  let finalPrompt = pp || `Hãy phân tích đoạn văn bản nguồn dưới đây và lập Bảng đại từ nhân xưng chuẩn xác nhất.\n\n<metadata>\n- Tên sách: {{tên sách}}\n- Tác giả: {{tên tác giả}}\n</metadata>`;
  
  finalPrompt = finalPrompt.replace('{{tên sách}}', bookTitle || 'Không rõ');
  finalPrompt = finalPrompt.replace('{{tên tác giả}}', author || 'Vô danh');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];
  contents.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } });
  contents.push({ text: finalPrompt });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configArgs: any = {
    thinkingConfig: { thinkingLevel: 'HIGH' },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    responseMimeType: 'application/json'
  };

  if (psi) {
     configArgs.systemInstruction = psi;
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: contents,
    config: configArgs
  });

  let result = response.text || '';
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
  }
  result = match[0];

  try {
    const arr = JSON.parse(result);
    if (Array.isArray(arr)) {
      return arr;
    }
    throw new Error('Dữ liệu không phải là mảng');
  } catch (e) {
    console.warn('Failed to parse generatePronounsRaw JSON', e, result);
    throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
  }
}

export async function generatePronouns(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  pdfBase64: string,
  model: string,
  bookTitle = '',
  author = ''
): Promise<string> {
  const arr = await generatePronounsRaw(ai, loadPromptText, pdfBase64, model, bookTitle, author);
  if (arr.length > 0) {
    let md = '| Nhân vật (Original) | Giới tính | Ước lượng độ tuổi | Đặc điểm & Vai trò | Xưng hô / Tước vị (Dịch) | Ngôi thứ 3 (Narrator) | Xưng - Hô (Với người khác) | Lý do | Ghi chú |\n|---|---|---|---|---|---|---|---|---|\n';
    for (const pt of arr) {
      md += `| ${pt.originalName || ''} | ${pt.gender || ''} | ${pt.ageGroup || ''} | ${pt.role || ''} | ${pt.translatedTitles || ''} | ${pt.narratorPronoun || ''} | ${pt.dialoguePronouns || ''} | ${pt.reasoning || ''} | ${pt.notes || ''} |\n`;
    }
    return md;
  }
  return '';
}

export async function generateGlossaryRaw(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  pdfBase64: string,
  model: string,
  bookTitle = '',
  author = ''
): Promise<{ english?: string; pos?: string; vietnamese?: string; contextNotes?: string; }[]> {
  const gsi = await loadPromptText('/prompts/glossary_system_instructions.md');
  const gp = await loadPromptText('/prompts/glossary_prompt.md');

  let finalPrompt = gp || `Hãy phân tích nội dung và trích xuất Bảng thuật ngữ chuyên ngành/Từ khó dịch tiếng Anh - Việt.\n\n<metadata>\n- Tên sách: {{tên sách}}\n- Tác giả: {{tên tác giả}}\n</metadata>`;
  
  finalPrompt = finalPrompt.replace('{{tên sách}}', bookTitle || 'Không rõ');
  finalPrompt = finalPrompt.replace('{{tên tác giả}}', author || 'Vô danh');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];
  contents.push({ inlineData: { data: pdfBase64, mimeType: 'application/pdf' } });
  contents.push({ text: finalPrompt });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configArgs: any = {
    thinkingConfig: { thinkingLevel: 'HIGH' },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    responseMimeType: 'application/json'
  };

  if (gsi) {
     configArgs.systemInstruction = gsi;
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: contents,
    config: configArgs
  });

  let result = response.text || '';
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
  }
  result = match[0];

  try {
    const arr = JSON.parse(result);
    if (Array.isArray(arr)) {
      return arr;
    }
    throw new Error('Dữ liệu không phải là mảng');
  } catch (e) {
    console.warn('Failed to parse generateGlossaryRaw JSON', e, result);
    throw new Error('Không thể đọc dữ liệu từ AI. Vui lòng thử lại sau vài giây.');
  }
}

export async function generateGlossary(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  pdfBase64: string,
  model: string,
  bookTitle = '',
  author = ''
): Promise<string> {
  const arr = await generateGlossaryRaw(ai, loadPromptText, pdfBase64, model, bookTitle, author);
  if (arr.length > 0) {
    let md = '| Tiếng Anh | Từ loại | Tiếng Việt | Ghi chú văn cảnh |\n|---|---|---|---|\n';
    for (const pt of arr) {
      md += `| ${pt.english || ''} | ${pt.pos || ''} | ${pt.vietnamese || ''} | ${pt.contextNotes || ''} |\n`;
    }
    return md;
  }
  return '';
}

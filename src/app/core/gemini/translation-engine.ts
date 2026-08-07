import { GoogleGenAI } from '@google/genai';
import { TranslationStyle } from '../book.store';
import { restoreImagePlaceholders, extractImagesFromPdf } from '../image-processor.util';
import { DEFAULT_SAFETY_SETTINGS } from './error-parser';
import { filterGlossary } from './glossary-filter';
import { htmlToMarkdown } from './markdown-utils';

export async function translateChapter(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
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
  endPageNum?: number,
  projectId = ''
): Promise<{
  text: string;
  customGlossary?: string;
  glossaryStatus?: 'none' | 'full' | 'filtered';
  glossaryRatio?: number;
  images?: Record<string, string>;
}> {
  // Auto-extract images from current chapter's pdfBase64 if available to ensure accurate, chapter-scoped images
  let activeImages = { ...images };
  if (pdfBase64) {
    try {
      const raw = atob(pdfBase64);
      const rawLength = raw.length;
      const array = new Uint8Array(new ArrayBuffer(rawLength));
      for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }
      // Merge extracted images into activeImages using the improved utility that respects existing IDs & page numbers
      const extracted = await extractImagesFromPdf(array.buffer, projectId, 1024, 0.95, activeImages, startPageNum || 1);
      if (Object.keys(extracted).length > 0) {
        activeImages = extracted;
      }
    } catch (err) {
      console.warn('Không thể tự động trích xuất ảnh từ pdfBase64 trong translateChapter:', err);
    }
  }

  // Filter images to attach to AI for this specific chapter chunk based on page range
  let imagesToAttach: Record<string, string> = { ...activeImages };
  if (startPageNum !== undefined && endPageNum !== undefined && startPageNum > 0 && endPageNum >= startPageNum) {
    const filtered: Record<string, string> = {};
    for (const [id, dataUrl] of Object.entries(activeImages)) {
      const pageMatch = id.match(/PAGE_(\d+)_IMG_/i);
      if (pageMatch) {
        const page = parseInt(pageMatch[1], 10);
        if (page >= startPageNum && page <= endPageNum) {
          filtered[id] = dataUrl;
        }
      } else {
        // Include non-page-formatted IDs (like PLACEHOLDER_IMG_XXX) as fallback
        filtered[id] = dataUrl;
      }
    }
    imagesToAttach = filtered;
  }

  let activeGlossary = '';
  let glossaryStatus: 'none' | 'full' | 'filtered' = 'none';
  let glossaryRatio: number | undefined = undefined;

  if (useGlossary && glossaryTable) {
    try {
      const filterRes = await filterGlossary(ai, loadPromptText, glossaryTable, pdfBase64!);
      if (filterRes.text) {
        activeGlossary = filterRes.text;
        glossaryStatus = filterRes.usedCount < filterRes.totalCount ? 'filtered' : 'full';
        glossaryRatio = filterRes.totalCount > 0 ? Math.round((filterRes.usedCount / filterRes.totalCount) * 100) : 100;
      } else {
        activeGlossary = glossaryTable;
        glossaryStatus = 'full';
        glossaryRatio = 100;
      }
    } catch (err) {
      console.warn('Filtering glossary failed, falling back to full glossary:', err);
      activeGlossary = glossaryTable;
      glossaryStatus = 'full';
      glossaryRatio = 100;
    }
  }
  
  let siFileName = "/prompts/zero_svg_system_instructions.md";
  let promptFileName = "/prompts/zero_svg_prompt.md";
  
  if (translationStyle === 'social_science') {
    siFileName = "/prompts/zero_math_system_instructions.md";
    promptFileName = "/prompts/zero_math_prompt.md";
  } else if (translationStyle === 'specialized_math') {
    siFileName = "/prompts/scientific_system_instructions.md";
    promptFileName = "/prompts/scientific_prompt.md";
  }
  
  const systemInstruction = await loadPromptText(siFileName);
  let finalPrompt = await loadPromptText(promptFileName) || '';
  
  if (finalPrompt) {
    finalPrompt = finalPrompt.replace('{{tên sách}}', bookTitle || 'Không rõ');
    finalPrompt = finalPrompt.replace('{{tên tác giả}}', author || 'Vô danh');
    
    if (usePronouns && pronounTable) {
      const pronounBlock = `<pronouns_rules>\n**Bảng đại từ nhân xưng:**\n${pronounTable}\n\n*LƯU Ý: Ở trên là Bảng đại từ nhân xưng tham chiếu. Bạn BẮT BUỘC phải sử dụng cấu trúc xưng hô này cho cách người kể chuyện gọi nhân vật (ngôi thứ 3) và trong các cuộc hội thoại thông thường. TUY NHIÊN, bạn được phép điều chỉnh linh hoạt cách xưng hô (ngôi thứ 1 & 2) nếu bối cảnh cảm xúc của câu chuyện thực sự đòi hỏi sự chuyển đổi.*\n</pronouns_rules>`;
      finalPrompt = finalPrompt.replace('{{đại từ nhân xưng}}', pronounBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{đại từ nhân xưng}}', '');
    }

    if (activeGlossary) {
      const glossaryBlock = `<glossary_rules>\n**Bảng thuật ngữ / Từ khó:**\n${activeGlossary}\n\n*LƯU Ý: Bảng thuật ngữ trên đây là một DANH SÁCH THAM KHẢO quan trọng, NHƯNG bạn hãy áp dụng LINH HOẠT các thuật ngữ này vào bản dịch để đảm bảo tính thống nhất chuyên môn/từ ngữ toàn cục của cuốn sách. Điều cần ghi nhớ là đừng ép buộc áp dụng một cách cứng nhắc nếu ngữ cảnh cụ thể của đoạn văn hoàn toàn khác.*\n</glossary_rules>`;
      finalPrompt = finalPrompt.replace('{{thuật ngữ}}', glossaryBlock);
    } else {
      finalPrompt = finalPrompt.replace('{{thuật ngữ}}', '');
    }

    if (contextSummary) {
       const contextBlock = `<previous_chunk_handoff>\n**Tóm tắt bối cảnh từ phần trước để tham khảo:**\n${contextSummary}\n\n*LƯU Ý: Đây là thông tin nối tiếp từ khối văn bản trước (diễn biến sự kiện, trạng thái nhân vật, hoặc luồng logic/lập luận, **cùng với sắc thái/giọng điệu chung**). Hãy dùng nó để nắm bắt ngữ cảnh nhằm đảm bảo tính liền mạch cho bản dịch, đặc biệt là duy trì đúng giọng điệu và cảm xúc. TUYỆT ĐỐI KHÔNG lặp lại nội dung tóm tắt này vào phần bản dịch.*\n</previous_chunk_handoff>`;
       finalPrompt = finalPrompt.replace('{{tóm tắt bối cảnh}}', contextBlock);
    } else {
       finalPrompt = finalPrompt.replace('{{tóm tắt bối cảnh}}', '');
    }

    if (customInstructions) {
       const instructionsBlock = `<custom_instructions>\n**Chỉ thị bổ sung khi dịch:**\n${customInstructions}\n</custom_instructions>`;
       finalPrompt = finalPrompt.replace('{{chỉ thị bổ sung}}', instructionsBlock);
    } else {
       finalPrompt = finalPrompt.replace('{{chỉ thị bổ sung}}', '');
    }

    finalPrompt = finalPrompt.replace('{{nội dung cần dịch}}', '');
    
    // If there are project images for this chunk, append the guiding instruction block to finalPrompt
    if (imagesToAttach && Object.keys(imagesToAttach).length > 0) {
      const imageIds = Object.keys(imagesToAttach).join(', ');
      const imageGuide = `\n\n<available_images_and_ids>
Dưới đây là danh sách các hình ảnh được trích xuất từ tài liệu gốc tương ứng với phần nội dung này, cùng mã ID tương ứng: [${imageIds}].
Mỗi hình ảnh sẽ được đính kèm dưới dạng phần tử đa phương tiện trong payload của bạn kèm theo thông báo định danh "This image has ID: mã_id_của_ảnh".

BẠN BẮT BUỘC PHẢI TUÂN THỦ CÁC NGUYÊN TẮC SAU KHI XỬ LÝ HÌNH ẢNH:
1. ĐỐI CHIẾU VỊ TRÍ VÀ CHÚ THÍCH CHÍNH XÁC (QUAN TRỌNG NHẤT): Quan sát trực tiếp tệp PDF gốc để xác định đúng vị trí của từng ảnh. ĐẶC BIỆT LƯU Ý: Phải đọc kỹ và đối chiếu chính xác đoạn text chú thích (caption) nằm ngay dưới hoặc trên ảnh trong tài liệu gốc. TUYỆT ĐỐI KHÔNG được râu ông nọ cắm cằm bà kia (lấy chú thích của ảnh này gắn cho ảnh khác).
2. SỬ DỤNG THẺ FIGURE & FIGCAPTION: Bọc hình ảnh và chú thích ảnh bằng bộ thẻ <figure> và <figcaption> theo chuẩn HTML5. Đặt chú thích ảnh đã được dịch thuật chính xác vào thẻ <figcaption>.
3. THUỘC TÍNH ALT CƠ BẢN: Chỉ cần thêm mô tả ngắn gọn về ảnh vào thuộc tính alt (không cần quá chi tiết) để không làm loãng luồng xử lý chính.
4. KHỚP MÃ ID TUYỆT ĐỐI: Mã ID trong thuộc tính 'src' của thẻ <img> phải khớp CHÍNH XÁC từng ký tự với mã ID được cung cấp ở trên (ví dụ: [${imageIds}]).
5. KHÔNG TỰ TIỆN THÊM/BỚT: Tuyệt đối KHÔNG tự sáng tạo, phỏng đoán hay tự bịa ra bất kỳ mã ID nào khác không có trong danh sách trên. Không bỏ sót bất kỳ hình ảnh nào nếu nó thuộc trang nội dung đang được dịch.
</available_images_and_ids>\n`;
      finalPrompt += imageGuide;
    }

    // Clean up multiple newlines that might arise from empty replacements
    finalPrompt = finalPrompt.replace(/\n\s*\n\s*\n/g, '\n\n');
  } else {
    finalPrompt = `Translate the attached PDF document into Vietnamese HTML format. Maintain the formatting and layout. Do not add any conversational text.`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configArgs: any = {
    thinkingConfig: { thinkingLevel: 'HIGH' },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
  };

  if (systemInstruction) {
    configArgs.systemInstruction = systemInstruction;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentsPayload: any[] = [
    { text: finalPrompt }
  ];

  if (pdfBase64) {
    contentsPayload.push({
      inlineData: {
        data: pdfBase64,
        mimeType: 'application/pdf'
      }
    });
  }

  if (imagesToAttach && Object.keys(imagesToAttach).length > 0) {
    for (const [id, dataUrl] of Object.entries(imagesToAttach)) {
      if (!dataUrl) continue;
      const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
      
      contentsPayload.push({
        text: `This image has ID: ${id}`
      });
      contentsPayload.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: contentsPayload,
    config: configArgs
  });
  
  let result = response.text || '';
  
  // Remove formatting tokens if AI happens to return them wrapping the content
  if (result.startsWith('```html')) {
    result = result.replace(/^```html\n/, '').replace(/\n```$/, '');
  } else if (result.startsWith('```markdown')) {
    result = result.replace(/^```markdown\n/, '').replace(/\n```$/, '');
  } else if (result.startsWith('```')) {
    result = result.replace(/^```\n/, '').replace(/\n```$/, '');
  }
  
  // Restore image placeholders using activeImages map
  result = restoreImagePlaceholders(result, activeImages);

  return { text: result, customGlossary: activeGlossary || undefined, glossaryStatus, glossaryRatio, images: activeImages };
}

export async function summarizeTranslation(
  ai: GoogleGenAI,
  loadPromptText: (url: string) => Promise<string | null>,
  translatedText: string,
  model: string
): Promise<string> {
  try {
    if (!translatedText.trim()) return '';

    const markdownText = htmlToMarkdown(translatedText);

    const si = await loadPromptText('/prompts/summary_system_instruction.md');
    const p = await loadPromptText('/prompts/summary_prompt.md');

    const systemInstruction = si || 'You are an expert summarizer for a translation workflow. Your task is to summarize the provided translated chapter/block (Vietnamese text). The summary MUST be concise (not exceeding 10% of the original text length) and MUST focus on providing contextual information for translating the NEXT chapter/block (e.g., key plot progression, character state changes, new places, or important items mentioned). The summary MUST be in Vietnamese.';
    const promptTemplate = p || 'Hãy tóm tắt nội dung bản dịch dưới đây để làm thông tin bối cảnh (context) cho việc dịch phần tiếp theo. Yêu cầu:\n- Độ dài không vượt quá 10% nội dung gốc.\n- Tập trung vào các diễn biến chính, trạng thái nhân vật, địa điểm, hoặc sự kiện quan trọng có thể ảnh hưởng đến phần sau.\n\nNội dung bản dịch:\n{{nội dung}}';
    
    const finalPrompt = promptTemplate.replace('{{nội dung}}', markdownText);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configArgs: any = {
      systemInstruction: systemInstruction,
      thinkingConfig: { thinkingLevel: 'HIGH' },
      safetySettings: DEFAULT_SAFETY_SETTINGS,
    };

    const response = await ai.models.generateContent({
      model: model,
      contents: [ { text: finalPrompt } ],
      config: configArgs
    });
    
    return (response.text || '').trim();
  } catch (e) {
    console.error('Failed to summarize translation', e);
    return '';
  }
}

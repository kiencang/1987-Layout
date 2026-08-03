import { Injectable, inject } from '@angular/core';
import { PdfService } from '../../features/uploader/pdf.service';
import { Chapter } from './types';
import { extractImagesFromPdf } from '../image-processor.util';

interface SplitChunkItem {
  start: number;
  end: number;
  b64Data: string;
}

@Injectable({ providedIn: 'root' })
export class BookSplitter {
  private pdfService = inject(PdfService);

  async splitPdf(
    rawPdf: Uint8Array,
    startPage: number,
    endPage: number,
    chunkSize: number,
    totalPdfPages: number
  ): Promise<{ chapters: Chapter[]; images: Record<string, string> }> {
    // Safely copy rawPdf bytes into a fresh ArrayBuffer
    const originalArrayBuffer = new ArrayBuffer(rawPdf.byteLength);
    new Uint8Array(originalArrayBuffer).set(rawPdf);
    
    let finalArrayBuffer = originalArrayBuffer;
    let pdfDataToSave = new Uint8Array(originalArrayBuffer);

    // Extract pages if needed (cropped range)
    if (startPage > 1 || endPage < totalPdfPages) {
       const result = await this.pdfService.runWorkerTask('EXTRACT_PAGES', { arrayBuffer: originalArrayBuffer, start: startPage, end: endPage });
       if (result.b64Data) {
          const raw = window.atob(result.b64Data);
          const rawLength = raw.length;
          const array = new Uint8Array(new ArrayBuffer(rawLength));
          for (let i = 0; i < rawLength; i++) {
            array[i] = raw.charCodeAt(i);
          }
          pdfDataToSave = array;
          finalArrayBuffer = array.buffer;
       }
    }

    // Extract images from PDF using pdfjs-dist with 95% JPEG quality
    let extractedImages: Record<string, string> = {};
    try {
      const imageBuffer = pdfDataToSave.buffer.slice(pdfDataToSave.byteOffset, pdfDataToSave.byteOffset + pdfDataToSave.byteLength);
      extractedImages = await extractImagesFromPdf(imageBuffer, 1024, 0.95, {}, startPage);
    } catch (imgErr) {
      console.warn('Không thể trích xuất hình ảnh từ PDF:', imgErr);
    }
    
    const result = await this.pdfService.runWorkerTask('SPLIT_ALL_CHUNKS', { arrayBuffer: finalArrayBuffer, chunkSize });
    
    if (result.chunks && result.chunks.length > 0) {
      const chunks: Chapter[] = (result.chunks as SplitChunkItem[]).map((item, i) => ({
        id: `chapter_${i}_${Date.now()}`,
        order: i,
        title: `Phần ${i + 1} (Trang ${startPage + item.start - 1} - ${startPage + item.end - 1})`,
        originalText: '',
        originalPdfBase64: item.b64Data,
        originalPdfPages: item.end - item.start + 1,
        startPage: startPage + item.start - 1,
        endPage: startPage + item.end - 1,
        wordCount: 0,
        status: 'pending',
      }));

      return { chapters: chunks, images: extractedImages };
    } else {
      throw new Error('Không tạo được các phần PDF.');
    }
  }
}

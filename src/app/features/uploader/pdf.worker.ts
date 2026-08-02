/// <reference lib="webworker" />

import { PDFDocument } from 'pdf-lib';

addEventListener('message', async ({ data }) => {
  const { type, payload, id } = data;

  try {
    if (type === 'COUNT_PAGES') {
      const { arrayBuffer } = payload;
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const count = pdfDoc.getPageCount();
      postMessage({ type: 'SUCCESS', id, payload: { count } });
    } else if (type === 'EXTRACT_PAGES') {
      const { arrayBuffer, start, end } = payload;
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const totalPdfPages = pdfDoc.getPageCount();
      const validStart = Math.max(1, Math.min(start, totalPdfPages));
      const validEnd = Math.max(validStart, Math.min(end, totalPdfPages));
      
      const newPdf = await PDFDocument.create();
      const pageIndices = Array.from({ length: validEnd - validStart + 1 }, (_, i) => validStart - 1 + i);
      const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach((page) => newPdf.addPage(page));
      
      const b64Data = await newPdf.saveAsBase64();
      postMessage({ type: 'SUCCESS', id, payload: { b64Data } });
    } else if (type === 'SPLIT_ALL_CHUNKS') {
      const { arrayBuffer, chunkSize } = payload;
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const totalPages = pdfDoc.getPageCount();
      const totalChunks = Math.ceil(totalPages / chunkSize);
      const chunks: { order: number; start: number; end: number; b64Data: string }[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize + 1;
        const end = Math.min((i + 1) * chunkSize, totalPages);
        const newPdf = await PDFDocument.create();
        const pageIndices = Array.from({ length: end - start + 1 }, (_, k) => start - 1 + k);
        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));
        const b64Data = await newPdf.saveAsBase64();
        chunks.push({ order: i, start, end, b64Data });
      }

      postMessage({ type: 'SUCCESS', id, payload: { chunks } });
    }

  } catch (error) {
    postMessage({ type: 'ERROR', id, payload: { error: error instanceof Error ? error.message : String(error) } });
  }
});

import { Injectable } from '@angular/core';

export interface PdfWorkerResult {
  count?: number;
  b64Data?: string;
  resultType?: string;
  chunks?: { order: number; start: number; end: number; b64Data: string; index?: number; pdfData?: Uint8Array; }[];
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private pdfWorker = new Worker(new URL('./pdf.worker', import.meta.url), { type: 'module' });
  private workerId = 0;

  runWorkerTask(type: string, payload: unknown): Promise<PdfWorkerResult> {
    return new Promise((resolve, reject) => {
      const id = ++this.workerId;
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          this.pdfWorker.removeEventListener('message', handler);
          if (event.data.type === 'SUCCESS') {
            resolve(event.data.payload);
          } else {
            reject(new Error(event.data.payload?.error || 'Worker error'));
          }
        }
      };
      this.pdfWorker.addEventListener('message', handler);
      let safePayload = payload;
      if (payload && typeof payload === 'object' && payload !== null && 'arrayBuffer' in payload) {
        const p = payload as { arrayBuffer?: unknown };
        if (p.arrayBuffer instanceof ArrayBuffer) {
          safePayload = { ...p, arrayBuffer: p.arrayBuffer.slice(0) };
        }
      }

      this.pdfWorker.postMessage({ type, payload: safePayload, id });
    });
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  async uint8ArrayToBase64(uint8Array: Uint8Array): Promise<string> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([uint8Array as unknown as BlobPart], { type: 'application/pdf' });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

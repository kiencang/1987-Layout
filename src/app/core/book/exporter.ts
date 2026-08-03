import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Project } from '../db';
import { Chapter } from './types';
import { ToastService } from '../toast.service';
import { generateCombinedMarkdown, generatePdfHtmlDoc, generateHtmlDoc } from '../html-export.util';

interface WindowWithSilaImages {
  __SILA_IMAGES__?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class BookExporter {
  private platformId = inject(PLATFORM_ID);
  private toastService = inject(ToastService);

  async exportToPdf(
    name: string,
    chapters: Chapter[],
    images: Record<string, string> | undefined,
    project?: Project
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // Preserve original __SILA_IMAGES__ for runtime renderers
    let tempImages: Record<string, string> | undefined;
    const win = typeof window !== 'undefined' ? (window as unknown as WindowWithSilaImages) : undefined;
    if (win) {
      tempImages = win.__SILA_IMAGES__;
      if (project) {
        win.__SILA_IMAGES__ = project.images;
      }
    }

    try {
      let combinedMarkdown = '';
      try {
        combinedMarkdown = generateCombinedMarkdown(chapters, images);
      } finally {
        if (project && win) {
          win.__SILA_IMAGES__ = tempImages;
        }
      }
      const htmlDoc = generatePdfHtmlDoc(name, combinedMarkdown);

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        this.toastService.error('Vui lòng cho phép popup để nhận PDF');
        return;
      }
      this.toastService.success('Đang tạo bản PDF chuẩn bị tải...');
    } catch (e: unknown) {
      console.error('Error opening PDF print:', e);
      this.toastService.error('Lỗi khi tải PDF');
    }
  }

  async exportToHtml(
    name: string,
    chapters: Chapter[],
    images: Record<string, string> | undefined,
    project?: Project
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // Preserve original __SILA_IMAGES__ for runtime renderers
    let tempImages: Record<string, string> | undefined;
    const win = typeof window !== 'undefined' ? (window as unknown as WindowWithSilaImages) : undefined;
    if (win) {
      tempImages = win.__SILA_IMAGES__;
      if (project) {
        win.__SILA_IMAGES__ = project.images;
      }
    }

    try {
      let combinedMarkdown = '';
      try {
        combinedMarkdown = generateCombinedMarkdown(chapters, images);
      } finally {
        if (project && win) {
          win.__SILA_IMAGES__ = tempImages;
        }
      }
      const htmlDoc = generateHtmlDoc(name, combinedMarkdown);

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}_1987-Layout_vi.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toastService.success(this.toastService.Messages.EXPORT_HTML_SUCCESS);
    } catch (e: unknown) {
      console.error('Error exporting to HTML:', e);
      this.toastService.error(this.toastService.Messages.EXPORT_HTML_ERROR);
    }
  }
}

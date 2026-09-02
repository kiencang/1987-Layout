import { Component, computed, inject, signal, ViewChildren, QueryList } from '@angular/core';
import { BookStore, Chapter, TranslationVersion } from '../../core/book.store';
import { ToastService } from '../../core/toast.service';
import { GeminiClient, parseGeminiError, isQuotaError } from '../../core/gemini';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { TranslatorConfigComponent } from './components/translator-config';
import { ChapterItemComponent } from './components/chapter-item';
import JSZip from 'jszip';

@Component({
  selector: 'app-translator',
  standalone: true,
  imports: [MatIconModule, FormsModule, TranslatorConfigComponent, ChapterItemComponent],
  template: `
    <div class="max-w-6xl mx-auto py-8 px-4">
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-3xl font-bold text-zinc-900">Dịch thuật</h2>
            <p class="text-zinc-500 mt-1">Đã sẵn sàng dịch {{ store.chapters().length }} phần của "{{ store.fileName() }}".</p>
          </div>
        </div>
        <div class="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex gap-3 text-sm text-indigo-900 w-full">
          <mat-icon class="text-indigo-500 shrink-0">lightbulb</mat-icon>
          <div class="space-y-2">
            <p>Dịch file PDF có nhiều ảnh tương đối phức tạp, bạn nên sử dụng <strong>model Pro</strong> trong quá trình dịch để đạt kết quả tốt nhất có thể. Nếu dùng model Flash, chỉ dùng nó trên các nội dung không quá khó. Ngoài ra dù lựa chọn của bạn là gì, luôn đọc song song bản dịch với bản gốc để tiện đối chiếu, dễ phát hiện các sai sót.</p>
            <p>Nếu hết ngưỡng miễn phí sớm, bạn có thể xuất dự án (ở mục "Quản lý dự án") và nhập lại dự án vào tài khoản miễn phí khác để tiếp tục tận dụng ngưỡng miễn phí trong ngày (thay vì phải dùng API Key trả phí tốn kém).</p>
            <p>Nếu bạn đã tạo bảng "Thuật ngữ - Từ khó" hoặc/và bảng "Đại từ nhân xưng", nhớ tích hợp chúng vào trong quá trình dịch bằng cách tick tùy chọn "Kích hoạt..."</p>
          </div>
        </div>
      </div>

      <!-- Config Panel -->
      <app-translator-config />

      <!-- Action area -->
      <div class="mb-4 flex justify-between items-start w-full">
        <div class="flex gap-4 items-center">
          @if (translateOperation() !== 'none') {
            <div class="flex items-center space-x-2">
              <div class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg font-medium shadow-sm flex items-center space-x-2">
                <mat-icon class="animate-spin">sync</mat-icon>
                @if (translateOperation() === 'retranslate') {
                  <span>Đang dịch lại toàn bộ sách...</span>
                } @else if (translateOperation() === 'all') {
                  <span>Đang khởi tạo bản dịch...</span>
                } @else {
                  <span>Đang dịch các phần chưa dịch...</span>
                }
              </div>
              <button 
                (click)="stopRequested.set(true)"
                [disabled]="stopRequested()"
                class="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center"
              >
                <span>{{ stopRequested() ? 'Đang dừng...' : 'Dừng dịch' }}</span>
              </button>
            </div>
          } @else if (confirmAction() !== 'none') {
            <div class="flex items-center space-x-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg border border-red-100 shadow-sm transition-all duration-200">
              <span class="text-sm font-medium">
                @if (confirmAction() === 'retranslate') {
                  Bạn có chắc muốn dịch lại từ đầu? Lựa chọn này sẽ tốn thời gian & Token.
                } @else if (confirmAction() === 'all') {
                  Bạn có chắc muốn dịch toàn bộ cuốn sách? Lựa chọn này sẽ tốn thời gian & Token.
                } @else {
                  Bạn có chắc muốn dịch các phần chưa dịch? Lựa chọn này sẽ tốn thời gian & Token.
                }
              </span>
              <div class="flex items-center space-x-2 border-l border-red-200 pl-3">
                <button (click)="executeConfirmedAction()" class="text-sm font-bold hover:text-red-900 transition-colors">Đồng ý</button>
                <button (click)="confirmAction.set('none')" class="text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors">Hủy</button>
              </div>
            </div>
          } @else if (translationState() === 'all') {
            <button 
              (click)="confirmAction.set('retranslate')"
              [disabled]="store.isTranslatingAny()"
              [class.opacity-50]="store.isTranslatingAny()"
              [class.cursor-not-allowed]="store.isTranslatingAny()"
              class="bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center space-x-2"
            >
              <mat-icon>refresh</mat-icon>
              <span>Dịch lại toàn bộ cuốn sách</span>
            </button>
          } @else if (translationState() === 'none') {
            <button 
              (click)="confirmAction.set('all')"
              [disabled]="store.isTranslatingAny()"
              [class.opacity-50]="store.isTranslatingAny()"
              [class.cursor-not-allowed]="store.isTranslatingAny()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center space-x-2 disabled:hover:bg-indigo-600"
            >
              <mat-icon>translate</mat-icon>
              <span>Dịch toàn bộ cuốn sách</span>
            </button>
          } @else {
            <button 
              (click)="confirmAction.set('untranslated')"
              [disabled]="store.isTranslatingAny()"
              [class.opacity-50]="store.isTranslatingAny()"
              [class.cursor-not-allowed]="store.isTranslatingAny()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center space-x-2 disabled:hover:bg-indigo-600"
            >
              <mat-icon>translate</mat-icon>
              <span>Dịch tất cả các phần chưa dịch</span>
            </button>
          }
        </div>

        @if (canDownloadAll()) {
          <button 
            (click)="downloadAllAsZip()"
            [disabled]="store.isTranslatingAny()"
            [class.opacity-50]="store.isTranslatingAny()"
            [class.cursor-not-allowed]="store.isTranslatingAny()"
            class="bg-emerald-600 hover:bg-emerald-750 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center space-x-2 shrink-0 self-center"
          >
            <mat-icon>file_download</mat-icon>
            <span>Tải về toàn bộ sách</span>
          </button>
        }
      </div>

      <!-- Chapter List -->
      <div class="space-y-4">
        @for (chapter of store.chapters(); track chapter.id; let i = $index) {
          <app-chapter-item 
            [chapter]="chapter" 
            [index]="i" 
            [(isExpanded)]="expanded[chapter.id]"
            (translateSingle)="translateSingle(chapter)" 
            (requestNavigate)="handleNavigate($event)"
          />
        }
      </div>
    </div>
  `
})
export class Translator {
  store = inject(BookStore);
  gemini = inject(GeminiClient);
  toast = inject(ToastService);
  
  @ViewChildren(ChapterItemComponent) chapterItems!: QueryList<ChapterItemComponent>;

  expanded: Record<string, boolean> = {};

  confirmAction = signal<'none' | 'retranslate' | 'all' | 'untranslated'>('none');
  stopRequested = signal(false);
  translateOperation = signal<'none' | 'all' | 'retranslate' | 'untranslated'>('none');

  translationState = computed(() => {
    const chapters = this.store.chapters();
    if (chapters.length === 0) return 'none';
    const doneCount = chapters.filter(c => c.status === 'done').length;
    if (doneCount === 0) return 'none';
    if (doneCount === chapters.length) return 'all';
    return 'partial';
  });

  canDownloadAll = computed(() => {
    const chapters = this.store.chapters();
    if (chapters.length === 0) return false;
    const activeChapters = chapters.filter(c => !c.excludeFromTranslation);
    if (activeChapters.length === 0) return false;
    return activeChapters.every(c => c.status === 'done' && !!c.translatedText);
  });

  handleNavigate(index: number) {
    const items = this.chapterItems.toArray();
    if (items[index]) {
      items[index].openFullscreen();
    }
  }

  async downloadAllAsZip() {
    const chapters = this.store.chapters().filter(c => !c.excludeFromTranslation && c.status === 'done' && !!c.translatedText);
    if (chapters.length === 0) {
      this.toast.error('Không tìm thấy nội dung bản dịch nào để tải về.');
      return;
    }

    try {
      const zip = new JSZip();
      
      const bookTitle = this.store.bookTitle() || 'Ban_dich_sach';
      const sanitizedBookTitle = bookTitle.replace(/[\\/:*?"<>|]/g, '_');

      // 1. Thêm các file HTML rời vào thư mục con
      chapters.forEach((chapter, index) => {
        const sanitizedTitle = chapter.title.replace(/[\\/:*?"<>|]/g, '_');
        const filename = `${String(index + 1).padStart(2, '0')} - ${sanitizedTitle}.html`;
        zip.file(`chunks/${filename}`, chapter.translatedText || '');
      });

      // 2. Tạo file Master HTML gộp tất cả
      let masterBodyContent = '';
      
      chapters.forEach((chapter, index) => {
        let html = chapter.translatedText || '';
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        let bodyContent = bodyMatch ? bodyMatch[1] : html;
        
        if (index > 0) {
           masterBodyContent += `\n<div style="page-break-before: always; break-before: page;"></div>\n`;
        }
        masterBodyContent += bodyContent;
      });

      let headContent = '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + sanitizedBookTitle + '</title>';
      const headMatch = (chapters[0].translatedText || '').match(/<head[^>]*>([\s\S]*)<\/head>/i);
      if (headMatch) {
         headContent = headMatch[1];
      }

      let bodyAttr = '';
      const bodyTagMatch = (chapters[0].translatedText || '').match(/<body([^>]*)>/i);
      if (bodyTagMatch) {
         bodyAttr = bodyTagMatch[1];
      }

      const masterHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
${headContent}
</head>
<body${bodyAttr}>
${masterBodyContent}
</body>
</html>`;

      // Lưu file HTML tổng ra thư mục gốc của zip
      zip.file(`${sanitizedBookTitle}_Toan_tap.html`, masterHtml);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `1987-Layout_${sanitizedBookTitle}_ban_dich.zip`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.toast.success('Đã tải về toàn bộ sách dưới dạng tệp ZIP thành công!');
    } catch (error) {
      console.error('Lỗi khi nén file zip:', error);
      this.toast.error('Có lỗi xảy ra khi tạo tệp ZIP tải về.');
    }
  }

  async translateSingle(chapter: Chapter): Promise<boolean> {
    const startProjectId = this.store.currentProjectId();
    
    const userKey = localStorage.getItem('user_gemini_api_key');
    if (!userKey?.trim()) {
      this.toast.error('Vui lòng thêm GEMINI API KEY CÁ NHÂN (biểu tượng chìa khóa ở góc trái dưới cùng màn hình) trước khi dịch.');
      return false;
    }

    if (!chapter.originalPdfBase64 || !chapter.originalPdfBase64.trim()) {
      this.toast.error('Thiếu file PDF để dịch.');
      return false;
    }

    this.store.updateChapter(chapter.id, { status: 'translating' });
    this.expanded[chapter.id] = true;
    
    try {
      const config = this.store.config();
      const chapters = this.store.chapters() || [];

      const chapterIndex = chapters.findIndex(c => c.id === chapter.id);
      let contextSummarySnapshot: string | undefined = undefined;
      let contextSummaryChapterTitle: string | undefined = undefined;
      
      if (config.generateSummary !== false && chapterIndex > 0) {
        const prevChapter = chapters[chapterIndex - 1];
        if (prevChapter) {
            const activeVersionNumber = prevChapter.activeVersionNumber || prevChapter.latestVersionNumber;
            if (activeVersionNumber) {
              const activeVersion = prevChapter.versions?.find(v => v.versionNumber === activeVersionNumber);
              if (activeVersion && activeVersion.summary) {
                contextSummarySnapshot = activeVersion.summary;
                contextSummaryChapterTitle = prevChapter.title;
              }
            }
        }
      }

      let startPage = chapter.startPage;
      let endPage = chapter.endPage;
      if (startPage === undefined || endPage === undefined) {
        if (chapter.title) {
          const match = chapter.title.match(/Trang\s+(\d+)\s*-\s*(\d+)/i);
          if (match) {
            startPage = parseInt(match[1], 10);
            endPage = parseInt(match[2], 10);
          }
        }
      }

const { text: translatedText, customGlossary, glossaryStatus, glossaryRatio, images: updatedImages } = await this.gemini.translateChapter(
        chapter.originalPdfBase64 || '', 
        config.model, 
        this.store.bookTitle(),
        this.store.author(),
        this.store.pronounTable(),
        this.store.usePronouns(),
        this.store.glossaryTable(),
        this.store.useGlossary(),
        contextSummarySnapshot,
        this.store.customInstructions(),
        this.store.images(),
        config.translationStyle || 'general_science',
        startPage,
        endPage,
        startProjectId || ""
      );
      
      if (this.store.currentProjectId() !== startProjectId) {
        console.warn('Dự án đã bị thay đổi trong quá trình dịch, hủy bỏ kết quả.');
        return false;
      }
      
      // Update store with any newly discovered images
      if (updatedImages && Object.keys(updatedImages).length > 0) {
        const currentImages = this.store.images() || {};
        this.store.setImages({ ...currentImages, ...updatedImages });
      }
      
      const isLastChapter = chapterIndex >= 0 && chapterIndex === chapters.length - 1;
      let summaryText: string | undefined = undefined;
      if (config.generateSummary !== false && !isLastChapter) {
        summaryText = await this.gemini.summarizeTranslation(translatedText, config.model);
      }
      
      const newVersionNumber = (chapter.latestVersionNumber || 0) + 1;
      const newVersion: TranslationVersion = {
        versionNumber: newVersionNumber,
        text: translatedText,
        model: config.model,
        timestamp: Date.now(),
        translationStyle: config.translationStyle || 'general_science',
        customGlossary: customGlossary,
        glossaryStatus: glossaryStatus,
        glossaryRatio: glossaryRatio,
        summary: summaryText,
        usePronouns: this.store.usePronouns(),
        pronounSnapshot: this.store.usePronouns() ? this.store.pronounTable() : undefined,
        pronounVersionNumber: this.store.usePronouns() ? this.store.activePronounVersionNumber() : undefined,
        useGlossary: this.store.useGlossary(),
        glossaryVersionNumber: this.store.useGlossary() ? this.store.activeGlossaryVersionNumber() : undefined,
        useContextSummary: !!contextSummarySnapshot,
        contextSummarySnapshot: contextSummarySnapshot,
        contextSummaryChapterTitle: contextSummaryChapterTitle,
        useCustomInstructions: !!this.store.customInstructions(),
        customInstructionsSnapshot: this.store.customInstructions() || undefined,
      };
      
      const versions = [...(chapter.versions || []), newVersion].slice(-3);
      
      this.store.updateChapter(chapter.id, { 
        status: 'done',
        translatedText: translatedText,
        versions: versions,
        latestVersionNumber: newVersionNumber,
        activeVersionNumber: newVersionNumber
      });
      return true;
    } catch (e: unknown) {
      if (!isQuotaError(e)) {
        console.error(e);
      }
      this.store.updateChapter(chapter.id, { status: 'error' });
      this.toast.error(this.toast.Messages.TRANSLATION_ERROR(chapter.title, parseGeminiError(e)));
      
      const msg = (e as Error)?.message || e?.toString() || '';
      const lowerMsg = msg.toLowerCase();
      if (lowerMsg.includes('quota') || lowerMsg.includes('429') || 
          lowerMsg.includes('api key') || lowerMsg.includes('403') || lowerMsg.includes('permission_denied')) {
        return false;
      }
      return true;
    }
  }

  executeConfirmedAction() {
    const action = this.confirmAction();
    if (action === 'none') return;
    this.executeTranslateAll(action === 'retranslate');
  }

  async executeTranslateAll(forceAll: boolean) {
    const userKey = localStorage.getItem('user_gemini_api_key');
    if (!userKey?.trim()) {
      this.toast.error('Vui lòng thêm GEMINI API KEY CÁ NHÂN (biểu tượng chìa khóa ở góc trái dưới cùng màn hình) trước khi dịch chức năng này.');
      this.confirmAction.set('none');
      return;
    }

    this.confirmAction.set('none');
    this.stopRequested.set(false);
    
    let toTranslate = this.store.chapters().filter(c => !c.excludeFromTranslation);
    if (forceAll) {
      this.translateOperation.set('retranslate');
    } else {
      const isCompletelyNew = toTranslate.every(c => c.status === 'pending');
      this.translateOperation.set(isCompletelyNew ? 'all' : 'untranslated');
      toTranslate = toTranslate.filter(c => c.status === 'pending' || c.status === 'error');
    }

    if (toTranslate.length === 0) {
      this.translateOperation.set('none');
      return;
    }

    try {
      for (const chapter of toTranslate) {
        if (this.stopRequested()) {
          this.toast.info('Đã dừng dịch thuật hàng loạt theo yêu cầu.');
          break;
        }
        // Do it sequentially to avoid rate limiting
        const shouldContinue = await this.translateSingle(chapter);
        if (!shouldContinue) {
          this.stopRequested.set(true);
          this.toast.error('Tiến trình dịch tự động đã dừng lại do lỗi nghiêm trọng (ví dụ: hết Quota miễn phí hoặc sai API Key).');
          break;
        }
      }
      if (!this.stopRequested()) {
        this.toast.success(this.toast.Messages.TRANSLATION_COMPLETED);
      }
    } finally {
      this.translateOperation.set('none');
      this.stopRequested.set(false);
    }
  }
}


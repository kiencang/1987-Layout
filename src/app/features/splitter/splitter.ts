import { Component, computed, inject, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BookStore } from '../../core/book.store';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/toast.service';
import { PdfService } from '../uploader/pdf.service';
import { DbService } from '../../core/db';
import { GeminiClient } from '../../core/gemini';
import { BookSplitter } from '../../core/book/splitter';

@Component({
  selector: 'app-splitter',
  standalone: true,
  imports: [
    MatIconModule,
    FormsModule
  ],
  template: `
    <div class="max-w-4xl mx-auto py-8">
      <div class="flex items-center justify-between gap-4 mb-8">
        <div class="min-w-0">
          <h2 class="text-2xl font-bold text-zinc-900 truncate">Chia sách thành các phần nhỏ</h2>
          <p class="text-zinc-500 mt-1 truncate" title="Chia nhỏ PDF để dịch">Tài liệu: {{ store.fileName() }} ({{ store.pdfPageCount() || 0 }} trang)</p>
        </div>
      </div>

      @if (store.hasAnyTranslation()) {
        <div class="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 rounded-r-xl shadow-sm">
          <div class="flex items-center">
            <div class="flex-shrink-0 flex items-center justify-center">
              <mat-icon class="text-amber-500 !text-[20px] !w-5 !h-5 flex items-center justify-center !leading-none">warning</mat-icon>
            </div>
            <div class="ml-3 flex items-center">
              <p class="text-sm text-amber-800 font-medium leading-snug">
                Việc chia lại chương bị vô hiệu hóa do dự án đã có nội dung đã được dịch.
              </p>
            </div>
          </div>
        </div>
      }

      @if (store.rawPdf()) {
        <div class="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 mb-6 transition-opacity duration-300" [class.opacity-50]="store.hasAnyTranslation() || isProcessing()" [class.pointer-events-none]="store.hasAnyTranslation() || isProcessing()">
          <h3 class="text-lg font-semibold text-zinc-900 mb-2 flex items-center gap-2">
            <mat-icon class="text-indigo-600 !w-[22px] !h-[22px] !text-[22px]">content_cut</mat-icon>
            <span>Cắt giảm số lượng trang của sách (tùy chọn)</span>
          </h3>
          <p class="text-sm text-zinc-500 mb-4">Chọn khoảng trang cần dịch (Tổng số trang tài liệu gốc: <strong>{{ store.pdfPageCount() || 0 }}</strong> trang). Nếu bạn không có nhu cầu giảm số lượng trang, hãy cứ <strong>giữ nguyên toàn bộ cuốn sách</strong>. Ứng dụng không giới hạn số lượng trang, nhưng dung lượng cả file không quá 200MB và tổng token đầu vào không quá 1.5 triệu token. Hai giá trị này thường đủ cho các cuốn sách cả ngàn trang.</p>

          <div class="flex items-center gap-3 max-w-md mb-6">
            <div class="flex-1 flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-sm focus-within:border-indigo-500 transition-colors">
              <span class="text-sm text-zinc-500 w-8">Từ</span>
              <input type="number" min="1" [max]="pdfEndPage() || store.pdfPageCount() || 1" [(ngModel)]="pdfStartPage" class="w-full text-center outline-none bg-transparent font-medium text-zinc-800">
            </div>
            <span class="text-zinc-300 font-medium">-</span>
            <div class="flex-1 flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-sm focus-within:border-indigo-500 transition-colors">
              <span class="text-sm text-zinc-500 w-8">Đến</span>
              <input type="number" [min]="pdfStartPage()" [max]="store.pdfPageCount() || 1" [(ngModel)]="pdfEndPage" class="w-full text-center outline-none bg-transparent font-medium text-zinc-800">
            </div>
          </div>

          <!-- Ước tính token đầu vào -->
          <div class="pt-4 border-t border-zinc-200/80">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2">
              <span class="text-zinc-600 flex items-center gap-1.5 normal-case font-medium text-sm">
                <mat-icon class="!w-4 !h-4 !text-[16px] text-indigo-500">token</mat-icon>
                Ước tính Token đầu vào
              </span>
              @if (isCountingTokens()) {
                <span class="text-indigo-600 flex items-center gap-1 font-medium normal-case text-xs">
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px] animate-spin">autorenew</mat-icon> Đang đếm...
                </span>
              } @else if (tokenCountError()) {
                <div class="flex items-center gap-2">
                  <span class="text-red-500 font-normal text-xs normal-case">{{ tokenCountError() }}</span>
                  <button (click)="calculateTokens()" class="text-indigo-600 hover:text-indigo-700 underline font-medium text-xs normal-case cursor-pointer">Thử lại</button>
                </div>
              } @else if (tokenCount() !== null) {
                <div class="flex items-center gap-2">
                  <span [class.text-amber-600]="(tokenCount() || 0) > 1000000" [class.text-red-500]="(tokenCount() || 0) > 1500000" class="text-emerald-600 font-bold text-xs normal-case">
                    {{ formattedTokenCount() }} / 1.5M tokens
                  </span>
                  <button (click)="calculateTokens()" class="text-zinc-400 hover:text-indigo-600 transition-colors p-0.5 rounded cursor-pointer" title="Tính lại token">
                    <mat-icon class="!w-4 !h-4 !text-[16px]">refresh</mat-icon>
                  </button>
                </div>
              } @else {
                <button (click)="calculateTokens()" 
                        class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs">
                  <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">calculate</mat-icon>
                  Tính token đầu vào
                </button>
              }
            </div>

            @if (tokenCount() !== null || isCountingTokens()) {
              <div class="h-2 w-full bg-zinc-200 rounded-full overflow-hidden mt-2">
                @if (isCountingTokens()) {
                  <div class="h-full bg-indigo-500/60 w-full animate-pulse transition-all"></div>
                } @else {
                  <div class="h-full transition-all duration-500"
                       [class.bg-emerald-500]="(tokenCount() || 0) <= 1000000"
                       [class.bg-amber-500]="(tokenCount() || 0) > 1000000 && (tokenCount() || 0) <= 1500000"
                       [class.bg-red-500]="(tokenCount() || 0) > 1500000"
                       [style.width.%]="tokenPercentage()">
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <div class="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 mb-8 transition-opacity duration-300" [class.opacity-50]="store.hasAnyTranslation() || isProcessing()" [class.pointer-events-none]="store.hasAnyTranslation() || isProcessing()">
        <h3 class="text-lg font-semibold text-zinc-900 mb-2">Cài đặt chia sách</h3>
        
        <div class="w-full">
          <p class="text-sm text-zinc-500 mb-4">Ứng dụng sẽ <strong>chia cuốn sách thành nhiều phần nhỏ</strong>, mỗi phần sẽ có số lượng trang như bạn chọn bên dưới, mặc định 20 trang thường ổn, tuy nhiên bạn có thể điều chỉnh tăng giảm nếu muốn. Các cuốn sách nhiều ảnh hoặc/và có cấu trúc phức tạp, giá trị này để thấp hơn đôi chút có thể sẽ tốt hơn.</p>
          <label for="pagesPerChunkInput" class="block text-sm font-medium text-zinc-700 mb-2">Số trang mỗi phần (chunk):</label>
          <div class="flex items-center gap-3 max-w-xs">
            <div class="flex-1 flex items-center bg-white border border-zinc-200 rounded-lg px-3 py-2 shadow-sm focus-within:border-indigo-500 transition-colors">
              <input id="pagesPerChunkInput" type="number" min="10" max="25" [(ngModel)]="pagesPerChunk" (blur)="normalizePagesPerChunk()" class="w-full outline-none bg-transparent font-medium text-zinc-800">
            </div>
            <span class="text-zinc-500 text-sm">trang</span>
          </div>
          <p class="text-xs text-zinc-500 mt-2 leading-relaxed">
            Dự kiến sách được chia thành: <strong>{{ expectedChunks() }}</strong> phần<br>
            <span class="text-zinc-400">Cho phép điều chỉnh ngưỡng chia từ 10 - 25 trang</span>
          </p>
        </div>
      </div>

      <div class="flex justify-end pt-4 border-t border-zinc-200">
        @if (store.hasAnyTranslation()) {
          <button 
            (click)="applySplit()"
            [disabled]="isProcessing()"
            class="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm cursor-pointer"
          >
            <span>Tiếp tục</span>
            <mat-icon class="!w-5 !h-5 !text-[20px] !flex !items-center !justify-center">arrow_forward</mat-icon>
          </button>
        } @else {
          <button 
            (click)="applySplit()"
            [disabled]="isProcessing() || expectedChunks() < 1"
            class="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm cursor-pointer"
          >
            @if (isProcessing()) {
              <mat-icon class="animate-spin !w-5 !h-5 !text-[20px] !flex !items-center !justify-center">autorenew</mat-icon>
              <span>Đang xử lý...</span>
            } @else {
              <mat-icon class="!w-5 !h-5 !text-[20px] !flex !items-center !justify-center">check_circle</mat-icon>
              <span>Áp dụng chia & Tiếp tục</span>
            }
          </button>
        }
      </div>
    </div>
  `
})
export class Splitter {
  store = inject(BookStore);
  toast = inject(ToastService);
  pdfService = inject(PdfService);
  db = inject(DbService);
  gemini = inject(GeminiClient);
  splitter = inject(BookSplitter);

  pagesPerChunk = signal(20);
  isProcessing = signal(false);
  pdfStartPage = signal<number>(1);
  pdfEndPage = signal<number>(0);

  tokenCount = signal<number | null>(null);
  isCountingTokens = signal<boolean>(false);
  tokenCountError = signal<string | null>(null);

  private countTokensTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const chs = this.store.chapters();
      if (chs && chs.length > 0) {
        if (chs[0].startPage) {
          this.pdfStartPage.set(chs[0].startPage);
        }
        if (chs[chs.length - 1].endPage) {
          this.pdfEndPage.set(chs[chs.length - 1].endPage!);
        }
        const chunkPageCount = chs[0].originalPdfPages || (chs[0].endPage && chs[0].startPage ? chs[0].endPage - chs[0].startPage + 1 : 0);
        if (chunkPageCount >= 10 && chunkPageCount <= 25) {
          this.pagesPerChunk.set(chunkPageCount);
        }
      } else {
        const count = this.store.pdfPageCount();
        if (count && this.pdfEndPage() === 0) {
          this.pdfEndPage.set(count);
        }
      }

      // Reset token calculation state when page selection or PDF changes
      this.pdfStartPage();
      this.pdfEndPage();
      this.store.rawPdf();

      this.tokenCount.set(null);
      this.tokenCountError.set(null);
    });
  }

  formattedTokenCount(): string {
    const count = this.tokenCount() || 0;
    if (count === 0) return '0';
    if (count < 1000) return count.toString();
    return Math.round(count / 1000) + 'K';
  }

  tokenPercentage(): number {
    const count = this.tokenCount() || 0;
    return Math.min(100, Math.max(0, (count / 1500000) * 100));
  }

  triggerTokenCount() {
    clearTimeout(this.countTokensTimeout);
    this.countTokensTimeout = setTimeout(() => {
      this.calculateTokens();
    }, 600);
  }

  async calculateTokens() {
    let rawPdf = this.store.rawPdf();
    if (!rawPdf || rawPdf.byteLength === 0) {
      const projectId = this.store.currentProjectId();
      if (projectId) {
        const proj = await this.db.getProject(projectId);
        if (proj?.rawPdf && proj.rawPdf.byteLength > 0) {
          rawPdf = proj.rawPdf;
        }
      }
    }

    if (!rawPdf || rawPdf.byteLength === 0) {
      this.tokenCount.set(null);
      return;
    }

    const totalPages = this.store.pdfPageCount() || 0;
    const start = Math.max(1, this.pdfStartPage());
    const end = Math.min(totalPages, this.pdfEndPage() || totalPages);

    if (start > end || totalPages === 0) {
      this.tokenCount.set(0);
      return;
    }

    this.isCountingTokens.set(true);
    this.tokenCountError.set(null);

    try {
      const arrayBuffer = new ArrayBuffer(rawPdf.byteLength);
      new Uint8Array(arrayBuffer).set(rawPdf);

      const result = await this.pdfService.runWorkerTask('EXTRACT_PAGES', { arrayBuffer, start, end });
      if (result.b64Data) {
        const count = await this.gemini.countTokens(result.b64Data, 'application/pdf', 'gemini-flash-lite-latest');
        this.tokenCount.set(count);
      } else {
        this.tokenCountError.set('Không thể trích xuất trang');
      }
    } catch (e) {
      console.error('Lỗi khi đếm token:', e);
      this.tokenCountError.set('Không thể đếm Token');
    } finally {
      this.isCountingTokens.set(false);
    }
  }

  normalizePagesPerChunk() {
    const val = this.pagesPerChunk();
    if (val === null || val === undefined || isNaN(val) || val < 10) {
      this.pagesPerChunk.set(10);
    } else if (val > 25) {
      this.pagesPerChunk.set(25);
    }
  }

  expectedChunks = computed(() => {
    let totalPages = this.store.pdfPageCount() || 0;
    if (this.store.rawPdf() && this.pdfEndPage() > 0) {
      totalPages = Math.max(0, this.pdfEndPage() - this.pdfStartPage() + 1);
    }
    const size = Math.max(10, Math.min(25, this.pagesPerChunk() || 20));
    if (totalPages <= 0) return 0;
    return Math.ceil(totalPages / size);
  });

  async applySplit() {
    if (this.store.hasAnyTranslation()) {
      this.store.phase.set(3);
      return;
    }

    this.normalizePagesPerChunk();

    let rawPdf = this.store.rawPdf();
    
    // Check if rawPdf is detached or empty
    let isDetached = false;
    if (!rawPdf || rawPdf.byteLength === 0) {
      isDetached = true;
    } else {
      try {
        if (rawPdf.buffer.byteLength === 0) {
          isDetached = true;
        }
      } catch {
        isDetached = true;
      }
    }

    // If detached, try restoring from IndexedDB asset store
    if (isDetached) {
      const projectId = this.store.currentProjectId();
      if (projectId) {
        const proj = await this.db.getProject(projectId);
        if (proj?.rawPdf && proj.rawPdf.byteLength > 0) {
          rawPdf = proj.rawPdf;
          this.store.rawPdf.set(rawPdf);
        }
      }
    }

    if (!rawPdf || rawPdf.byteLength === 0) {
      this.toast.error('Không tìm thấy dữ liệu PDF (vui lòng chọn lại file PDF ở Bước 1).');
      return;
    }

    const chunkSize = this.pagesPerChunk();
    if (chunkSize < 1) {
      this.toast.error('Số trang mỗi phần phải lớn hơn 0.');
      return;
    }

    this.isProcessing.set(true);

    try {
      const totalPdfPages = this.store.pdfPageCount() || 1;
      const start = Math.max(1, this.pdfStartPage());
      const end = Math.min(totalPdfPages, this.pdfEndPage() || totalPdfPages);

      if (start > end) {
        this.toast.error('Trang bắt đầu không thể lớn hơn trang kết thúc.');
        this.isProcessing.set(false);
        return;
      }

      const { chapters, images } = await this.splitter.splitPdf(
        rawPdf,
        start,
        end,
        chunkSize,
        totalPdfPages
      );

      if (Object.keys(images).length > 0) {
        this.store.setImages(images);
      }

      this.store.setChapters(chapters);
      this.toast.success(`Đã chia thành ${chapters.length} phần thành công.`);
    } catch (e) {
      console.error('Lỗi khi cắt PDF:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      this.toast.error(`Lỗi khi cắt PDF: ${errMsg}`);
    } finally {
      this.isProcessing.set(false);
    }
  }
}


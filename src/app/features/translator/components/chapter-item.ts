import { Component, input, model, output, inject, signal, computed, effect, OnDestroy, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-translating-skeleton',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="flex flex-col items-center justify-start pt-12 min-h-[400px] h-full w-full relative overflow-hidden">
        <div class="absolute inset-0 p-6 pointer-events-none opacity-[0.15]">
            <div class="space-y-4 w-full mx-auto">
                <div class="h-3 bg-zinc-400 rounded w-3/4 animate-pulse"></div>
                <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 200ms"></div>
                <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 400ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-5/6 animate-pulse" style="animation-delay: 600ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-full animate-pulse" style="animation-delay: 800ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-2/3 animate-pulse" style="animation-delay: 1000ms"></div>
            </div>
            <div class="space-y-4 w-full mx-auto mt-8">
                <div class="h-3 bg-zinc-400 rounded animate-pulse" style="animation-delay: 300ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-4/5 animate-pulse" style="animation-delay: 500ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-full animate-pulse" style="animation-delay: 700ms"></div>
                <div class="h-3 bg-zinc-400 rounded w-3/4 animate-pulse" style="animation-delay: 900ms"></div>
            </div>
            <div class="space-y-4 w-full mx-auto mt-8">
                <div class="h-3 bg-zinc-400 rounded w-1/2 animate-pulse" style="animation-delay: 400ms"></div>
            </div>
        </div>
        
        <div class="relative z-10 flex flex-col items-center bg-white/90 p-8 rounded-2xl shadow-sm backdrop-blur-sm border border-indigo-100 min-w-[240px]">
            <mat-icon class="animate-spin mb-4 text-indigo-600 !w-8 !h-8 !text-[32px] flex items-center justify-center">sync</mat-icon>
            <div class="text-sm font-semibold text-indigo-600 tracking-wider uppercase bg-indigo-50 px-4 py-2 rounded-full shadow-sm">
                Gemini đang dịch...
            </div>
        </div>
    </div>
  `
})
export class TranslatingSkeletonComponent {
}
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BookStore, Chapter, TranslationVersion } from '../../../core/book.store';
import { ToastService } from '../../../core/toast.service';
import { ReaderStore } from '../../../core/reader.store';
import { GeminiClient } from '../../../core/gemini';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

const PRINT_PDF_STYLES = `
body {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14pt;
  line-height: 1.6;
  color: #111;
  background-color: #FFF;
  margin: 0;
  padding: 0;
}
.content-wrapper {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
h1, h2, h3, h4, h5, h6 { color: #000; margin-top: 1.5em; margin-bottom: 0.5em; page-break-after: avoid; }
h1 { font-size: 24pt; }
h2 { font-size: 18pt; }
blockquote { border-left: 4px solid #DFDFDF; padding-left: 1rem; color: #444; margin-left: 0; }
figure {
  margin: 1.75rem auto;
  text-align: center;
  display: block;
  max-width: 100%;
  page-break-inside: avoid;
}
figure img, img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  page-break-inside: avoid;
  object-fit: contain;
}
figcaption {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.5rem;
  font-style: italic;
  text-align: center;
  line-height: 1.4;
}
ul, ol, li { page-break-inside: avoid; }
table { page-break-inside: avoid; }
@page {
  size: auto;
  margin: 20mm;
  @bottom-center {
    content: counter(page);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 10pt;
    color: #666;
  }
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
import { renderPdfToPageImages, restoreImagePlaceholders } from '../../../core/image-processor.util';
import { getConfiguredMarked } from '../../../core/marked-setup';

import { SafeHtmlComponent } from '../../../shared/components/safe-html.component';

@Component({
  selector: 'app-chapter-item',
  standalone: true,
  imports: [MatIconModule, DatePipe, TranslatingSkeletonComponent, SafeHtmlComponent],
  host: {
    class: 'block',
    '(click)': 'onLinkClick($event)'
  },
  template: `
    <div class="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50 cursor-pointer" 
            (click)="toggleExpand()" 
            tabindex="0" 
            (keydown.enter)="toggleExpand()">
        <div class="flex items-center space-x-3 w-full">
          <mat-icon class="text-zinc-400 transition-transform" [class.rotate-90]="isExpanded()">chevron_right</mat-icon>
          <div class="flex-1">
            <h4 class="font-semibold text-zinc-900">{{ chapter().title || 'Phần ' + (index() + 1) }}</h4>
            <div class="flex items-center space-x-3 mt-1">
              @switch (chapter().status) {
                @case ('pending') { <span class="text-xs font-medium text-zinc-500 bg-zinc-200 px-2 rounded-full py-0.5">Chờ dịch</span> }
                @case ('translating') { 
                  <span class="flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 px-2 rounded-full py-0.5">
                    <span class="flex items-center gap-1 animate-pulse">
                      <mat-icon class="!w-3 !h-3 !text-[12px] animate-spin">sync</mat-icon> Đang dịch...
                    </span>
                    <span class="w-[1px] h-3 bg-indigo-300"></span>
                    <span class="font-mono tracking-tight">{{ formatTime(elapsedSeconds()) }}</span>
                  </span> 
                }
                @case ('done') { <span class="text-xs font-medium text-green-700 bg-green-100 px-2 rounded-full py-0.5">Đã dịch</span> }
                @case ('error') { <span class="text-xs font-medium text-red-700 bg-red-100 px-2 rounded-full py-0.5">Lỗi</span> }
              }
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2 shrink-0 ml-4">
          @if (chapter().status !== 'translating') {
            <button 
              (click)="translateSingle.emit(); $event.stopPropagation()"
              [disabled]="store.isTranslatingAny() || chapter().excludeFromTranslation"
              [class.opacity-50]="store.isTranslatingAny() || chapter().excludeFromTranslation"
              [class.cursor-not-allowed]="store.isTranslatingAny() || chapter().excludeFromTranslation"
              class="px-3 py-1.5 bg-white text-indigo-500 hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-200 rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm disabled:hover:bg-white disabled:hover:border-indigo-100"
              [title]="chapter().excludeFromTranslation ? 'Không thể dịch khối này' : (chapter().status === 'done' || chapter().status === 'error' ? 'Dịch lại riêng phần này' : 'Dịch riêng phần này')"
            >
              <mat-icon class="!w-4 !h-4 !text-base flex items-center justify-center">looks_one</mat-icon>
              <span class="text-sm font-medium">{{ chapter().status === 'done' || chapter().status === 'error' ? 'Dịch lại riêng phần này' : 'Dịch riêng phần này' }}</span>
            </button>
          }
        </div>
      </div>

      @if (isExpanded()) {
        <div class="flex flex-col">
          @if (chapter().versions && chapter().versions!.length > 0) {
            <div class="px-6 py-3 bg-white border-b border-zinc-100 flex flex-col items-center justify-center gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-zinc-500 mr-2">Phiên bản:</span>
                  @for (v of chapter().versions; track v.versionNumber) {
                    <div class="relative group">
                      <button 
                        (click)="store.selectVersion(chapter().id, v.versionNumber)"
                        [class.bg-indigo-100]="chapter().activeVersionNumber === v.versionNumber"
                        [class.text-indigo-700]="chapter().activeVersionNumber === v.versionNumber"
                        [class.font-semibold]="chapter().activeVersionNumber === v.versionNumber"
                        [class.bg-zinc-100]="chapter().activeVersionNumber !== v.versionNumber"
                        [class.text-zinc-600]="chapter().activeVersionNumber !== v.versionNumber"
                        class="px-2 py-1.5 min-w-[36px] rounded-md text-xs font-medium transition-colors hover:bg-zinc-200"
                      >
                        v{{ v.versionNumber }}
                      </button>
                      @if (v.versionNumber === 1) {
                        <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 p-3 bg-zinc-800 text-white text-[13px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60] pointer-events-none shadow-lg text-left font-normal leading-relaxed after:content-[''] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-b-zinc-800">
                          Đây là bản dịch đầu tiên (v1) của phần này, bạn có quyền tạo các bản dịch khác để tạo các phiên bản khác của bản dịch. Ví dụ bạn có thể điều chỉnh model dùng để dịch, chỉnh sửa bảng thuật ngữ rồi dịch lại phần này hoặc dịch lại toàn cuốn sách. Có tối đa 3 phiên bản dịch gần nhất của mỗi phần được lưu lại.
                        </div>
                      }
                    </div>
                  }
                </div>
                @if (getActiveVersion(chapter()); as activeV) {
                  <div class="text-[11px] text-zinc-500 flex flex-col items-center justify-center gap-y-2 bg-zinc-50 px-3 py-2 rounded-md border border-zinc-100 w-full">
                    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                      <span class="flex items-center gap-1.5">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-indigo-500">smart_toy</mat-icon> Model: {{ activeV.model }}
                      </span>
                      <span class="flex items-center gap-1.5">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-green-500">schedule</mat-icon> {{ activeV.timestamp | date:'dd/MM/yy HH:mm' }}
                      </span>
                      <span class="flex items-center gap-1.5">
                        <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-violet-500">style</mat-icon> Phong cách: {{ getTranslationStyleLabel(activeV.translationStyle) }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                      @if (activeV.glossaryStatus === 'filtered') {
                        <button (click)="viewCustomGlossary(activeV.customGlossary, activeV.glossaryRatio, activeV.glossaryVersionNumber)" class="flex items-center gap-1 text-indigo-600 hover:underline">
                           <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">menu_book</mat-icon> Sử dụng danh sách thuật ngữ đã lọc (v{{activeV.glossaryVersionNumber ?? '?'}})
                        </button>
                      } @else if (activeV.glossaryStatus === 'full') {
                        <button (click)="viewCustomGlossary(activeV.customGlossary, activeV.glossaryRatio, activeV.glossaryVersionNumber)" class="flex items-center gap-1 text-indigo-600 hover:underline">
                           <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">library_books</mat-icon> Sử dụng đầy đủ danh sách thuật ngữ (v{{activeV.glossaryVersionNumber ?? '?'}})
                        </button>
                      } @else {
                        <span class="flex items-center gap-1 text-zinc-400">
                           <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">book</mat-icon> Không sử dụng danh sách thuật ngữ
                        </span>
                      }
                      <span class="bg-zinc-200 w-[1px] h-3 mx-0"></span>
                      @if (activeV.usePronouns) {
                        <button (click)="viewPronounSnapshot(activeV.pronounSnapshot, activeV.pronounVersionNumber)" class="flex items-center gap-1 text-emerald-600 hover:underline">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">assignment_ind</mat-icon> Sử dụng bảng đại từ (v{{activeV.pronounVersionNumber ?? '?'}})
                        </button>
                      } @else {
                        <span class="flex items-center gap-1 text-zinc-400">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">person_off</mat-icon> Không sử dụng bảng đại từ
                        </span>
                      }
                      <span class="bg-zinc-200 w-[1px] h-3 mx-0"></span>
                      @if (activeV.useContextSummary) {
                        <button (click)="viewContextSummary(activeV.contextSummarySnapshot, activeV.contextSummaryChapterTitle)" class="flex items-center gap-1 text-cyan-600 hover:underline">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">psychology</mat-icon> Sử dụng tóm tắt ngữ cảnh
                        </button>
                      } @else {
                        <span class="flex items-center gap-1 text-zinc-400">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">psychology_alt</mat-icon> Không sử dụng tóm tắt ngữ cảnh
                        </span>
                      }
                      <span class="bg-zinc-200 w-[1px] h-3 mx-0"></span>
                      @if (activeV.summary) {
                        <button (click)="viewSummary(activeV.summary)" class="flex items-center gap-1 text-amber-600 hover:underline" title="Xem bản tóm tắt">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">auto_awesome</mat-icon> Có tóm tắt
                        </button>
                      } @else {
                        <button (click)="confirmCreateSummary(activeV)" [disabled]="isGeneratingSummary()" class="flex items-center gap-1 text-zinc-400 hover:text-amber-600 transition-colors cursor-pointer disabled:cursor-not-allowed" title="Nhấp để tạo bản tóm tắt">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]" [class.animate-spin]="isGeneratingSummary()">{{ isGeneratingSummary() ? 'sync' : 'auto_awesome_mosaic' }}</mat-icon> {{ isGeneratingSummary() ? 'Đang tạo tóm tắt...' : 'Không có tóm tắt' }}
                        </button>
                      }
                    </div>
                    <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-1">
                      @if (activeV.useCustomInstructions) {
                        <button (click)="viewCustomInstructionsSnapshot(activeV.customInstructionsSnapshot)" class="flex items-center gap-1 text-fuchsia-600 hover:underline">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">tune</mat-icon> Có sử dụng chỉ thị bổ sung
                        </button>
                      } @else {
                        <span class="flex items-center gap-1 text-zinc-400">
                          <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">tune</mat-icon> Không sử dụng chỉ thị bổ sung
                        </span>
                      }
                    </div>
                  </div>
                }
            </div>
          }

          <!-- Single column content with tab switcher -->
          <div class="border-t border-zinc-100 flex flex-col w-full">
            <!-- Tab switcher header -->
            <div class="px-6 py-3 bg-zinc-50/80 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3">
              <div class="inline-flex items-center p-1 bg-zinc-200/60 rounded-xl">
                <button 
                  type="button"
                  (click)="activeTab.set('original')"
                  [class.bg-white]="activeTab() === 'original'"
                  [class.text-zinc-900]="activeTab() === 'original'"
                  [class.shadow-sm]="activeTab() === 'original'"
                  [class.text-zinc-600]="activeTab() !== 'original'"
                  class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:text-zinc-900">
                  <mat-icon class="!w-4 !h-4 !text-[16px]">description</mat-icon>
                  <span>Bản gốc</span>
                </button>
                <button 
                  type="button"
                  (click)="activeTab.set('translation')"
                  [class.bg-white]="activeTab() === 'translation'"
                  [class.text-indigo-600]="activeTab() === 'translation'"
                  [class.shadow-sm]="activeTab() === 'translation'"
                  [class.text-zinc-600]="activeTab() !== 'translation'"
                  class="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer hover:text-zinc-900">
                  <mat-icon class="!w-4 !h-4 !text-[16px]">translate</mat-icon>
                  <span>Bản dịch</span>
                </button>
              </div>

              <!-- Action buttons for translation -->
              @if (chapter().translatedText) {
                <div class="flex items-center gap-1">
                  <button (click)="downloadPdf()" class="tooltip-trigger flex items-center justify-center p-1.5 text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors" title="Tải xuống PDF">
                    <mat-icon class="!w-6 !h-6 !text-[22px]">picture_as_pdf</mat-icon>
                  </button>
                  <button (click)="downloadHtml()" class="tooltip-trigger flex items-center justify-center p-1.5 text-zinc-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Tải xuống HTML">
                    <mat-icon class="!w-6 !h-6 !text-[22px]">html</mat-icon>
                  </button>
                  <button (click)="openBilingualFullscreen()" class="tooltip-trigger flex items-center justify-center p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Đọc song ngữ">
                    <mat-icon class="!w-6 !h-6 !text-[22px]">vertical_split</mat-icon>
                  </button>
                  <button (click)="openFullscreen()" class="tooltip-trigger flex items-center justify-center p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Đọc toàn màn hình">
                    <mat-icon class="!w-6 !h-6 !text-[22px]">fullscreen</mat-icon>
                  </button>
                </div>
              }
            </div>

            <!-- Tab content body -->
            <div class="p-6 md:p-8 w-full bg-white">
              @if (activeTab() === 'original') {
                @if (isLoadingPdfPages()) {
                  <div class="flex flex-col items-center justify-center py-16 bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <mat-icon class="animate-spin text-indigo-600 !w-8 !h-8 !text-[32px] mb-3">sync</mat-icon>
                    <span class="text-sm font-medium text-zinc-600">Đang tải và hiển thị trang PDF bản gốc...</span>
                  </div>
                } @else if (pdfPageImages().length > 0) {
                  <div class="w-full max-h-[700px] rounded-xl border border-zinc-200/80 bg-zinc-200/60 p-4 space-y-4 shadow-inner" [class.overflow-y-auto]="!isAnyModalOpen()" [class.overflow-hidden]="isAnyModalOpen()">
                    @for (imgSrc of pdfPageImages(); track $index) {
                      @let pageNum = getPdfDisplayPageNum($index);
                      <div [id]="'chapter-' + chapter().id + '-pdf-page-' + pageNum" class="relative bg-white rounded-lg shadow border border-zinc-200/80 overflow-hidden mx-auto max-w-3xl pdf-page-container transition-all duration-300">
                        <div class="bg-zinc-100/90 px-3 py-1.5 text-[11px] font-medium text-zinc-500 border-b border-zinc-200 flex justify-between items-center">
                          <span class="font-semibold text-zinc-700 flex items-center gap-1.5">
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-zinc-400">menu_book</mat-icon>
                            Trang {{ pageNum }}
                          </span>
                          <button 
                            type="button"
                            (click)="syncToTranslatedPage(pageNum)" 
                            class="px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 bg-indigo-50/90 hover:bg-indigo-600 hover:text-white border border-indigo-200/80 hover:border-indigo-600 rounded-full transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Nhấn để cuộn đến trang {{ pageNum }} ở bản dịch">
                            <mat-icon class="!w-3 !h-3 !text-[12px]">sync_alt</mat-icon>
                            <span>Đồng bộ bản dịch</span>
                          </button>
                        </div>
                        <img [src]="imgSrc" [alt]="'Trang PDF ' + pageNum" class="w-full h-auto block select-none" loading="lazy" />
                      </div>
                    }
                  </div>
                } @else if (chapter().originalText) {
                  <div class="max-h-[700px] pr-2" [class.overflow-y-auto]="!isAnyModalOpen()" [class.overflow-hidden]="isAnyModalOpen()">
                    <app-safe-html [htmlContent]="renderedOriginalHtml()" class="w-full text-zinc-800" />
                  </div>
                } @else {
                  <div class="flex flex-col items-center justify-center py-12 text-zinc-400">
                    <mat-icon class="!w-10 !h-10 !text-[40px] text-zinc-300 mb-2">picture_as_pdf</mat-icon>
                    <span class="text-sm font-medium text-zinc-500">Không có dữ liệu PDF bản gốc.</span>
                  </div>
                }
              } @else {
                @if (chapter().excludeFromTranslation) {
                  <div class="flex items-center justify-center py-12 px-6 text-center text-zinc-500 bg-zinc-50 rounded-xl border border-zinc-200/60">
                    <span class="text-sm">Đây là nội dung bản quyền / metadata, nội dung sẽ được giữ nguyên bản gốc khi xuất file.</span>
                  </div>
                } @else if (chapter().translatedText) {
                  <div class="max-h-[700px] pr-2" [class.overflow-y-auto]="!isAnyModalOpen()" [class.overflow-hidden]="isAnyModalOpen()">
                    <app-safe-html #translatedSafeHtmlTab (pageClick)="onPageClick($event)" [htmlContent]="renderedTranslatedHtml()" class="w-full text-zinc-900" />
                  </div>
                } @else if (chapter().status === 'translating') {
                  <app-translating-skeleton />
                } @else {
                  <div class="flex flex-col items-center justify-center py-12 px-6 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-zinc-100">
                    <mat-icon class="!w-10 !h-10 !text-[40px] text-zinc-300 mb-2">translate</mat-icon>
                    <span class="text-sm font-medium text-zinc-500">Chưa có bản dịch cho khối này.</span>
                    <button 
                      (click)="translateSingle.emit(); $event.stopPropagation()"
                      [disabled]="store.isTranslatingAny() || chapter().excludeFromTranslation"
                      class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                      <mat-icon class="!w-4 !h-4 !text-[16px]">play_arrow</mat-icon>
                      <span>Bắt đầu dịch phần này</span>
                    </button>
                  </div>
                }
              }
            </div>
          </div>
        </div>
      }
    </div>

      @if (isFullscreen()) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-white text-zinc-900">
          <div class="max-w-4xl mx-auto px-6 lg:px-12 py-12 relative min-h-screen">
            
            <!-- Close button -->
            <button (click)="closeFullscreen()" class="fixed top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-900 shadow-sm transition-colors z-50 cursor-pointer" title="Đóng chế độ toàn màn hình">
              <mat-icon>close</mat-icon>
            </button>

            <!-- Chapter Title Header -->
            <div class="mb-8 pb-4 border-b border-zinc-200">
              <h3 class="text-xl font-bold text-zinc-900">{{ chapter().title || 'Phần ' + (index() + 1) }}</h3>
            </div>

            <!-- Fullscreen HTML Content -->
            <app-safe-html #translatedSafeHtmlFs (pageClick)="onPageClick($event)" 
                           [htmlContent]="renderedTranslatedHtml()" 
                           [fontFamily]="getFontFamily(readerStore.prefs().fontFamily)" 
                           class="w-full text-zinc-900" />

            <!-- Navigation between chapters -->
            <div class="mt-24 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-2xl mx-auto pb-12">
              @if (prevTranslatedChapterIndex() !== -1) {
                <button (click)="navigateTo(prevTranslatedChapterIndex())"
                        class="flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-zinc-100 transition-colors shadow-sm text-sm font-medium text-zinc-700 border border-zinc-200 w-full sm:w-auto justify-center cursor-pointer">
                  <mat-icon class="!w-5 !h-5 !text-[20px] leading-none">arrow_back</mat-icon>
                  Phần trước
                </button>
              } @else {
                <div class="hidden sm:block"></div>
              }
              
              @if (nextTranslatedChapterIndex() !== -1) {
                <button (click)="navigateTo(nextTranslatedChapterIndex())"
                        class="flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors shadow-sm text-sm font-medium text-indigo-700 border border-indigo-200 w-full sm:w-auto justify-center cursor-pointer">
                  Phần sau
                  <mat-icon class="!w-5 !h-5 !text-[20px] leading-none">arrow_forward</mat-icon>
                </button>
              } @else {
                <div class="hidden sm:block"></div>
              }
            </div>
          </div>
        </div>
      }
      
      @if (isBilingualFullscreen()) {
        <div class="fixed inset-0 z-50 overflow-hidden flex flex-col bg-white text-zinc-900 bilingual-fullscreen-container">
             
          <!-- Header -->
          <div class="h-16 flex items-center justify-between px-6 bg-white border-b border-zinc-200 z-10 flex-shrink-0">
            <div class="flex items-center gap-3">
              <span class="font-semibold text-[15px] text-zinc-900">{{ chapter().title || 'Phần ' + (index() + 1) }}</span>
              <span class="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 font-medium tracking-wider uppercase">Song ngữ</span>
            </div>
            
            <div class="flex items-center gap-4">
              <button (click)="closeBilingualFullscreen()" class="w-10 h-10 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer" title="Đóng chế độ song ngữ">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>

          <!-- Content columns -->
          <div class="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-zinc-200 bg-white">
            <!-- Original Column -->
            <div class="overflow-y-auto px-8 lg:px-16 py-12 scroll-smooth">
              <div class="max-w-2xl mx-auto">
                <h4 class="text-xs font-semibold uppercase tracking-wider mb-8 text-zinc-400 text-center flex items-center justify-center gap-2">
                  <mat-icon class="!w-4 !h-4 !text-[16px]">g_translate</mat-icon> Bản gốc
                </h4>
                @if (isLoadingPdfPages()) {
                  <div class="flex flex-col items-center justify-center h-[calc(100vh-180px)] bg-zinc-50 rounded-xl border border-zinc-200/80">
                    <mat-icon class="animate-spin text-indigo-600 !w-8 !h-8 !text-[32px] mb-3">sync</mat-icon>
                    <span class="text-sm font-medium text-zinc-600">Đang tải trang PDF bản gốc...</span>
                  </div>
                } @else if (pdfPageImages().length > 0) {
                  <div class="w-full h-[calc(100vh-180px)] overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-200/60 p-4 space-y-4 shadow-inner">
                    @for (imgSrc of pdfPageImages(); track $index) {
                      @let pageNum = getPdfDisplayPageNum($index);
                      <div [id]="'bilingual-pdf-page-' + pageNum" class="relative bg-white rounded-lg shadow border border-zinc-200/80 overflow-hidden mx-auto max-w-3xl pdf-page-container transition-all duration-300">
                        <div class="bg-zinc-100/90 px-3 py-1.5 text-[11px] font-medium text-zinc-500 border-b border-zinc-200 flex justify-between items-center">
                          <span class="font-semibold text-zinc-700 flex items-center gap-1.5">
                            <mat-icon class="!w-3.5 !h-3.5 !text-[14px] text-zinc-400">menu_book</mat-icon>
                            Trang {{ pageNum }}
                          </span>
                          <button 
                            type="button"
                            (click)="syncToTranslatedPage(pageNum)" 
                            class="px-2.5 py-0.5 text-[11px] font-medium text-indigo-600 bg-indigo-50/90 hover:bg-indigo-600 hover:text-white border border-indigo-200/80 hover:border-indigo-600 rounded-full transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                            title="Nhấn để cuộn đến trang {{ pageNum }} ở bản dịch">
                            <mat-icon class="!w-3 !h-3 !text-[12px]">sync_alt</mat-icon>
                            <span>Đồng bộ bản dịch</span>
                          </button>
                        </div>
                        <img [src]="imgSrc" [alt]="'Trang PDF ' + pageNum" class="w-full h-auto block select-none" loading="lazy" />
                      </div>
                    }
                  </div>
                } @else {
                  <app-safe-html [htmlContent]="renderedOriginalHtml()"
                                 [fontFamily]="getFontFamily(readerStore.prefs().fontFamily)"
                                 class="w-full text-zinc-900" />
                }
              </div>
            </div>

            <!-- Translated Column -->
            <div class="overflow-y-auto px-8 lg:px-16 py-12 scroll-smooth bg-zinc-50/50">
              <div class="max-w-2xl mx-auto">
                <h4 class="text-xs font-semibold uppercase tracking-wider mb-8 text-zinc-400 text-center flex items-center justify-center gap-2">
                   <mat-icon class="!w-4 !h-4 !text-[16px]">translate</mat-icon> Bản dịch
                </h4>
                <app-safe-html #translatedSafeHtmlBi (pageClick)="onPageClick($event)" 
                               [htmlContent]="renderedTranslatedHtml()"
                               [fontFamily]="getFontFamily(readerStore.prefs().fontFamily)"
                               class="w-full text-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      }

      @if (showGlossaryModal() || isClosingGlossaryModal()) {
        <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 cursor-pointer animate-in fade-in duration-200" tabindex="0" (click)="triggerCloseGlossaryModal()" (keydown.escape)="triggerCloseGlossaryModal()" [class.animate-fade-out]="isClosingGlossaryModal()">
          <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-in zoom-in duration-200" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosingGlossaryModal()">
            <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/80">
              <div class="flex flex-col">
                <h2 class="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <mat-icon class="text-indigo-500">menu_book</mat-icon>
                  Thuật ngữ đã dùng cho khối này (v{{currentGlossaryVersion() ?? '?'}})
                </h2>
                <p class="text-[13px] text-zinc-500 mt-1 ml-8">Mỗi khối dịch sẽ trích những thuật ngữ phù hợp từ danh sách tổng thể thuật ngữ của cả cuốn sách, điều này giúp tránh dư thừa các thuật ngữ không dùng đến.</p>
                @if (currentGlossaryRatio() !== undefined) {
                  <p class="text-[13px] font-medium text-indigo-600 mt-1 ml-8">Khối này dùng {{ currentGlossaryRatio() }}% số thuật ngữ của toàn cuốn sách.</p>
                }
              </div>
              <button (click)="triggerCloseGlossaryModal()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center self-start flex-shrink-0 ml-4">
                <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
              </button>
            </div>
            
            <div class="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
               <app-safe-html [htmlContent]="parsedCustomGlossary()" class="w-full text-zinc-700" />
            </div>
          </div>
        </div>
      }

      @if (showSummaryModal() || isClosingSummaryModal()) {
        <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 cursor-pointer animate-in fade-in duration-200" tabindex="0" (click)="triggerCloseSummaryModal()" (keydown.escape)="triggerCloseSummaryModal()" [class.animate-fade-out]="isClosingSummaryModal()">
          <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-in zoom-in duration-200" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosingSummaryModal()">
            <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/80">
              <div class="flex flex-col">
                <h2 class="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <mat-icon class="text-amber-500">auto_awesome</mat-icon>
                  Bản tóm tắt khối dịch
                </h2>
                <p class="text-[13px] text-zinc-500 mt-1 ml-8">Bản tóm tắt ngắn gọn của bản dịch được dùng làm bối cảnh để đưa vào khối dịch tiếp theo, giúp cải thiện chất lượng dịch.</p>
              </div>
              <button (click)="triggerCloseSummaryModal()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center flex-shrink-0 ml-4 self-start">
                <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
               <app-safe-html [htmlContent]="parsedActiveSummary()" class="w-full text-zinc-700" />
            </div>
          </div>
        </div>
      }

      @if (showContextSummaryModal() || isClosingContextSummaryModal()) {
        <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 cursor-pointer animate-in fade-in duration-200" tabindex="0" (click)="triggerCloseContextSummaryModal()" (keydown.escape)="triggerCloseContextSummaryModal()" [class.animate-fade-out]="isClosingContextSummaryModal()">
          <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-zinc-50 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-in zoom-in duration-200" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosingContextSummaryModal()">
            <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-white">
              <div>
                <h2 class="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <mat-icon class="text-cyan-500">psychology</mat-icon>
                  Tóm tắt ngữ cảnh đã dùng
                </h2>
                <p class="text-[13px] text-zinc-500 mt-1 ml-8">Được trích xuất từ: <span class="font-medium text-cyan-600">{{ activeContextSummaryTitle() }}</span></p>
              </div>
              <button (click)="triggerCloseContextSummaryModal()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center flex-shrink-0 ml-4">
                <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
               <app-safe-html [htmlContent]="parsedActiveContextSummary()" class="w-full text-zinc-700" />
            </div>
          </div>
        </div>
      }

      @if (showCustomInstructionsModal() || isClosingCustomInstructionsModal()) {
        <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 cursor-pointer animate-in fade-in duration-200" tabindex="0" (click)="triggerCloseCustomInstructionsModal()" (keydown.escape)="triggerCloseCustomInstructionsModal()" [class.animate-fade-out]="isClosingCustomInstructionsModal()">
          <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-zinc-50 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-in zoom-in duration-200" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosingCustomInstructionsModal()">
            <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-white">
              <div>
                <h2 class="text-xl font-bold text-zinc-900 flex items-center gap-2">
                  <mat-icon class="text-fuchsia-500">tune</mat-icon>
                  Chỉ thị bổ sung đã dùng cho khối dịch này
                </h2>
                <p class="text-[13px] text-zinc-500 mt-1 ml-8">Đây là những chỉ dẫn thêm được nạp cùng khối văn bản để điều hướng quá trình dịch thuật của AI.</p>
              </div>
              <button (click)="triggerCloseCustomInstructionsModal()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center flex-shrink-0 ml-4 self-start">
                <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
               @if (parsedCustomInstructionsSnapshot()) {
                 <app-safe-html [htmlContent]="parsedCustomInstructionsSnapshot()" class="w-full text-zinc-700" />
               } @else {
                 <div class="text-zinc-500 italic text-sm text-center py-8 bg-zinc-50 rounded-lg">Không có dữ liệu chi tiết.</div>
               }
            </div>
          </div>
        </div>
      }

      @if (showPronounModal() || isClosingPronounModal()) {
        <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 cursor-pointer animate-in fade-in duration-200" tabindex="0" (click)="triggerClosePronounModal()" (keydown.escape)="triggerClosePronounModal()" [class.animate-fade-out]="isClosingPronounModal()">
          <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-in zoom-in duration-200" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosingPronounModal()">
            <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/80">
              <div class="flex flex-col">
                <h2 class="text-xl font-bold text-zinc-900 flex items-center gap-2">
                   <mat-icon class="text-emerald-500">assignment_ind</mat-icon>
                   Bảng đại từ nhân xưng đã dùng cho khối này (v{{currentPronounVersion() ?? '?'}})
                 </h2>
                 <p class="text-[13px] text-zinc-500 mt-1 ml-8">Toàn bộ bảng đại từ này được đưa vào khi dịch khối này. Điều đó giúp công cụ dịch có đầy đủ bối cảnh hơn.</p>
              </div>
              <button (click)="triggerClosePronounModal()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center self-start flex-shrink-0 ml-4">
                <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
              </button>
            </div>
            <div class="p-6 overflow-y-auto overscroll-contain flex-1 bg-white">
               @if (parsedPronounSnapshot()) {
                 <app-safe-html [htmlContent]="parsedPronounSnapshot()" class="w-full text-zinc-700" />
               } @else {
                 <div class="text-zinc-500 italic text-sm text-center py-8 bg-zinc-50 rounded-lg">Không có dữ liệu chi tiết cho bảng đại từ này.</div>
               }
            </div>
          </div>
        </div>
      }

      @if (showConfirmCreateSummary()) {
        <div class="fixed inset-0 bg-zinc-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 border border-zinc-100">
             <div class="p-8 text-center">
                <div class="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <mat-icon class="!w-8 !h-8 !text-[32px]">auto_awesome</mat-icon>
                </div>
                <h3 class="text-xl font-bold text-zinc-900 mb-3">Tạo bản tóm tắt</h3>
                <p class="text-zinc-600 leading-relaxed mb-8">Khối dịch này hiện chưa có bản tóm tắt bối cảnh. Bạn có muốn tạo bản tóm tắt ngay bây giờ không?</p>
                
                <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                   <button (click)="cancelConfirmSummary()" class="w-full sm:w-1/2 px-6 py-3 rounded-xl border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-50 transition-colors">
                     Hủy bỏ
                   </button>
                   <button (click)="generateMissingSummary()" class="w-full sm:w-1/2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg shadow-amber-500/30 transition-all active:scale-95">
                     Tạo ngay
                   </button>
                </div>
             </div>
          </div>
        </div>
      }
  `
})
export class ChapterItemComponent implements OnDestroy {
  store = inject(BookStore);
  toast = inject(ToastService);
  readerStore = inject(ReaderStore);
  gemini = inject(GeminiClient);
  private sanitizer = inject(DomSanitizer);
  private elementRef = inject(ElementRef);
  chapter = input.required<Chapter>();
  index = input.required<number>();
  
  readonly renderedTranslatedHtml = computed(() => {
    const text = this.chapter().translatedText;
    this.store.images();
    if (!text) return '';
    return this.renderHtml(text);
  });

  readonly renderedOriginalHtml = computed(() => {
    const text = this.chapter().originalText;
    this.store.images();
    if (!text) return '';
    return this.parseMarkdown(text, 'c' + this.index() + '-o');
  });

  readonly parsedActiveSummary = computed(() => {
    const text = this.activeSummary();
    if (!text) return '';
    return this.parseMarkdown(text, this.chapter().id + '-sum');
  });

  readonly parsedActiveContextSummary = computed(() => {
    const text = this.activeContextSummary();
    if (!text) return '';
    return this.parseMarkdown(text, this.chapter().id + '-csum');
  });
  
  @ViewChild('translatedSafeHtmlTab') translatedSafeHtmlTab?: SafeHtmlComponent;
  @ViewChild('translatedSafeHtmlBi') translatedSafeHtmlBi?: SafeHtmlComponent;
  @ViewChild('translatedSafeHtmlFs') translatedSafeHtmlFs?: SafeHtmlComponent;

  pdfPageImages = signal<string[]>([]);
  isLoadingPdfPages = signal<boolean>(false);

  isExpanded = model(false);
  isFullscreen = signal(false);
  isBilingualFullscreen = signal(false);
  isBilingualAligned = signal(false);
  activeTab = signal<'original' | 'translation'>('original');
  
  elapsedSeconds = signal(0);
  private intervalFn: ReturnType<typeof setInterval> | null = null;
  
  constructor() {
    effect(async () => {
      const isExp = this.isExpanded();
      const isFS = this.isFullscreen();
      const isBiFS = this.isBilingualFullscreen();
      const tab = this.activeTab();
      const b64 = this.chapter().originalPdfBase64;

      if (!b64) {
        this.pdfPageImages.set([]);
        this.isLoadingPdfPages.set(false);
        return;
      }

      // Only load and render PDF pages when the section is expanded or in fullscreen, AND viewing original/bilingual
      const needsPdf = (isExp || isFS || isBiFS) && (tab === 'original' || isBiFS);

      if (needsPdf && this.pdfPageImages().length === 0 && !this.isLoadingPdfPages()) {
        this.isLoadingPdfPages.set(true);
        try {
          const cleanB64 = b64.includes(',') ? b64.split(',')[1] : b64;
          const binaryString = atob(cleanB64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const images = await renderPdfToPageImages(bytes, 1.5);
          this.pdfPageImages.set(images);
        } catch (err) {
          console.error('Lỗi khi convert PDF sang trang hình ảnh:', err);
          this.pdfPageImages.set([]);
        } finally {
          this.isLoadingPdfPages.set(false);
        }
      }
    });

    effect(() => {
      const text = this.chapter().translatedText;
      if (text && text.trim()) {
        this.activeTab.set('translation');
      } else {
        this.activeTab.set('original');
      }
    });

    effect(() => {
      const status = this.chapter().status;
      if (status === 'translating') {
        this.activeTab.set('translation');
        if (!this.intervalFn) {
          this.elapsedSeconds.set(0);
          this.intervalFn = setInterval(() => {
            this.elapsedSeconds.update(s => s + 1);
          }, 1000);
        }
      } else {
        if (this.intervalFn) {
          clearInterval(this.intervalFn);
          this.intervalFn = null;
        }
      }
    });

    // app-safe-html manages its own iframe isolation and MathJax rendering
  }

  showGlossaryModal = signal(false);
  isClosingGlossaryModal = signal(false);
  parsedCustomGlossary = signal<SafeHtml | string>('');
  currentGlossaryRatio = signal<number | undefined>(undefined);
  currentGlossaryVersion = signal<number | undefined>(undefined);

  showSummaryModal = signal(false);
  isClosingSummaryModal = signal(false);
  activeSummary = signal('');

  showContextSummaryModal = signal(false);
  isClosingContextSummaryModal = signal(false);
  activeContextSummary = signal('');
  activeContextSummaryTitle = signal('');

  showPronounModal = signal(false);
  isClosingPronounModal = signal(false);
  parsedPronounSnapshot = signal<SafeHtml | string>('');
  currentPronounVersion = signal<number | undefined>(undefined);

  showCustomInstructionsModal = signal(false);
  isClosingCustomInstructionsModal = signal(false);
  parsedCustomInstructionsSnapshot = signal<SafeHtml | string>('');

  isAnyModalOpen = computed(() => 
    this.showGlossaryModal() || 
    this.showSummaryModal() || 
    this.showContextSummaryModal() || 
    this.showCustomInstructionsModal() || 
    this.showPronounModal()
  );

  isGeneratingSummary = signal(false);
  showConfirmCreateSummary = signal(false);
  selectedVersionForSummary = signal<TranslationVersion | null>(null);

  ngOnDestroy() {
    if (this.intervalFn) {
      clearInterval(this.intervalFn);
    }
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  confirmCreateSummary(version: TranslationVersion) {
    this.selectedVersionForSummary.set(version);
    this.showConfirmCreateSummary.set(true);
  }

  cancelConfirmSummary() {
    this.showConfirmCreateSummary.set(false);
    this.selectedVersionForSummary.set(null);
  }

  async generateMissingSummary() {
    const version = this.selectedVersionForSummary();
    if (!version || !version.text.trim()) {
      this.cancelConfirmSummary();
      return;
    }

    this.showConfirmCreateSummary.set(false);
    this.isGeneratingSummary.set(true);

    try {
      // Use the model stored in the version, or fallback to config model
      const model = version.model || this.store.config().model;
      const summary = await this.gemini.summarizeTranslation(version.text, model);
      
      if (summary) {
        // Update the version in the chapter
        const currentChapter = this.chapter();
        if (currentChapter.versions) {
          const updatedVersions = currentChapter.versions.map(v => 
            v.versionNumber === version.versionNumber ? { ...v, summary } : v
          );
          
          this.store.updateChapter(currentChapter.id, {
            versions: updatedVersions
          });
          
          this.toast.success('Đã tạo bản tóm tắt thành công.');
        }
      } else {
        this.toast.error('Không thể tạo bản tóm tắt. Vui lòng thử lại.');
      }
    } catch (e) {
      console.error('Failed to create missing summary', e);
      this.toast.error('Có lỗi xảy ra khi tạo bản tóm tắt.');
    } finally {
      this.isGeneratingSummary.set(false);
      this.selectedVersionForSummary.set(null);
    }
  }

  viewPronounSnapshot(snapshotText: string | undefined, version: number | undefined) {
    if (!snapshotText) {
      this.parsedPronounSnapshot.set('');
    } else {
      this.parsedPronounSnapshot.set(this.parseMarkdown(snapshotText, 'pronoun'));
    }
    this.currentPronounVersion.set(version);
    this.showPronounModal.set(true);
  }

  triggerClosePronounModal() {
    this.isClosingPronounModal.set(true);
    setTimeout(() => {
      this.showPronounModal.set(false);
      this.isClosingPronounModal.set(false);
    }, 200);
  }

  viewCustomInstructionsSnapshot(snapshotText: string | undefined) {
    if (!snapshotText) {
      this.parsedCustomInstructionsSnapshot.set('');
    } else {
      this.parsedCustomInstructionsSnapshot.set(this.parseMarkdown(snapshotText, 'cinst'));
    }
    this.showCustomInstructionsModal.set(true);
  }

  triggerCloseCustomInstructionsModal() {
    this.isClosingCustomInstructionsModal.set(true);
    setTimeout(() => {
      this.showCustomInstructionsModal.set(false);
      this.isClosingCustomInstructionsModal.set(false);
    }, 200);
  }

  viewSummary(summary: string) {
    if (!summary) return;
    this.activeSummary.set(summary);
    this.showSummaryModal.set(true);
  }

  triggerCloseSummaryModal() {
    this.isClosingSummaryModal.set(true);
    setTimeout(() => {
      this.showSummaryModal.set(false);
      this.isClosingSummaryModal.set(false);
    }, 200);
  }

  viewContextSummary(summary: string | undefined, title: string | undefined) {
    if (!summary) return;
    this.activeContextSummary.set(summary);
    this.activeContextSummaryTitle.set(title || 'Chương trước');
    this.showContextSummaryModal.set(true);
  }

  triggerCloseContextSummaryModal() {
    this.isClosingContextSummaryModal.set(true);
    setTimeout(() => {
      this.showContextSummaryModal.set(false);
      this.isClosingContextSummaryModal.set(false);
    }, 200);
  }

  viewCustomGlossary(glossaryMd: string | undefined, ratio?: number, version?: number) {
    if (!glossaryMd) return;
    this.parsedCustomGlossary.set(this.parseMarkdown(glossaryMd, 'cgloss'));
    this.currentGlossaryRatio.set(ratio);
    this.currentGlossaryVersion.set(version);
    this.showGlossaryModal.set(true);
  }
  
  triggerCloseGlossaryModal() {
    this.isClosingGlossaryModal.set(true);
    setTimeout(() => {
      this.closeGlossaryModal();
      this.isClosingGlossaryModal.set(false);
    }, 200);
  }

  closeGlossaryModal() {
    this.showGlossaryModal.set(false);
  }

  translateSingle = output<void>();
  requestNavigate = output<number>();

  toggleExpand() {
    this.isExpanded.set(!this.isExpanded());
  }

  openFullscreen() {
    this.isFullscreen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeFullscreen() {
    this.isFullscreen.set(false);
    document.body.style.overflow = '';
  }

  openBilingualFullscreen() {
    this.isBilingualFullscreen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeBilingualFullscreen() {
    this.isBilingualFullscreen.set(false);
    document.body.style.overflow = '';
  }

  getPdfDisplayPageNum(index: number): number {
    const start = this.chapter().startPage;
    if (start && start > 0) {
      return start + index;
    }
    return index + 1;
  }

  onPageClick(pageNum: number) {
    if (this.isBilingualFullscreen()) {
      const el = document.getElementById('bilingual-pdf-page-' + pageNum);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-4', 'ring-indigo-500', 'shadow-2xl', 'scale-[1.01]', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-indigo-500', 'shadow-2xl', 'scale-[1.01]');
        }, 2500);
      }
      return;
    }

    this.activeTab.set('original');
    setTimeout(() => {
      const el = document.getElementById(`chapter-${this.chapter().id}-pdf-page-${pageNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.classList.add('ring-4', 'ring-indigo-500', 'shadow-2xl', 'scale-[1.01]', 'transition-all');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-indigo-500', 'shadow-2xl', 'scale-[1.01]');
        }, 2500);
      }
    }, 120);
  }

  syncToTranslatedPage(pageNum: number) {
    if (this.isBilingualFullscreen()) {
      this.translatedSafeHtmlBi?.scrollToPage(pageNum);
      return;
    }

    if (this.isFullscreen()) {
      this.translatedSafeHtmlFs?.scrollToPage(pageNum);
      return;
    }

    this.activeTab.set('translation');
    setTimeout(() => {
      this.translatedSafeHtmlTab?.scrollToPage(pageNum);
    }, 120);
  }

  prevTranslatedChapterIndex(): number {
    const chapters = this.store.chapters();
    const prevIndex = this.index() - 1;
    if (prevIndex >= 0 && chapters[prevIndex].translatedText) {
      return prevIndex;
    }
    return -1;
  }

  nextTranslatedChapterIndex(): number {
    const chapters = this.store.chapters();
    const nextIndex = this.index() + 1;
    if (nextIndex < chapters.length && chapters[nextIndex].translatedText) {
      return nextIndex;
    }
    return -1;
  }

  navigateTo(index: number) {
    this.closeFullscreen();
    this.requestNavigate.emit(index);
  }

  changeFontSize(delta: number) {
    const current = this.readerStore.prefs().fontSize;
    this.readerStore.updatePrefs({ fontSize: Math.max(14, Math.min(42, current + delta)) });
  }

  changeTheme(theme: 'white' | 'sepia' | 'dark') {
    this.readerStore.updatePrefs({ theme });
  }

  changeFontFamily(fontFamily: 'Inter' | 'Lora' | 'Lexend') {
    this.readerStore.updatePrefs({ fontFamily });
  }

  resetPrefs() {
    this.readerStore.resetPrefs();
  }

  toggleToolbar() {
    this.readerStore.updatePrefs({ isToolbarExpanded: !this.readerStore.prefs().isToolbarExpanded });
  }

  getContainerBg(theme: string) {
    switch (theme) {
      case 'dark': return '#121212';
      case 'white': return '#FFFFFF';
      case 'sepia':
      default: return '#FFFFF0';
    }
  }

  getCloseBtnClass(theme: string) {
    switch (theme) {
      case 'dark': return 'bg-zinc-800/90 text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:bg-zinc-700/90';
      case 'white': return 'bg-zinc-100/90 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-200/90';
      case 'sepia':
      default: return 'bg-[#EAE4D3]/90 text-[#8C7A6B] hover:text-[#4A3C31] border border-[#DED6C1] hover:bg-[#DED6C1]/90';
    }
  }

  getToolbarClass(theme: string) {
    switch (theme) {
      case 'dark': return 'bg-zinc-800 text-zinc-300 border-zinc-700';
      case 'white': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'sepia':
      default: return 'bg-[#F3EFE0] text-[#5C4D3C] border-[#E8DFC8]';
    }
  }

  getContentClass(theme: string) {
    switch (theme) {
      case 'dark': return 'prose-invert prose-p:text-zinc-300 prose-headings:text-zinc-100 prose-strong:text-zinc-200 prose-blockquote:text-zinc-400';
      case 'white': return 'prose-p:text-zinc-800 prose-headings:text-zinc-900';
      case 'sepia':
      default: return 'prose-p:text-[#333333] prose-headings:text-[#111111] prose-blockquote:text-[#555555]';
    }
  }

  getFontFamily(font: string) {
    switch (font) {
      case 'Lora': return "'Lora', serif";
      case 'Lexend': return "'Lexend', sans-serif";
      case 'Inter':
      default: return "'Inter', sans-serif";
    }
  }

  downloadPdf() {
    const text = this.chapter().translatedText;
    if (!text) return;

    try {
      const prefix = 'c' + this.index() + '-t';
      const restored = restoreImagePlaceholders(text, this.store.images());
      const processed = restored.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const htmlBody = processed;
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const htmlDoc = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this.store.currentProjectName()}_${title}_1987-Layout_vi</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${PRINT_PDF_STYLES}
</style>
</head>
<body>
<div class="content-wrapper">
${htmlBody}
</div>
<script>
  window.onload = () => {
    setTimeout(() => {
      window.print();
    }, 500);
  };
</script>
</body>
</html>`;

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const newWindow = window.open(url, '_blank');
      if (!newWindow) {
        this.toast.error('Vui lòng cho phép popup để nhận PDF');
        return;
      }
      this.toast.success('Đang tạo bản PDF chuẩn bị tải...');
    } catch (e: unknown) {
      console.error('Error opening PDF print:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống PDF.');
    }
  }

  downloadHtml() {
    const text = this.chapter().translatedText;
    if (!text) return;

    try {
      const prefix = 'c' + this.index() + '-t';
      const restored = restoreImagePlaceholders(text, this.store.images());
      const processed = restored.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      const title = this.chapter().title || `Phần ${this.index() + 1}`;
      const titleName = `${this.store.currentProjectName()}_${title}_1987-Layout_vi`;
      const trimmed = processed.trim().toLowerCase();
      let htmlDoc = '';

      if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
        htmlDoc = processed;
      } else {
        htmlDoc = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleName}</title>
<style>
body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #1f2937;
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
img { max-width: 100%; height: auto; }
</style>
</head>
<body>
${processed}
</body>
</html>`;
      }

      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.store.currentProjectName()}_${title}_1987-Layout_vi.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toast.success('Đã tải xuống file HTML.');
    } catch (e: unknown) {
      console.error('Error exporting to HTML:', e);
      this.toast.error('Có lỗi xảy ra khi tải xuống HTML.');
    }
  }

  cleanHtmlForInAppDisplay(rawHtml: string): string {
    if (!rawHtml) return '';
    let html = rawHtml;

    // Convert MathJax v2 script tags to standard LaTeX delimiters before stripping scripts
    html = html.replace(/<script[^>]*type=["']math\/tex;?\s*mode=display["'][^>]*>([\s\S]*?)<\/script>/gi, '\\[$1\\]');
    html = html.replace(/<script[^>]*type=["']math\/tex["'][^>]*>([\s\S]*?)<\/script>/gi, '\\($1\\)');

    // Extract content inside <body>...</body> if present
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : html;

    // Extract all <style>...</style> blocks (Shadow DOM will scope them automatically!)
    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const styles = styleMatches.join('\n');

    // Strip DOCTYPE, html, head, body wrapper tags & scripts
    bodyContent = bodyContent
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<\/?html[^>]*>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?body[^>]*>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '');

    return `${styles}${bodyContent}`;
  }

  renderHtml(text: string | undefined): SafeHtml | string {
    if (!text) return '';
    const restored = restoreImagePlaceholders(text, this.store.images());
    const trimmed = restored.trim();
    if (trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE') || trimmed.includes('<p') || trimmed.includes('<div') || trimmed.includes('<table')) {
      const cleaned = this.cleanHtmlForInAppDisplay(restored);
      return this.sanitizer.bypassSecurityTrustHtml(cleaned);
    }
    return this.parseMarkdown(restored, 'c' + this.index() + '-t');
  }

  parseMarkdown(text: string | undefined, prefix = ''): SafeHtml | string {
    if (!text) return '';
    let processedText = restoreImagePlaceholders(text, this.store.images());
    if (prefix) {
      processedText = processedText.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
    }
    if (processedText.includes('<style') || processedText.includes('<!DOCTYPE') || processedText.includes('<body') || processedText.startsWith('<')) {
      const cleaned = this.cleanHtmlForInAppDisplay(processedText);
      return this.sanitizer.bypassSecurityTrustHtml(cleaned);
    }
    
    try {
      const markedInstance = getConfiguredMarked();
      const rawHtml = markedInstance.parse(processedText) as string;
      return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    } catch (e) {
      console.warn('Marked parse failed:', e);
      return this.sanitizer.bypassSecurityTrustHtml(processedText);
    }
  }

  onLinkClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('#fn') || href.startsWith('#footnote'))) {
        event.preventDefault();
        event.stopPropagation();
        
        const id = href.substring(1);
        
        // Locate target element LOCALLY first, to avoid selecting duplicate IDs from other renderers!
        // We look inside the closest '.prose' container of the clicked link.
        const parentProse = anchor.closest('.prose');
        let targetElement = parentProse?.querySelector(`[id="${CSS.escape(id)}"]`) as HTMLElement;
        
        // Fallback to global document.getElementById if not found locally
        if (!targetElement) {
          targetElement = document.getElementById(id) as HTMLElement;
        }
        
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/30', 'transition-colors', 'duration-300', 'rounded', 'px-1');
          setTimeout(() => {
            targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/30');
          }, 2000);
        }
      }
    }
  }

  getActiveVersion(chapter: Chapter) {
    if (!chapter.versions || !chapter.activeVersionNumber) return null;
    return chapter.versions.find(v => v.versionNumber === chapter.activeVersionNumber) || null;
  }

  getTranslationStyleLabel(style?: string): string {
    switch (style) {
      case 'social_science':
        return 'Khoa học xã hội';
      case 'specialized_math':
        return 'Toán chuyên ngành';
      case 'general_science':
      default:
        return 'Khoa học nói chung';
    }
  }
}

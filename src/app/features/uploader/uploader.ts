import { Component, ElementRef, inject, viewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BookStore } from '../../core/book.store';
import { ToastService } from '../../core/toast.service';
import { GeminiClient } from '../../core/gemini';
import { MatIconModule } from '@angular/material/icon';
import { PdfService } from './pdf.service';

@Component({
  selector: 'app-uploader',
  standalone: true,
  imports: [MatIconModule, FormsModule, CommonModule],
  host: {
    class: 'flex-1 flex flex-col'
  },
  template: `
    <div class="flex-1 flex items-center justify-center min-h-[50vh] p-4">
      <div class="w-full max-w-2xl">
        
        <div 
          class="border-2 border-dashed border-indigo-300 rounded-2xl py-16 px-12 text-center hover:bg-indigo-50/50 hover:border-indigo-500 transition-colors cursor-pointer relative group min-h-[320px] flex items-center justify-center"
          role="button"
          tabindex="0"
          (keydown.enter)="fileInput.click()"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          [class.bg-indigo-50]="isDragging"
          [class.border-indigo-500]="isDragging"
          [class.opacity-50]="store.isConverting()"
          [class.pointer-events-none]="store.isConverting()"
        >
          <input 
            type="file" 
            #fileInput 
            class="hidden" 
            accept=".pdf" 
            (change)="onFileSelected($event)" 
          />
          
          @if (store.isConverting()) {
            <div class="flex flex-col items-center justify-center space-y-4">
              <mat-icon class="animate-spin text-zinc-500 w-12 h-12 text-5xl">autorenew</mat-icon>
              <h3 class="text-xl font-medium text-zinc-900">Đang tạo tiến trình...</h3>
              <p class="text-sm text-zinc-500">Quá trình này có thể mất một lúc tùy thuộc vào dung lượng file.</p>
            </div>
          } @else {
            <div class="flex flex-col items-center space-y-4">
              <div class="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                <mat-icon class="!text-4xl !w-10 !h-10 !flex !items-center !justify-center">upload_file</mat-icon>
              </div>
              <div class="w-full mt-4">
                <h3 class="text-xl font-semibold text-zinc-900">Tải lên sách định dạng PDF cần dịch</h3>
                <p class="text-sm text-zinc-500 mt-2">Click chọn hoặc kéo thả vào đây.</p>
                <div class="flex flex-wrap gap-1.5 justify-center mt-4">
                  <span class="px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-100 text-indigo-700 font-medium text-sm rounded font-mono transition-colors">PDF (max 200MB)</span>
                </div>
                <p class="text-xs text-zinc-500 max-w-2xl mx-auto mt-3 px-4 leading-relaxed text-justify">
                  Chỉ file <strong class="font-semibold text-zinc-700">PDF tiêu chuẩn</strong> (hiểu nôm na là có thể dùng chuột copy văn bản) thì mới tách được ảnh và dùng công cụ này hiệu quả. Đối với file PDF dạng scan bạn nên sử dụng dụng công cụ như PaddleOCR (hoặc tương tự) để chuyển sang định dạng khác, rồi dùng công cụ <a href="https://github.com/kiencang/silaBook" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline hover:text-indigo-800 font-medium" (click)="$event.stopPropagation()">silaBook</a> để dịch.
                </p>
              </div>
            </div>
          }
         </div>
      </div>
    </div>

    @if (showVideo()) {
      <div role="button" tabindex="-1" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4" (click)="showVideo.set(false)" (keydown)="showVideo.set(false)">
        <div role="dialog" tabindex="-1" class="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()">
          <button (click)="showVideo.set(false)" class="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors backdrop-blur-md">
            <mat-icon class="!w-6 !h-6 !text-[24px]">close</mat-icon>
          </button>
          <iframe class="w-full h-full" src="https://www.youtube.com/embed/mWlgsCRZJS8?autoplay=1" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      </div>
    }
  `
})
export class Uploader {
  store = inject(BookStore);
  gemini = inject(GeminiClient);
  toast = inject(ToastService);
  pdfService = inject(PdfService);
  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  isDragging = false;
  showVideo = signal(false);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const items = event.dataTransfer?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) this.processFile(file);
          break;
        }
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  isAllCompleted(chunks: import('../../core/db').PdfConversionChunk[]) {
    return chunks.every(c => c.status === 'completed');
  }

  async processFile(file: File) {
    if (this.store.isConverting()) return;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    // File size validation
    const LIMITS: Record<string, number> = {
       'pdf': 200 * 1024 * 1024,
    };

    if (ext && ext in LIMITS) {
       const limit = LIMITS[ext];
       if (file.size > limit) {
         const limitMB = limit / (1024 * 1024);
         this.toast.error(this.toast.Messages.FILE_TOO_LARGE(limitMB, ext));
         this.fileInput().nativeElement.value = '';
         return;
       }
    }
    
    if (ext === 'pdf') {
       this.store.setConverting(true);
       
       try {
         const buffer = await file.arrayBuffer();
         const result = await this.pdfService.runWorkerTask('COUNT_PAGES', { arrayBuffer: buffer });
         const count = result.count || 0;
         
         const pristinePdfData = new Uint8Array(buffer);
         
         if (!this.store.currentProjectId()) {
           await this.store.createNewProject(file.name.replace(/\.[^/.]+$/, ''));
         }
         
         this.store.setPdf(pristinePdfData, file.name, count);
         this.toast.success('Đã tải PDF thành công. Vui lòng thiết lập chia chương.', 4900);
       } catch (e) {
         console.error('Failed to parse PDF', e);
         this.toast.error('Lỗi đọc PDF');
       } finally {
         this.store.setConverting(false);
         if (this.fileInput()) {
           this.fileInput().nativeElement.value = '';
         }
       }
       return;
    } else {
       this.toast.error(this.toast.Messages.FILE_INVALID_FORMAT);
       if (this.fileInput()) {
         this.fileInput().nativeElement.value = '';
       }
       return;
    }
  }
}


import { Component, ChangeDetectionStrategy, signal, inject, HostListener, ElementRef } from '@angular/core';
import { GeminiClient } from '../../core/gemini/client';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/toast.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-translator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, FormsModule],
  template: `
    <div class="relative w-full max-w-lg mx-auto" (click)="onComponentClick($event)">
      <div class="relative flex items-center">
        <mat-icon class="absolute left-4 text-zinc-400 opacity-40 pointer-events-none !text-[20px] !w-[20px] !h-[20px]">search</mat-icon>
        <input 
          type="text" 
          [(ngModel)]="searchQuery"
          (keydown.enter)="onSearch()"
          placeholder="Dịch từ khóa tiếng Việt sang tiếng Anh, tìm kiếm file PDF..." 
          class="w-full bg-zinc-100 border-none rounded-full py-2.5 pl-11 pr-10 text-base focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-zinc-700 placeholder-zinc-400"
          [disabled]="isTranslating()"
        >
        @if (isTranslating()) {
          <div class="absolute right-4 animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
        } @else if (searchQuery()) {
          <button (click)="clearSearch()" class="absolute right-4 text-zinc-400 hover:text-zinc-600 flex items-center">
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">close</mat-icon>
          </button>
        }
      </div>

      @if (translatedQuery() && showDropdown()) {
        <div class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-zinc-200 z-50 p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Từ khóa Tiếng Anh:</div>
          </div>
          
          <div class="text-lg font-medium text-zinc-900 mb-5 break-words">
            {{ translatedQuery() }}
          </div>
          
          <a 
            [href]="'https://www.google.com/search?q=' + encodeQuery(translatedQuery() + ' filetype:pdf')" 
            target="_blank"
            class="flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
            (click)="onDropdownClick()"
          >
            Mở Google Search <mat-icon class="!text-[18px] !w-[18px] !h-[18px] ml-2">open_in_new</mat-icon>
          </a>
        </div>
      }
    </div>
  `
})
export class SearchTranslatorComponent {
  private geminiClient = inject(GeminiClient);
  private toast = inject(ToastService);
  private elementRef = inject(ElementRef);

  searchQuery = signal('');
  translatedQuery = signal('');
  isTranslating = signal(false);
  showDropdown = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showDropdown.set(false);
    }
  }

  onComponentClick(event: MouseEvent) {
    if (this.translatedQuery()) {
      this.showDropdown.set(true);
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.translatedQuery.set('');
    this.showDropdown.set(false);
  }

  async onSearch() {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.isTranslating.set(true);
    this.showDropdown.set(false);
    
    try {
      const result = await this.geminiClient.translateSearchQuery(query);
      if (result) {
        this.translatedQuery.set(result);
        this.showDropdown.set(true);
      } else {
        this.toast.error('Không thể dịch từ khoá. Vui lòng thử lại.');
      }
    } catch (e) {
      this.toast.error('Đã xảy ra lỗi khi dịch từ khoá.');
    } finally {
      this.isTranslating.set(false);
    }
  }

  encodeQuery(query: string): string {
    return encodeURIComponent(query);
  }

  onDropdownClick() {
    this.showDropdown.set(false);
  }
}

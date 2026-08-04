import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { DbService, Project } from '../../core/db';
import { BookStore } from '../../core/book.store';
import { ToastService } from '../../core/toast.service';
import { DatePipe } from '@angular/common';
import JSZip from 'jszip';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 cursor-pointer animate-fade-in" tabindex="0" (click)="triggerClose()" (keydown.escape)="triggerClose()" [class.animate-fade-out]="isClosing()">
      <div role="presentation" tabindex="-1" (keyup.enter)="$event.stopPropagation()" class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden cursor-default animate-zoom-in" (click)="$event.stopPropagation()" [class.animate-zoom-out]="isClosing()">
        <div class="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/80">
          <h2 class="text-xl font-bold text-zinc-900">Quản lý dự án</h2>
          <div class="flex items-center gap-2">
            <button (click)="fileInput.click()" class="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors flex items-center gap-1">
              <span class="material-icons text-[18px]">file_upload</span> Nhập dự án
            </button>
            <input #fileInput type="file" accept=".zip" class="hidden" (change)="importProject($event)" />
            <button (click)="triggerClose()" class="text-zinc-400 hover:text-zinc-700 w-8 h-8 rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center">
              <span class="material-icons !text-[20px] !w-5 !h-5 !flex !items-center !justify-center leading-none">close</span>
            </button>
          </div>
        </div>
        
        <div class="p-6 overflow-y-auto flex-1 bg-white">
          @if (isLoading()) {
            <div class="flex justify-center items-center h-32">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          } @else if (projects().length === 0) {
            <div class="text-center py-12">
              <div class="bg-zinc-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span class="material-icons text-zinc-400 text-3xl">folder_open</span>
              </div>
              <h3 class="text-lg font-medium text-zinc-900 mb-1">Chưa có dự án nào</h3>
              <p class="text-zinc-500">Hãy tạo dự án mới để bắt đầu dịch sách.</p>
              
              <button (click)="closeAndGoHome()" class="mt-6 text-indigo-600 font-medium hover:text-indigo-700 underline underline-offset-2">
                Quay lại trang chủ tạo dự án
              </button>
            </div>
          } @else {
            <div class="grid gap-4">
              @for (p of projects(); track p.id) {
                <div class="border border-zinc-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col gap-4 bg-white relative overflow-hidden"
                     [class.ring-2]="store.currentProjectId() === p.id" [class.ring-indigo-500]="store.currentProjectId() === p.id">
                  
                  @if (store.currentProjectId() === p.id) {
                    <div class="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                    <div class="absolute left-1 top-0 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-b-md shadow-sm z-10">
                      Đang mở
                    </div>
                  }
                  
                  <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-4 w-full">
                    <div class="flex-1 cursor-pointer min-w-0" [class.mt-2]="store.currentProjectId() === p.id" role="button" tabindex="0" (keydown.enter)="loadProject(p.id)" (click)="loadProject(p.id)">
                      <div class="flex items-start justify-between gap-3">
                        <h3 class="font-bold text-base text-zinc-900 mb-1 line-clamp-2" [title]="p.name">
                          {{p.name}}
                        </h3>
                      </div>
                      <div class="flex flex-col gap-2 w-full mt-2">
                        <div class="flex flex-wrap items-center text-sm text-zinc-500 gap-x-4 gap-y-2">
                          <span class="flex items-center" title="Ngày tạo ban đầu."><span class="material-icons text-[16px] mr-1 opacity-70">add_circle_outline</span> {{p.createdAt | date:'dd/MM/yy HH:mm'}}</span>
                          @if (p.importedAt) {
                            <span class="flex items-center text-indigo-600 font-medium" title="Ngày nhập vào máy."><span class="material-icons text-[16px] mr-1">publish</span> {{p.importedAt | date:'dd/MM/yy HH:mm'}}</span>
                          }
                        </div>
                        <div class="flex flex-wrap items-center text-sm text-zinc-500 gap-x-4 gap-y-2">
                          <span class="flex items-center">
                            <span class="w-2 h-2 rounded-full mr-1.5" 
                                  [class.bg-zinc-400]="p.phase === 1"
                                  [class.bg-yellow-400]="p.phase === 2"
                                  [class.bg-purple-500]="p.phase === 3"
                                  [class.bg-indigo-500]="p.phase === 4"
                                  [class.bg-green-500]="p.phase === 5"></span>
                            Giai đoạn {{p.phase}}: 
                            {{p.phase === 1 ? 'Tải lên' : (p.phase === 2 ? 'Chia chương' : (p.phase === 3 ? 'Đại từ' : (p.phase === 4 ? 'Từ khó' : 'Dịch thuật')))}}
                          </span>
                          @if (p.pdfTaskMeta) {
                             <span class="flex items-center text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-xs font-medium border border-orange-100 uppercase tracking-wide">
                               <span class="material-icons !text-[14px] !w-3.5 !h-3.5 mr-1 leading-none flex items-center justify-center">warning</span> {{ p.pdfTaskMeta.chunkCount > 0 ? 'Gián đoạn PDF' : 'PDF' }}
                             </span>
                          }
                        </div>
                        @if (getProgress(p); as prog) {
                          <div class="w-full sm:w-2/3 max-w-sm mt-1.5 mb-1 animate-fade-in">
                            <div class="flex items-center gap-3">
                              <div class="flex-1 overflow-hidden h-1.5 bg-zinc-200 rounded-full">
                                <div class="h-full rounded-full transition-all duration-300" [class]="prog.barColorClass" [style.width.%]="prog.percentage"></div>
                              </div>
                              <span class="text-xs font-bold min-w-[2.5rem] text-right" [class]="prog.textColorClass">{{prog.percentage}}%</span>
                            </div>
                            <p class="text-[11px] text-zinc-400 mt-0.5 font-medium flex items-center gap-1">
                              <span class="material-icons text-[12px] opacity-75">layers</span>
                              Đã dịch {{prog.translated}} / {{prog.total}} khối
                            </p>
                          </div>
                        }
                      </div>
                    </div>
                    
                    <div class="flex sm:flex-col gap-2 min-w-[120px] justify-center">
                      @if (confirmingDeleteId() === p.id) {
                        <div class="flex flex-col gap-2 p-2 bg-red-50 rounded-lg border border-red-100 w-full animate-in fade-in duration-200">
                          <span class="text-xs text-red-700 font-medium text-center">Xóa dự án này?</span>
                          <div class="flex gap-2">
                            <button (click)="deleteProject(p.id, $event)" class="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-colors text-center shadow-sm">
                              Có
                            </button>
                            <button (click)="cancelDelete($event)" class="flex-1 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-md text-xs font-semibold transition-colors text-center shadow-sm">
                              Không
                            </button>
                          </div>
                        </div>
                      } @else {
                        <button (click)="exportProjectData(p, $event)" class="px-4 py-2 w-full bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors border border-purple-200 shadow-sm text-center flex items-center justify-center gap-1.5" title="Xuất toàn bộ dữ liệu dự án (.zip).&#10;Cho mục đích lưu trữ hoặc nhập vào tài khoản khác dịch tiếp.">
                          <span class="material-icons text-[18px]">save_alt</span> Sao lưu dự án
                        </button>
                        <button (click)="loadProject(p.id)" class="px-4 py-2 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors border border-indigo-200 shadow-sm text-center flex items-center justify-center gap-1.5">
                          <span class="material-icons text-[18px]">folder_open</span> Mở dự án
                        </button>
                        <button (click)="initiateDelete(p.id, $event)" class="px-4 py-2 w-full bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors border border-red-200 shadow-sm text-center flex items-center justify-center gap-1.5">
                          <span class="material-icons text-[18px]">delete</span> Xóa bỏ
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class ProjectModal implements OnInit {
  db = inject(DbService);
  store = inject(BookStore);
  toast = inject(ToastService);
  
  projects = signal<Project[]>([]);
  isLoading = signal(true);
  confirmingDeleteId = signal<string | null>(null);
  isClosing = signal(false);
  
  @Output() closeModal = new EventEmitter<void>();

  private projectWorker = new Worker(new URL('./project.worker', import.meta.url), { type: 'module' });
  private workerId = 0;

  private runProjectWorkerTask(type: string, payload: unknown): Promise<{ jsonStr?: string; project?: Project; error?: string; [key: string]: unknown }> {
    return new Promise((resolve, reject) => {
      const id = ++this.workerId;
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          this.projectWorker.removeEventListener('message', handler);
          if (event.data.type === 'SUCCESS') {
            resolve(event.data.payload);
          } else {
            reject(new Error(event.data.payload.error));
          }
        }
      };
      this.projectWorker.addEventListener('message', handler);
      this.projectWorker.postMessage({ type, payload, id });
    });
  }

  triggerClose() {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closeModal.emit();
    }, 200); // 200ms matches the animation duration
  }

  ngOnInit() {
    this.loadProjects();
  }

  async loadProjects() {
    this.isLoading.set(true);
    const list = await this.db.getAllProjects();
    // Sort by importedAt (if available) or createdAt descending
    list.sort((a, b) => (b.importedAt ?? b.createdAt) - (a.importedAt ?? a.createdAt));

    // Auto-migrate metadata for old projects to populate totalChunks/translatedChunks
    for (const p of list) {
      if (p.phase >= 3 && (p.totalChunks === undefined || p.translatedChunks === undefined)) {
        try {
          const fullProj = await this.db.getProject(p.id);
          if (fullProj && fullProj.chapters) {
            const totalChunks = fullProj.chapters.length;
            const translatedChunks = fullProj.chapters.filter(c => c.status === 'done').length;
            
            p.totalChunks = totalChunks;
            p.translatedChunks = translatedChunks;
            
            let totalPages = 0;
            let translatedPages = 0;
            fullProj.chapters.forEach(c => {
              let chapterPages = 1;
              if (c.startPage !== undefined && c.endPage !== undefined) {
                chapterPages = Math.max(1, c.endPage - c.startPage + 1);
              } else if (c.originalPdfPages !== undefined) {
                chapterPages = Math.max(1, c.originalPdfPages);
              }
              totalPages += chapterPages;
              if (c.status === 'done') {
                translatedPages += chapterPages;
              }
            });
            p.totalPages = totalPages;
            p.translatedPages = translatedPages;

            await this.db.updateProjectStats(p.id, fullProj.chapters);
          }
        } catch (err) {
          console.error('Failed to auto-migrate stats for project', p.id, err);
        }
      }
    }

    this.projects.set(list);
    this.isLoading.set(false);
  }

  async loadProject(id: string) {
    if (this.store.currentProjectId() !== id) {
      this.triggerClose(); // Close UI with animation
      await this.store.loadProject(id);
    } else {
      this.triggerClose();
    }
  }

  initiateDelete(id: string, event: Event) {
    event.stopPropagation();
    this.confirmingDeleteId.set(id);
  }

  cancelDelete(event: Event) {
    event.stopPropagation();
    this.confirmingDeleteId.set(null);
  }

  async exportProjectData(p: Project, event: Event) {
    event.stopPropagation();
    const fullProject = await this.db.getProject(p.id);
    if (!fullProject) {
      this.toast.error('Dữ liệu dự án bị lỗi, không thể xuất bản');
      return;
    }
    
    this.toast.info('Đang nén dữ liệu dự án và tạo file sao lưu .zip... Xin vui lòng chờ');
    
    try {
      const zip = new JSZip();
      
      // Separate the huge binary and base64 parts from the main JSON to keep JSON string length small
      const { rawPdf, images, pdfTask, chapters, pronounTask, glossaryTask, ...restProject } = fullProject;
      
      // Create a clean copy of pdfTask, but without chunk binary pdfData or b64Data (we will save them separately)
      let cleanedPdfTask = null;
      if (pdfTask && pdfTask.chunks) {
        const chunkFolder = zip.folder('pdf_chunks');
        
        const cleanedChunks = pdfTask.chunks.map(chunk => {
          // 1. Extract binary data from pdfData or b64Data
          let binaryData: Uint8Array | null = null;
          
          if (chunk.pdfData) {
            if (chunk.pdfData instanceof Uint8Array) {
              binaryData = chunk.pdfData;
            } else if ((chunk.pdfData as { buffer?: ArrayBuffer }).buffer) {
              binaryData = new Uint8Array((chunk.pdfData as { buffer?: ArrayBuffer }).buffer as ArrayBuffer);
            } else if (typeof chunk.pdfData === 'object') {
              binaryData = new Uint8Array(Object.values(chunk.pdfData));
            }
          }
          
          if (!binaryData) {
            const b64 = chunk.b64Data || (chunk as { base64Pdf?: string }).base64Pdf;
            if (b64 && typeof b64 === 'string') {
              try {
                const binaryString = self.atob(b64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                binaryData = bytes;
              } catch (err) {
                console.error('Error parsing chunk base64 data', err);
              }
            }
          }
          
          // 2. Save chunk PDF binary file separately in zip
          if (binaryData && chunkFolder) {
            chunkFolder.file(`chunk_${chunk.index}.bin`, binaryData);
          }
          
          // 3. Return clean chunk without large data properties to keep project.json tiny
          const restChunk = { ...chunk };
          delete restChunk.pdfData;
          delete (restChunk as { b64Data?: string }).b64Data;
          delete (restChunk as { base64Pdf?: string }).base64Pdf;
          return restChunk;
        });
        
        cleanedPdfTask = {
          ...pdfTask,
          chunks: cleanedChunks
        };
      }

      // Create a clean copy of pronounTask without the huge PDF base64 strings in chunks
      let cleanedPronounTask = null;
      if (pronounTask) {
        let cleanedChunks = null;
        if (pronounTask.chunks) {
          cleanedChunks = pronounTask.chunks.map(chunk => {
            const restChunk = { ...chunk };
            delete restChunk.pdfBase64;
            return restChunk;
          });
        }
        cleanedPronounTask = {
          ...pronounTask,
          chunks: cleanedChunks
        };
      }

      // Create a clean copy of glossaryTask without the huge PDF base64 strings in chunks
      let cleanedGlossaryTask = null;
      if (glossaryTask) {
        let cleanedChunks = null;
        if (glossaryTask.chunks) {
          cleanedChunks = glossaryTask.chunks.map(chunk => {
            const restChunk = { ...chunk };
            delete restChunk.pdfBase64;
            return restChunk;
          });
        }
        cleanedGlossaryTask = {
          ...glossaryTask,
          chunks: cleanedChunks
        };
      }

      // Create a clean copy of chapters without the huge PDF base64 strings
      let cleanedChapters = null;
      if (chapters) {
        const chaptersPdfFolder = zip.folder('chapters_pdf');
        cleanedChapters = chapters.map(chapter => {
          // Process originalPdfBase64
          if (chapter.originalPdfBase64 && chaptersPdfFolder) {
            try {
              const binaryString = self.atob(chapter.originalPdfBase64);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              chaptersPdfFolder.file(`chapter_${chapter.id}_original.bin`, bytes);
            } catch (err) {
              console.error(`Error saving original pdf for chapter ${chapter.id}`, err);
            }
          }

          // Return a clean chapter record with metadata and translated markdown text, but no huge base64 strings!
          const restChapter = { ...chapter };
          delete restChapter.originalPdfBase64;
          return restChapter;
        });
      }
      
      const projectJsonObj = {
        ...restProject,
        chapters: cleanedChapters,
        pdfTask: cleanedPdfTask,
        pronounTask: cleanedPronounTask,
        glossaryTask: cleanedGlossaryTask
      };
      
      // 1. Add metadata/chapters as project.json (Now extremely light!)
      zip.file('project.json', JSON.stringify(projectJsonObj, null, 2));
      
      // 2. Add raw PDF binary if it exists
      if (rawPdf) {
        zip.file('raw_pdf.bin', rawPdf);
      }
      
      // 3. Add images folder if images exist
      if (images) {
        const imgFolder = zip.folder('images');
        if (imgFolder) {
          for (const [imgId, dataUrl] of Object.entries(images)) {
            imgFolder.file(`${imgId}.txt`, dataUrl);
          }
        }
      }
      
      // Generate the ZIP file as a blob using DEFLATE compression to keep file size optimized
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `1987Project_${p.name.replace(/\s+/g, '_')}_${p.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.toast.success(this.toast.Messages.PROJECT_BACKUP_SUCCESS);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error('Lỗi khi xuất dữ liệu dự án: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }

  async importProject(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    if (!file.name.endsWith('.zip')) {
      this.toast.error('Ứng dụng hiện tại chỉ hỗ trợ nhập dữ liệu dự án từ tệp sao lưu định dạng .zip. Vui lòng chọn tệp tin .zip hợp lệ.');
      input.value = '';
      return;
    }
    
    try {
      this.toast.info('Đang giải nén và nhập dữ liệu dự án... Xin vui lòng chờ');
      const zip = await JSZip.loadAsync(file);
      
      // 1. Read project.json
      const jsonFile = zip.file('project.json');
      if (!jsonFile) {
        this.toast.error('Tập tin ZIP không hợp lệ (không tìm thấy file project.json)');
        input.value = '';
        return;
      }
      const jsonText = await jsonFile.async('text');
      const proj: Project = JSON.parse(jsonText);
      
      // 2. Read raw_pdf.bin if it exists
      const rawPdfFile = zip.file('raw_pdf.bin');
      if (rawPdfFile) {
        const rawPdfBuffer = await rawPdfFile.async('uint8array');
        proj.rawPdf = rawPdfBuffer;
      }
      
      // 3. Read images if they exist
      const images: Record<string, string> = {};
      const imagesFolder = zip.folder('images');
      if (imagesFolder) {
        const imageFiles: { name: string; file: JSZip.JSZipObject }[] = [];
        imagesFolder.forEach((relativePath, imgFile) => {
          if (imgFile.name.endsWith('.txt')) {
            imageFiles.push({ name: relativePath, file: imgFile });
          }
        });
        
        for (const item of imageFiles) {
          const imgId = item.name.replace('.txt', '');
          const dataUrl = await item.file.async('text');
          images[imgId] = dataUrl;
        }
      }
      if (Object.keys(images).length > 0) {
        proj.images = images;
      }
      
      // 4. Read pdf_chunks if they exist
      const chunkFolder = zip.folder('pdf_chunks');
      if (chunkFolder && proj.pdfTask && proj.pdfTask.chunks) {
        for (const chunk of proj.pdfTask.chunks) {
          const chunkFile = zip.file(`pdf_chunks/chunk_${chunk.index}.bin`);
          if (chunkFile) {
            const chunkBuffer = await chunkFile.async('uint8array');
            chunk.pdfData = chunkBuffer;
            
            // Re-generate base64 b64Data string to ensure full compatibility with application
            let binary = '';
            const len = chunkBuffer.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(chunkBuffer[i]);
            }
            chunk.b64Data = self.btoa(binary);
          }
        }
      }
      
      // 5. Read chapter PDFs if they exist (under chapters_pdf/ folder)
      const chaptersPdfFolder = zip.folder('chapters_pdf');
      if (chaptersPdfFolder && proj.chapters) {
        for (const chapter of proj.chapters) {
          // Read original PDF chunk
          const origFile = zip.file(`chapters_pdf/chapter_${chapter.id}_original.bin`);
          if (origFile) {
            const origBuffer = await origFile.async('uint8array');
            let binary = '';
            const len = origBuffer.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(origBuffer[i]);
            }
            chapter.originalPdfBase64 = self.btoa(binary);
          }
        }
      }
      
      if (!proj || !proj.id || !proj.name) {
        this.toast.error(this.toast.Messages.PROJECT_IMPORT_DRAFT_ERROR);
        return;
      }
      
      // Always generate a new unique ID for imported projects to prevent ANY collision
      // since users might import a project they already have, or deleted and re-imported.
      const newProjectId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const existingIds = this.projects().map(p => p.id);
      
      if (existingIds.includes(proj.id)) {
        proj.name = `${proj.name} (Imported)`;
      }
      proj.id = newProjectId;
      
      // We MUST assign new unique IDs to the imported chapters, because IndexedDB uses `id` as the primary key.
      // If we don't, importing the same project again will overwrite the old project's chapters in the DB!
      if (proj.chapters) {
        proj.chapters = proj.chapters.map((c, idx) => ({
          ...c,
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9) + idx
        }));
      }
      
      proj.updatedAt = Date.now();
      proj.importedAt = Date.now();
      
      await this.db.saveProject(proj);
      this.toast.success(this.toast.Messages.PROJECT_IMPORT_SUCCESS);
      await this.loadProject(proj.id);
    } catch (e: unknown) {
      console.error(e);
      this.toast.error(this.toast.Messages.PROJECT_IMPORT_ERROR);
    } finally {
      input.value = ''; // Reset the input
    }
  }

  async deleteProject(id: string, event: Event) {
    event.stopPropagation();
    await this.db.deleteProject(id);
    this.toast.success(this.toast.Messages.PROJECT_DELETE_SUCCESS);
    if (this.store.currentProjectId() === id) {
       this.store.closeProject();
    }
    this.confirmingDeleteId.set(null);
    await this.loadProjects();
  }
  
  closeAndGoHome() {
    this.store.closeProject();
    this.triggerClose();
  }

  getProgress(p: Project) {
    if (p.phase < 3) return null;

    let total = 0;
    let translated = 0;

    if (p.totalChunks !== undefined && p.totalChunks > 0) {
      total = p.totalChunks;
      translated = p.translatedChunks || 0;
    } else if (p.chapters && p.chapters.length > 0) {
      total = p.chapters.length;
      translated = p.chapters.filter(c => c.status === 'done').length;
    } else if (p.pdfTaskMeta && p.pdfTaskMeta.chunkCount > 0) {
      total = p.pdfTaskMeta.chunkCount;
      translated = 0;
    }

    if (total === 0) return null;
    const percentage = Math.round((translated / total) * 100);
    
    let barColorClass = 'bg-indigo-500';
    let textColorClass = 'text-indigo-600';
    if (percentage === 100) {
      barColorClass = 'bg-green-500';
      textColorClass = 'text-green-600';
    } else if (percentage === 0) {
      textColorClass = 'text-zinc-500';
    }

    return { percentage, barColorClass, textColorClass, translated, total };
  }
}

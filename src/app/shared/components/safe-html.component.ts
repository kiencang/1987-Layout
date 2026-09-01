import {
  Component,
  Input,
  ChangeDetectionStrategy,
  inject,
  ElementRef,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
  output
} from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-safe-html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <iframe
      #iframeEl
      class="safe-html-iframe w-full border-0 block overflow-hidden"
      [style.height.px]="iframeHeight"
      sandbox="allow-scripts allow-same-origin"
      title="Chapter Content"
    ></iframe>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .safe-html-iframe {
      width: 100%;
      border: 0;
      display: block;
      overflow: hidden;
      background: transparent;
      transition: height 0.15s ease-out;
    }
  `]
})
export class SafeHtmlComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() htmlContent: SafeHtml | string = '';
  @Input() fontFamily = '';
  readonly pageClick = output<number>();

  @ViewChild('iframeEl') iframeRef!: ElementRef<HTMLIFrameElement>;

  iframeHeight = 150;
  private cdr = inject(ChangeDetectorRef);
  private resizeObserver?: ResizeObserver;
  private messageListener?: (event: MessageEvent) => void;

  ngAfterViewInit(): void {
    this.setupMessageListener();
    this.updateIframeContent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['htmlContent'] || changes['fontFamily']) && this.iframeRef) {
      this.updateIframeContent();
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.messageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageListener);
    }
  }

  scrollToPage(pageNumber: number): void {
    try {
      const iframe = this.iframeRef?.nativeElement;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'SILA_SCROLL_TO_PAGE', page: pageNumber }, '*');
      }
    } catch (e) {
      console.warn('Could not postMessage to iframe:', e);
    }
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    this.messageListener = (event: MessageEvent) => {
      // Ensure the message came from this iframe instance if possible
      const currentWin = this.iframeRef?.nativeElement?.contentWindow;
      if (currentWin && event.source && event.source !== currentWin) {
        return;
      }

      if (event.data && event.data.type === 'SILA_IFRAME_RESIZE' && typeof event.data.height === 'number') {
        const newHeight = Math.max(event.data.height, 40) + 8;
        if (Math.abs(this.iframeHeight - newHeight) > 2) {
          this.iframeHeight = newHeight;
          this.cdr.markForCheck();
        }
      }

      if (event.data && event.data.type === 'SILA_PAGE_BREAK_CLICK' && typeof event.data.page === 'number') {
        this.pageClick.emit(event.data.page);
      }
    };
    window.addEventListener('message', this.messageListener);
  }

  private updateIframeContent(): void {
    const iframe = this.iframeRef?.nativeElement;
    if (!iframe) return;

    let rawContent = '';
    if (typeof this.htmlContent === 'string') {
      rawContent = this.htmlContent;
    } else if (this.htmlContent) {
      const obj = this.htmlContent as unknown as Record<string, unknown>;
      rawContent = typeof obj['changingThisBreaksApplicationSecurity'] === 'string'
        ? (obj['changingThisBreaksApplicationSecurity'] as string)
        : String(this.htmlContent);
    }

    if (!rawContent || !rawContent.trim()) {
      rawContent = '<p style="color: #a1a1aa; font-style: italic;">Không có nội dung</p>';
    }

    // Transform page break comments into interactive visual button dividers
    rawContent = rawContent.replace(/<!--\s*PAGE_BREAK:\s*(\d+)\s*-->/gi, (_match, pageNum) => {
      return `<div class="page-break-divider" id="page-break-${pageNum}" data-page="${pageNum}">
        <div class="page-break-line"></div>
        <button type="button" class="page-sync-btn" data-page="${pageNum}" title="Nhấn để đồng bộ cuộn đến Trang ${pageNum} ở bản gốc">
          <svg class="page-sync-icon-book" viewBox="0 0 24 24" width="11.5" height="11.5" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
          <span class="page-sync-text">Trang ${pageNum}</span>
          <svg class="page-sync-icon-sync" viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        </button>
        <div class="page-break-line"></div>
      </div>`;
    });

    // Convert MathJax v2 script tags if present
    rawContent = rawContent.replace(/<script[^>]*type=["']math\/tex;?\s*mode=display["'][^>]*>([\s\S]*?)<\/script>/gi, '\\[$1\\]');
    rawContent = rawContent.replace(/<script[^>]*type=["']math\/tex["'][^>]*>([\s\S]*?)<\/script>/gi, '\\($1\\)');

    const fontStyle = this.fontFamily
      ? `font-family: ${this.fontFamily};`
      : `font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;`;

    const fullDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      color: #18181b;
      ${fontStyle}
      font-size: 16px;
      line-height: 1.7;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    body {
      padding: 4px 0;
    }
    p { margin-top: 0; margin-bottom: 1rem; }
    p:last-child { margin-bottom: 0; }
    h1, h2, h3, h4, h5, h6 { font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; line-height: 1.3; color: #18181b; }
    h1 { font-size: 1.75rem; }
    h2 { font-size: 1.5rem; }
    h3 { font-size: 1.25rem; }
    h4 { font-size: 1.1rem; }
    ul, ol { margin-top: 0.5rem; margin-bottom: 1rem; padding-left: 1.5rem; }
    ul { list-style-type: disc; }
    ol { list-style-type: decimal; }
    li { margin-bottom: 0.25rem; }
    img { max-width: 100%; height: auto; display: inline-block; border-radius: 0.375rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.875rem; }
    th, td { border: 1px solid #e4e4e7; padding: 0.5rem 0.75rem; text-align: left; }
    th { background-color: #f4f4f5; font-weight: 600; color: #18181b; }
    tr:nth-child(even) { background-color: #fafafa; }
    blockquote { border-left: 4px solid #e4e4e7; padding-left: 1rem; color: #52525b; font-style: italic; margin: 1rem 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background-color: #f4f4f5; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875em; color: #09090b; }
    pre { background-color: #18181b; color: #f4f4f5; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 1rem 0; }
    pre code { background-color: transparent; padding: 0; color: inherit; }
    a { color: #2563eb; text-decoration: underline; }
    .footnote-highlight { background-color: #fef08a; transition: background-color 300ms ease-in-out; border-radius: 0.25rem; padding: 0 0.25rem; }

    /* Page Break Divider & Sync Button */
    .page-break-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 22px 0 16px 0;
      padding: 2px 0;
      user-select: none;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .page-break-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, #cbd5e1 30%, #cbd5e1 70%, transparent);
    }
    .page-sync-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 2.5px 22px;
      min-height: 22px;
      line-height: 1.2;
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      outline: none;
    }
    .page-sync-btn:hover {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4338ca;
      box-shadow: 0 3px 6px -1px rgba(79, 70, 229, 0.25);
      transform: translateY(-0.5px);
    }
    .page-sync-btn:active {
      transform: translateY(0);
      background: #4338ca;
    }
    .page-sync-btn svg {
      flex-shrink: 0;
      transition: transform 0.3s ease;
    }
    .page-sync-btn:hover .page-sync-icon-sync {
      transform: rotate(180deg);
    }
    .page-highlight-active {
      background: #e0e7ff !important;
      color: #3730a3 !important;
      border-color: #6366f1 !important;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3) !important;
      animation: pulse-badge 2s ease-in-out;
    }
    @keyframes pulse-badge {
      0% { transform: scale(1); }
      30% { transform: scale(1.06); }
      60% { transform: scale(0.98); }
      100% { transform: scale(1); }
    }
  </style>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      },
      startup: {
        pageReady: function() {
          return MathJax.startup.defaultPageReady().then(function() {
            notifyParentResize();
          });
        }
      }
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
  <div id="content-root">${rawContent}</div>
  <script>
    function notifyParentResize() {
      var root = document.getElementById('content-root') || document.body;
      var h = Math.max(
        root ? root.scrollHeight : 0,
        root ? root.offsetHeight : 0,
        document.body ? document.body.scrollHeight : 0,
        document.body ? document.body.offsetHeight : 0
      );
      if (window.parent && h > 0) {
        window.parent.postMessage({ type: 'SILA_IFRAME_RESIZE', height: h }, '*');
      }
    }

    window.addEventListener('load', function() {
      notifyParentResize();
      setTimeout(notifyParentResize, 300);
      setTimeout(notifyParentResize, 800);
      setTimeout(notifyParentResize, 2000);
    });
    window.addEventListener('resize', notifyParentResize);

    if (typeof ResizeObserver !== 'undefined' && document.body) {
      new ResizeObserver(notifyParentResize).observe(document.body);
    }

    window.addEventListener('message', function(ev) {
      if (ev.data && ev.data.type === 'SILA_SCROLL_TO_PAGE' && typeof ev.data.page === 'number') {
        var el = document.getElementById('page-break-' + ev.data.page);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var b = el.querySelector('.page-sync-btn');
          if (b) {
            b.classList.add('page-highlight-active');
            setTimeout(function() { b.classList.remove('page-highlight-active'); }, 2500);
          }
        }
      }
    });

    document.addEventListener('click', function(e) {
      var btn = e.target.closest('.page-sync-btn');
      if (btn) {
        e.preventDefault();
        var pageStr = btn.getAttribute('data-page');
        var pageNum = parseInt(pageStr, 10);
        if (!isNaN(pageNum) && window.parent) {
          window.parent.postMessage({ type: 'SILA_PAGE_BREAK_CLICK', page: pageNum }, '*');
        }
        return;
      }

      var anchor = e.target.closest('a');
      if (anchor) {
        var href = anchor.getAttribute('href');
        if (href && (href.startsWith('#fn') || href.startsWith('#footnote'))) {
          e.preventDefault();
          var target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('footnote-highlight');
            setTimeout(function() { target.classList.remove('footnote-highlight'); }, 2000);
          }
        }
      }
    });
  </script>
</body>
</html>`;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(fullDoc);
        doc.close();

        const checkHeightDirectly = () => {
          try {
            const currentDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (currentDoc && currentDoc.body) {
              const root = currentDoc.getElementById('content-root') || currentDoc.body;
              const h = Math.max(root.scrollHeight, root.offsetHeight, currentDoc.body.scrollHeight, currentDoc.body.offsetHeight) + 8;
              if (h > 20 && Math.abs(this.iframeHeight - h) > 2) {
                this.iframeHeight = h;
                this.cdr.markForCheck();
              }
            }
          } catch {
            // ignore
          }
        };

        iframe.onload = () => {
          checkHeightDirectly();
          if (doc.body && typeof ResizeObserver !== 'undefined') {
            if (this.resizeObserver) this.resizeObserver.disconnect();
            this.resizeObserver = new ResizeObserver(() => checkHeightDirectly());
            this.resizeObserver.observe(doc.body);
          }
        };

        setTimeout(checkHeightDirectly, 100);
        setTimeout(checkHeightDirectly, 500);
        setTimeout(checkHeightDirectly, 1200);
      }
    } catch (err) {
      console.error('Error updating iframe content:', err);
    }
  }
}

import { Component, Input, ViewEncapsulation, ChangeDetectionStrategy, inject, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-safe-html',
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(click)': 'onLinkClick($event)'
  },
  template: `
    <style>
      :host {
        display: block;
        width: 100%;
        max-width: 100%;
        color: var(--safe-html-color, inherit);
        font-family: var(--safe-html-font-family, inherit);
      }
      
      .safe-content {
        line-height: 1.7;
        word-wrap: break-word;
        overflow-wrap: break-word;
      }

      p {
        margin-top: 0;
        margin-bottom: 1rem;
      }
      p:last-child {
        margin-bottom: 0;
      }

      h1, h2, h3, h4, h5, h6 {
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        line-height: 1.3;
        color: #18181b;
      }
      h1 { font-size: 1.75rem; }
      h2 { font-size: 1.5rem; }
      h3 { font-size: 1.25rem; }
      h4 { font-size: 1.1rem; }

      ul, ol {
        margin-top: 0.5rem;
        margin-bottom: 1rem;
        padding-left: 1.5rem;
      }
      ul { list-style-type: disc; }
      ol { list-style-type: decimal; }
      li { margin-bottom: 0.25rem; }

      blockquote {
        border-left: 4px solid #e4e4e7;
        padding-left: 1rem;
        color: #52525b;
        font-style: italic;
        margin: 1rem 0;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        background-color: #f4f4f5;
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
        font-size: 0.875em;
        color: #09090b;
      }

      pre {
        background-color: #18181b;
        color: #f4f4f5;
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 1rem 0;
      }
      pre code {
        background-color: transparent;
        padding: 0;
        color: inherit;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1rem 0;
        font-size: 0.875rem;
      }
      th, td {
        border: 1px solid #e4e4e7;
        padding: 0.5rem 0.75rem;
        text-align: left;
      }
      th {
        background-color: #f4f4f5;
        font-weight: 600;
        color: #18181b;
      }
      tr:nth-child(even) {
        background-color: #fafafa;
      }

      img {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1rem auto;
        display: block;
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
      }

      a {
        color: #2563eb;
        text-decoration: underline;
      }
      a:hover {
        color: #1d4ed8;
      }

      hr {
        border: 0;
        border-top: 1px solid #e4e4e7;
        margin: 1.5rem 0;
      }

      sup {
        font-size: 0.75em;
        vertical-align: super;
        line-height: 0;
      }
      .footnote-ref, .footnote-back {
        color: #2563eb;
        text-decoration: none;
      }

      .footnote-highlight {
        background-color: #fef08a;
        transition: background-color 300ms ease-in-out;
        border-radius: 0.25rem;
        padding: 0 0.25rem;
      }
    </style>
    <div class="safe-content" [innerHTML]="sanitizedContent"></div>
  `
})
export class SafeHtmlComponent implements OnChanges {
  @Input() htmlContent: SafeHtml | string = '';
  @Input() fontFamily = '';

  private sanitizer = inject(DomSanitizer);
  private elementRef = inject(ElementRef);
  sanitizedContent: SafeHtml = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['htmlContent']) {
      if (typeof this.htmlContent === 'string') {
        this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(this.htmlContent);
      } else {
        this.sanitizedContent = this.htmlContent;
      }
      this.renderMathJax();
    }
    if (changes['fontFamily'] && this.fontFamily) {
      this.elementRef.nativeElement.style.setProperty('--safe-html-font-family', this.fontFamily);
    }
  }

  private renderMathJax(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => {
      const shadowRoot = this.elementRef.nativeElement.shadowRoot as ShadowRoot | null;
      if (!shadowRoot) return;

      const syncStylesAndTypeset = () => {
        if (!window.MathJax || !window.MathJax.typesetPromise) return;

        const globalStyle = document.getElementById('MJX-CHTML-styles') || document.getElementById('MJX-SVG-styles');
        if (globalStyle && !shadowRoot.getElementById('MJX-CHTML-styles-scoped')) {
          const scopedStyle = globalStyle.cloneNode(true) as HTMLElement;
          scopedStyle.id = 'MJX-CHTML-styles-scoped';
          shadowRoot.appendChild(scopedStyle);
        }

        window.MathJax.typesetPromise([shadowRoot]).then(() => {
          const updatedGlobalStyle = document.getElementById('MJX-CHTML-styles') || document.getElementById('MJX-SVG-styles');
          if (updatedGlobalStyle) {
            const existingScoped = shadowRoot.getElementById('MJX-CHTML-styles-scoped');
            if (existingScoped) {
              existingScoped.textContent = updatedGlobalStyle.textContent;
            }
          }
        }).catch((err: unknown) => console.debug('MathJax typeset error:', err));
      };

      if (window.MathJax && window.MathJax.typesetPromise) {
        syncStylesAndTypeset();
      } else {
        let attempts = 0;
        const checkInterval = setInterval(() => {
          attempts++;
          if (window.MathJax && window.MathJax.typesetPromise) {
            clearInterval(checkInterval);
            syncStylesAndTypeset();
          } else if (attempts > 20) {
            clearInterval(checkInterval);
          }
        }, 200);
      }
    }, 50);
  }

  onLinkClick(event: MouseEvent): void {
    const path = event.composedPath ? event.composedPath() : [event.target];
    let anchor: HTMLAnchorElement | null = null;
    for (const el of path) {
      if (el instanceof HTMLAnchorElement) {
        anchor = el;
        break;
      }
    }

    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('#fn') || href.startsWith('#footnote'))) {
        event.preventDefault();
        event.stopPropagation();

        const id = href.substring(1);
        const shadowRoot = this.elementRef.nativeElement.shadowRoot;
        let targetElement: HTMLElement | null = null;
        if (shadowRoot) {
          try {
            targetElement = shadowRoot.querySelector(`[id="${CSS.escape(id)}"]`);
          } catch {
            targetElement = shadowRoot.getElementById(id);
          }
        }
        if (!targetElement) {
          targetElement = document.getElementById(id);
        }

        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.classList.add('footnote-highlight');
          setTimeout(() => {
            targetElement?.classList.remove('footnote-highlight');
          }, 2000);
        }
      }
    }
  }
}

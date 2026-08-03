import type { Chapter } from './book.store';
import { restoreImagePlaceholders } from './image-processor.util';

export const PRINT_PDF_STYLES = `
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

export function generateCombinedMarkdown(chapters: Chapter[], images: Record<string, string> | undefined): string {
  let combinedMarkdown = '';
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const isTrans = c.status === 'done' && !!c.translatedText;
    let chapterMarkdown = isTrans ? c.translatedText : c.originalText;
    if (chapterMarkdown) {
      chapterMarkdown = restoreImagePlaceholders(chapterMarkdown, images);
      const prefix = isTrans ? `c${i}-t` : `c${i}-o`;
      chapterMarkdown = chapterMarkdown.replace(/\[\^([^\]]+)\]/g, `[^${prefix}-$1]`);
      combinedMarkdown += chapterMarkdown + '\n\n';
    }
  }
  return combinedMarkdown;
}

export function generatePdfHtmlDoc(name: string, combinedMarkdown: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}_1987-Layout_vi</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${PRINT_PDF_STYLES}
</style>
</head>
<body>
<div class="content-wrapper">
${combinedMarkdown}
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
}

export function generateHtmlDoc(name: string, combinedMarkdown: string): string {
  const title = `${name || 'Untitled'}_1987-Layout_vi`;
  const trimmed = combinedMarkdown.trim().toLowerCase();
  
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
    return combinedMarkdown;
  }
  
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
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
${combinedMarkdown}
</body>
</html>`;
}

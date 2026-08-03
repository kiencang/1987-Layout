import TurndownService from 'turndown';

const turndownService = (() => {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  service.addRule('removeImages', {
    filter: 'img',
    replacement: () => ''
  });
  return service;
})();

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  try {
    // Pre-clean base64 image data strings and image placeholders
    const cleanedHtml = html
      .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '')
      .replace(/\{\{IMG_\d+\}\}/gi, '');

    let md = turndownService.turndown(cleanedHtml);
    // Extra safety: strip any markdown image syntax or leftover base64 strings
    md = md
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/gi, '');
    return md.trim();
  } catch (e) {
    console.warn('Turndown conversion failed, falling back to text strip:', e);
    return html
      .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\{\{IMG_\d+\}\}/gi, '')
      .trim();
  }
}

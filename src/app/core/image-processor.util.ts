import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is configured for pdfjs-dist
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export async function renderPdfToPageImages(
  pdfData: ArrayBuffer | Uint8Array,
  scale = 1.5
): Promise<string[]> {
  try {
    const raw = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
    const data = new Uint8Array(raw.byteLength);
    data.set(raw);
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;
    const pageImages: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        pageImages.push(canvas.toDataURL('image/jpeg', 0.90));
      }
    }
    return pageImages;
  } catch (err) {
    console.error('Lỗi khi render trang PDF sang hình ảnh:', err);
    return [];
  }
}

/**
 * Resizes image canvas keeping aspect ratio if any dimension > maxDim (default 1024),
 * and encodes to JPEG Data URI with specified quality (default 0.95 / 95%).
 */
export function resizeCanvasImage(
  canvas: HTMLCanvasElement,
  maxDim = 1024,
  quality = 0.95
): string {
  let width = canvas.width;
  let height = canvas.height;

  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, width, height);
      return tempCanvas.toDataURL('image/jpeg', quality);
    }
  }

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Extract images from PDF ArrayBuffer using pdfjs-dist.
 * Compresses images at 95% quality and maximum 1024px width/height.
 * Uses page-based image IDs: PAGE_X_IMG_Y (e.g., PAGE_5_IMG_2)
 */
export async function extractImagesFromPdf(
  arrayBuffer: ArrayBuffer,
  maxDim = 1024,
  quality = 0.95,
  existingMap: Record<string, string> = {},
  startPageNum = 1
): Promise<Record<string, string>> {
  const imagesMap: Record<string, string> = { ...existingMap };
  try {
    const data = new Uint8Array(arrayBuffer.slice(0));
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdfDoc = await loadingTask.promise;

    console.log(`[ImageProcessor] Bắt đầu trích xuất hình ảnh từ PDF (${pdfDoc.numPages} trang, trang bắt đầu: ${startPageNum})...`);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const currentRealPage = startPageNum + pageNum - 1;
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      const originalDrawImage = ctx.drawImage;
      const originalPutImageData = ctx.putImageData;

      let pageImgCount = 0;
      // Calculate max existing image count for currentRealPage
      Object.keys(imagesMap).forEach(k => {
        const match = k.match(new RegExp(`^PAGE_${currentRealPage}_IMG_(\\d+)$`, 'i'));
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > pageImgCount) pageImgCount = val;
        }
      });

      const processAndSaveSource = (source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData) => {
        const width = source.width;
        const height = source.height;

        // Filter out small images (< 100px width or height)
        if (width < 100 || height < 100) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        if (source instanceof ImageData) {
          tempCtx.putImageData(source, 0, 0);
        } else {
          tempCtx.drawImage(source, 0, 0);
        }

        const dataUrl = resizeCanvasImage(tempCanvas, maxDim, quality);

        pageImgCount++;
        const imgId = `PAGE_${currentRealPage}_IMG_${pageImgCount}`;
        imagesMap[imgId] = dataUrl;
        console.log(`[ImageProcessor] Đã trích xuất ảnh mới: ${imgId} (${width}x${height}px)`);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.drawImage = function (...args: any[]) {
        const imgSource = args[0];
        try {
          if (
            imgSource instanceof HTMLImageElement ||
            imgSource instanceof HTMLCanvasElement ||
            imgSource instanceof ImageBitmap
          ) {
            processAndSaveSource(imgSource);
          }
        } catch {
          // ignore error in monkey patch
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalDrawImage as any).apply(this, args);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctx.putImageData = function (...args: any[]) {
        const imgData = args[0];
        try {
          if (imgData instanceof ImageData) {
            processAndSaveSource(imgData);
          }
        } catch {
          // ignore error in monkey patch
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (originalPutImageData as any).apply(this, args);
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: ctx, viewport } as any).promise;
      } catch (err) {
        console.warn(`[ImageProcessor] Lỗi khi render trang ${pageNum} để trích xuất ảnh:`, err);
      } finally {
        ctx.drawImage = originalDrawImage;
        ctx.putImageData = originalPutImageData;
      }
    }

    console.log(`[ImageProcessor] Hoàn tất trích xuất. Tổng số ảnh hiện tại: ${Object.keys(imagesMap).length}`, Object.keys(imagesMap));
  } catch (err) {
    console.error('Error in extractImagesFromPdf:', err);
  }

  return imagesMap;
}

/**
 * Restores image placeholders (PAGE_X_IMG_Y or PLACEHOLDER_IMG_XXX) back to actual Base64 Data URIs.
 * Handles exact IDs as well as cases where AI appends file extensions (e.g., PAGE_5_IMG_2.png)
 * or zero-padded variations.
 */
export function restoreImagePlaceholders(
  content: string,
  imageMap?: Record<string, string>
): string {
  if (!content || !imageMap) return content || '';

  let restored = content;

  for (const [id, dataUri] of Object.entries(imageMap)) {
    if (!id || !dataUri) continue;

    // 1. Match ID with file extension like PAGE_5_IMG_2.png or PLACEHOLDER_IMG_001.png
    const extRegex = new RegExp(`${id}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
    restored = restored.replace(extRegex, dataUri);

    // 2. Match unpadded PLACEHOLDER_IMG variants (e.g., PLACEHOLDER_IMG_1 for PLACEHOLDER_IMG_001)
    const numMatch = id.match(/PLACEHOLDER_IMG_(\d+)/i);
    if (numMatch) {
      const numInt = parseInt(numMatch[1], 10);
      const unpaddedId = `PLACEHOLDER_IMG_${numInt}`;
      if (unpaddedId !== id) {
        const unpaddedExtRegex = new RegExp(`${unpaddedId}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
        restored = restored.replace(unpaddedExtRegex, dataUri);
        restored = restored.replaceAll(unpaddedId, dataUri);
      }
    }

    // 3. Match PAGE_X_IMG_Y variants (e.g., PAGE_05_IMG_02 for PAGE_5_IMG_2)
    const pageMatch = id.match(/PAGE_(\d+)_IMG_(\d+)/i);
    if (pageMatch) {
      const pNum = parseInt(pageMatch[1], 10);
      const iNum = parseInt(pageMatch[2], 10);
      const paddedPage = String(pNum).padStart(2, '0');
      const paddedImg = String(iNum).padStart(2, '0');
      const variations = [
        `PAGE_${pNum}_IMG_${paddedImg}`,
        `PAGE_${paddedPage}_IMG_${iNum}`,
        `PAGE_${paddedPage}_IMG_${paddedImg}`
      ];
      for (const varId of variations) {
        if (varId !== id) {
          const varExtRegex = new RegExp(`${varId}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
          restored = restored.replace(varExtRegex, dataUri);
          restored = restored.replaceAll(varId, dataUri);
        }
      }
    }

    // 4. Replace exact ID match
    if (restored.includes(id)) {
      restored = restored.replaceAll(id, dataUri);
    }
  }

  // Convert markdown image syntax ![alt](data:image...) to HTML <img> tag
  restored = restored.replace(/!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, (_match, alt, src) => {
    return `<img src="${src}" alt="${alt || 'Hình minh họa'}" class="max-w-full h-auto rounded-lg mx-auto my-4 shadow-sm" />`;
  });

  return restored;
}

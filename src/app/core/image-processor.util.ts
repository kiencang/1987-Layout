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
 * and encodes to PNG Data URI.
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
 * Limits images to maximum 1024px width/height and compresses with JPEG quality.
 * Uses page-based image IDs: PROJ_projectId_PAGE_X_IMG_Y
 */
export async function extractImagesFromPdf(
  arrayBuffer: ArrayBuffer,
  projectId: string,
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

    console.log(`[ImageProcessor] Bắt đầu trích xuất hình ảnh từ PDF bằng getOperatorList (${pdfDoc.numPages} trang, trang bắt đầu: ${startPageNum})...`);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const currentRealPage = startPageNum + pageNum - 1;
      const page = await pdfDoc.getPage(pageNum);
      
      const operatorList = await page.getOperatorList();
      const validObjectTypes = [
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintInlineImageXObject,
        pdfjsLib.OPS.paintImageXObjectRepeat
      ];

      let pageImgCount = 0;

      // Calculate max existing image count for currentRealPage
      Object.keys(imagesMap).forEach(k => {
        const match = k.match(new RegExp(`^PROJ_${projectId}_PAGE_${currentRealPage}_IMG_(\\d+)$`, 'i'));
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > pageImgCount) pageImgCount = val;
        }
      });

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];

        if (validObjectTypes.includes(fn)) {
          const imgName = operatorList.argsArray[i][0];
          
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let imgData: any;
            
            if (page.objs && typeof page.objs.get === 'function') {
              imgData = await new Promise((resolve) => {
                page.objs.get(imgName, (obj: unknown) => resolve(obj));
              });
            } else if (page.commonObjs && typeof page.commonObjs.get === 'function') {
              imgData = await new Promise((resolve) => {
                page.commonObjs.get(imgName, (obj: unknown) => resolve(obj));
              });
            }

            if (!imgData) continue;

            const width = imgData.width;
            const height = imgData.height;

            if (!width || !height) continue;
            
            // Filter out small images (< 70px width or height)
            if (width < 70 || height < 70) continue;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) continue;

            if (imgData.data) {
              const imgImageData = ctx.createImageData(width, height);
              const srcData = imgData.data;
              const destData = imgImageData.data;

              if (srcData.length === width * height * 3) {
                let j = 0;
                for (let i = 0; i < srcData.length; i += 3) {
                  destData[j] = srcData[i];
                  destData[j + 1] = srcData[i + 1];
                  destData[j + 2] = srcData[i + 2];
                  destData[j + 3] = 255;
                  j += 4;
                }
              } else if (srcData.length === width * height * 4) {
                destData.set(srcData);
              } else if (srcData.length === width * height) {
                let j = 0;
                for (let i = 0; i < srcData.length; i++) {
                  const val = srcData[i];
                  destData[j] = val;
                  destData[j + 1] = val;
                  destData[j + 2] = val;
                  destData[j + 3] = 255;
                  j += 4;
                }
              } else {
                try {
                  destData.set(srcData.subarray(0, destData.length));
                } catch {
                  continue;
                }
              }

              ctx.putImageData(imgImageData, 0, 0);
            } else if (imgData.bitmap) {
              ctx.drawImage(imgData.bitmap, 0, 0);
            } else {
              continue; // Unknown format
            }

            const dataUrl = resizeCanvasImage(canvas, maxDim, quality);
            pageImgCount++;
            const imgId = `PROJ_${projectId}_PAGE_${currentRealPage}_IMG_${pageImgCount}`;
            imagesMap[imgId] = dataUrl;
            console.log(`[ImageProcessor] Đã trích xuất ảnh mới: ${imgId} (${width}x${height}px)`);

          } catch (err) {
            console.warn(`[ImageProcessor] Lỗi khi trích xuất ảnh ${imgName} trang ${currentRealPage}:`, err);
          }
        }
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

    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Exact match with extension (e.g. PROJ_123_PAGE_5_IMG_1.png)
    const extRegex = new RegExp(`${escapedId}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
    restored = restored.replace(extRegex, dataUri);

    // 2. Exact match without extension (e.g. PROJ_123_PAGE_5_IMG_1)
    if (restored.includes(id)) {
      restored = restored.replaceAll(id, dataUri);
    }

    // 3. Match variations of PROJ_prefix_PAGE_X_IMG_Y or PAGE_X_IMG_Y
    const pageMatch = id.match(/^(PROJ_[^_]+_)?PAGE_(\d+)_IMG_(\d+)$/i);
    if (pageMatch) {
      const projPrefix = pageMatch[1] || '';
      const pNum = parseInt(pageMatch[2], 10);
      const iNum = parseInt(pageMatch[3], 10);
      const paddedPage = String(pNum).padStart(2, '0');
      const paddedImg = String(iNum).padStart(2, '0');

      // Variations that preserve the project prefix
      const prefixedVariations = [
        `${projPrefix}PAGE_${pNum}_IMG_${paddedImg}`,
        `${projPrefix}PAGE_${paddedPage}_IMG_${iNum}`,
        `${projPrefix}PAGE_${paddedPage}_IMG_${paddedImg}`
      ];

      for (const varId of prefixedVariations) {
        if (varId !== id && restored.includes(varId)) {
          const varEsc = varId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const varExtRegex = new RegExp(`${varEsc}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
          restored = restored.replace(varExtRegex, dataUri);
          restored = restored.replaceAll(varId, dataUri);
        }
      }

      // Fallback variations WITHOUT project prefix (only if AI omitted the PROJ_ prefix)
      // Use negative lookbehind so we NEVER match inside a full PROJ_xxx_ string!
      if (projPrefix) {
        const unprefixedVariations = [
          `PAGE_${pNum}_IMG_${iNum}`,
          `PAGE_${pNum}_IMG_${paddedImg}`,
          `PAGE_${paddedPage}_IMG_${iNum}`,
          `PAGE_${paddedPage}_IMG_${paddedImg}`
        ];

        for (const varId of unprefixedVariations) {
          const varEsc = varId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const varExtRegex = new RegExp(`(?<!PROJ_[a-zA-Z0-9]+_)${varEsc}\\.(png|jpg|jpeg|webp|gif|svg)`, 'gi');
          restored = restored.replace(varExtRegex, dataUri);

          const varRegex = new RegExp(`(?<!PROJ_[a-zA-Z0-9]+_)${varEsc}`, 'gi');
          restored = restored.replace(varRegex, dataUri);
        }
      }
    }

    // 4. Match unpadded PLACEHOLDER_IMG variants (e.g., PLACEHOLDER_IMG_1 for PLACEHOLDER_IMG_001)
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
  }

  // Convert markdown image syntax ![alt](data:image...) to HTML <img> tag
  restored = restored.replace(/!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, (_match, alt, src) => {
    return `<img src="${src}" alt="${alt || 'Hình minh họa'}" class="max-w-full h-auto rounded-lg mx-auto my-4 shadow-sm" />`;
  });

  return restored;
}

export type PreviewPng = {
  blob: Blob;
  width: number;
  height: number;
};

export type PreviewPngExporter = () => Promise<PreviewPng>;

const unavailableError = () => new Error('The print frame is not ready to export.');

export function capturePrintFramePng(
  mapCanvas: HTMLCanvasElement,
  printFrame: HTMLElement,
  attribution: string,
): Promise<PreviewPng> {
  const canvasRect = mapCanvas.getBoundingClientRect();
  const frameRect = printFrame.getBoundingClientRect();
  if (
    mapCanvas.width <= 0
    || mapCanvas.height <= 0
    || canvasRect.width <= 0
    || canvasRect.height <= 0
    || frameRect.width <= 0
    || frameRect.height <= 0
  ) {
    return Promise.reject(unavailableError());
  }

  const attributionText = attribution.replace(/\s+/g, ' ').trim();
  if (!attributionText) {
    return Promise.reject(new Error('Map attribution is unavailable, so this preview cannot be exported.'));
  }

  const intersectionLeft = Math.max(canvasRect.left, frameRect.left);
  const intersectionTop = Math.max(canvasRect.top, frameRect.top);
  const intersectionRight = Math.min(canvasRect.right, frameRect.right);
  const intersectionBottom = Math.min(canvasRect.bottom, frameRect.bottom);
  if (intersectionRight <= intersectionLeft || intersectionBottom <= intersectionTop) {
    return Promise.reject(unavailableError());
  }

  const scaleX = mapCanvas.width / canvasRect.width;
  const scaleY = mapCanvas.height / canvasRect.height;
  const sourceX = (intersectionLeft - canvasRect.left) * scaleX;
  const sourceY = (intersectionTop - canvasRect.top) * scaleY;
  const sourceWidth = (intersectionRight - intersectionLeft) * scaleX;
  const sourceHeight = (intersectionBottom - intersectionTop) * scaleY;
  if (![scaleX, scaleY, sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    || sourceWidth <= 0
    || sourceHeight <= 0) {
    return Promise.reject(unavailableError());
  }

  const width = Math.round(sourceWidth);
  const height = Math.round(sourceHeight);
  if (width < 120 || height < 48) {
    return Promise.reject(new Error('The rendered print frame is too small to export with useful map content and legible attribution.'));
  }
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) return Promise.reject(new Error('PNG export is unavailable in this browser.'));

  try {
    context.drawImage(
      mapCanvas,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );

    const pixelScale = Math.max(1, Math.min(scaleX, scaleY));
    const padding = Math.max(4, Math.round(4 * pixelScale));
    let fontSize = Math.max(8, Math.round(8 * pixelScale));
    context.font = `${fontSize}px sans-serif`;
    const availableWidth = Math.max(1, width - padding * 2);
    const measuredWidth = context.measureText(attributionText).width;
    if (measuredWidth > availableWidth) {
      fontSize = Math.max(7, Math.floor(fontSize * availableWidth / measuredWidth));
      context.font = `${fontSize}px sans-serif`;
    }
    const barHeight = Math.max(14, fontSize + padding);
    const rootStyle = getComputedStyle(document.documentElement);
    context.globalAlpha = 1;
    context.fillStyle = rootStyle.getPropertyValue('--studio-surface').trim();
    context.fillRect(0, height - barHeight, width, barHeight);
    context.globalAlpha = 1;
    context.fillStyle = rootStyle.getPropertyValue('--studio-text-secondary').trim();
    context.textBaseline = 'middle';
    context.fillText(attributionText, padding, height - barHeight / 2, availableWidth);
  } catch {
    return Promise.reject(new Error('The browser could not render the PNG. The map canvas may be unavailable or blocked by its source.'));
  }

  return new Promise((resolve, reject) => {
    try {
      output.toBlob((blob) => {
        if (blob) resolve({ blob, width, height });
        else reject(new Error('The browser could not create the PNG file.'));
      }, 'image/png');
    } catch {
      reject(new Error('The browser could not create the PNG file.'));
    }
  });
}

export function startPreviewDownload(blob: Blob, filename: string) {
  const safeFilename = filename
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'map-preview.png';
  const downloadName = safeFilename.toLowerCase().endsWith('.png') ? safeFilename : `${safeFilename}.png`;
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

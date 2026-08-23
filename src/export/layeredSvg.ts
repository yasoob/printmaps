import type { ProjectDocument } from '../domain/project';
import { serializePrintScene } from '../print/scene';
import type { PreviewPng } from './previewPng';

const ATTRIBUTION = 'OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors';

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 32_768;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function sanitizeBaseFilename(filename: string): string {
  const withoutKnownExtension = filename.replace(/(?:\.layered\.svg|\.svg|\.png)$/i, '');
  return withoutKnownExtension
    .replaceAll(/[^a-z0-9._-]+/gi, '-')
    .replaceAll(/^[-.]+|[-.]+$/g, '') || 'map';
}

export async function createLayeredSvg(document: ProjectDocument, capture: PreviewPng): Promise<Blob> {
  if (!capture.projectToFrame) {
    throw new Error('The map projection is not ready for layered SVG export. Reload the map and try again.');
  }
  const mime = capture.blob.type === 'image/jpeg' || capture.blob.type === 'image/webp'
    ? capture.blob.type
    : 'image/png';
  const dataUri = `data:${mime};base64,${bytesToBase64(new Uint8Array(await capture.blob.arrayBuffer()))}`;
  const svg = serializePrintScene(document, {
    basemap: { dataUri, pixelWidth: capture.width, pixelHeight: capture.height },
    attribution: ATTRIBUTION,
    metadata: 'Raster basemap captured from the current browser map; user route, POI, and shape overlays remain named vectors.',
    project: (coordinate, context) => {
      const point = capture.projectToFrame!(coordinate);
      return {
        x: point.x * context.pageWidthMm,
        y: point.y * context.pageHeightMm,
      };
    },
  });
  return new Blob([svg], { type: 'image/svg+xml' });
}

export function startLayeredSvgDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeBaseFilename(filename)}.layered.svg`;
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

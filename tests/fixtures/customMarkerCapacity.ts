import { zlibSync } from 'fflate';
import { sha256Hex, type CustomMarkerAsset } from '../../src/domain/customMarkerAssets';
import { createDefaultLayerAppearance, createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { paddedMarker } from './portableBudget';
import { profilePngCrc } from './profilePng';

export const smallCircleSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2463eb"/></svg>';

export function svgMarkerAsset(source = smallCircleSvg): CustomMarkerAsset {
  const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
  const viewBox = root.getAttribute('viewBox')?.split(/\s+/).map(Number);
  const width = Number(root.getAttribute('width') ?? viewBox?.[2]);
  const height = Number(root.getAttribute('height') ?? viewBox?.[3]);
  return {
    id: `sha256-${sha256Hex(new TextEncoder().encode(source))}`,
    mimeType: 'image/svg+xml', width, height, dataUri: `data:image/svg+xml;base64,${btoa(source)}`,
  };
}

function pngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  view.setUint32(data.length + 8, profilePngCrc(chunk.subarray(4, data.length + 8)));
  return chunk;
}

export function markerPng(width: number, height: number, shade = 1): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const row = new Uint8Array(width * 4 + 1);
  for (let x = 1; x < row.length; x += 4) row.set([shade, 50, 200, 255], x);
  const raw = new Uint8Array(row.length * height);
  for (let y = 0; y < height; y += 1) raw.set(row, y * row.length);
  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', zlibSync(raw)), pngChunk('IEND', new Uint8Array()),
  ];
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function rasterAsset(index: number): CustomMarkerAsset {
  const bytes = markerPng(2048, 2048, index + 1);
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return {
    id: `sha256-${sha256Hex(bytes)}`, mimeType: 'image/png', width: 2048, height: 2048,
    dataUri: `data:image/png;base64,${btoa(binary)}`,
  };
}

function markerLayer(index: number, asset: CustomMarkerAsset): ContentLayer {
  const appearance = createDefaultLayerAppearance('poi');
  if (appearance?.kind !== 'poi') throw new Error('Expected POI appearance');
  return {
    id: `marker-${index}`, name: `Marker ${index}`, type: 'poi', visible: false, locked: false, opacity: 100,
    appearance: { ...appearance, customAssetId: asset.id }, geometry: { type: 'Point', coordinates: [16.35, 48.2] },
  };
}

export function markerCapacityProject(kind: 'count' | 'encoded' | 'decoded') {
  const document = createInitialProjectDocument();
  const count = kind === 'count' ? 64 : (kind === 'encoded' ? 6 : 4);
  for (let index = 0; index < count; index += 1) {
    const asset = kind === 'decoded' ? rasterAsset(index) : paddedMarker(index, kind === 'encoded' ? 1_000_000 : 200);
    document.assets[asset.id] = asset;
    document.layers.unshift(markerLayer(index, asset));
  }
  return document;
}

export type VectorPoint = Readonly<{ x: number; y: number }>;
export type VectorColor = readonly [number, number, number, number];
export type VectorPath = Readonly<{
  rings: readonly (readonly VectorPoint[])[];
  closed: boolean;
  fill?: VectorColor;
  stroke?: VectorColor;
  width?: number;
  cap?: 'butt' | 'round' | 'square';
  join?: 'miter' | 'round' | 'bevel';
  miterLimit?: number;
  dash?: readonly number[];
}>;
export type VectorText = Readonly<{
  text: string;
  size: number;
  color: VectorColor;
  halo: VectorColor;
  haloWidth: number;
  glyphs: readonly Readonly<{ text: string; x: number; y: number; angle: number }>[];
}>;
export type VectorBasemapScene = Readonly<{
  kind: 'vector';
  width: number;
  height: number;
  groups: readonly Readonly<{
    layerId: string;
    clip: readonly VectorPoint[];
    paths: readonly VectorPath[];
    texts?: readonly VectorText[];
  }>[];
  font?: Readonly<{ bytes: Uint8Array; dataUri: string }>;
}>;

export type VectorBasemapCapture = Readonly<{
  scene: VectorBasemapScene;
  referenceLongitude: number;
  projectToFrame: (coordinate: readonly [number, number]) => VectorPoint;
}>;

export const VECTOR_LIMITS = Object.freeze({
  tiles: 64,
  tileBytes: 4 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  features: 100_000,
  points: 1_000_000,
  timeMs: 30_000,
});

export function vectorUnsupported(detail: string): never {
  throw new Error(`True vector export: ${detail} Choose Hybrid mode to preserve every visible map detail.`);
}

export function checkVectorSignal(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Vector export cancelled.', 'AbortError');
}

export function vectorNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error('The vector scene contains a non-finite number.');
  return String(Math.round(value * 1e6) / 1e6);
}

export function vectorXml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

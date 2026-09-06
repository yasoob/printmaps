import { elevationProfileFontStack, type ElevationProfileFontFamily } from './elevationProfileLayout';

export type ProfileFontWeight = 400 | 600;
type MeasurementContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;
const MEASUREMENT_SIZE = 1000;
const CACHE_LIMIT = 4096;

export function createProfileFontMeasurer(context: MeasurementContext) {
  const cache = new Map<string, number>();
  return {
    clear: () => cache.clear(),
    measure(text: string, family: ElevationProfileFontFamily, weight: ProfileFontWeight): number | undefined {
      const key = `${family}:${weight}:${text}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const faces = elevationProfileFontStack(family).split(',');
      let width = 0;
      for (let index = 0; index < faces.length; index += 1) {
        context.font = `${weight} ${MEASUREMENT_SIZE}px ${faces.slice(index).join(',')}`;
        const metrics = context.measureText(text);
        const extent = Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft);
        if (!Number.isFinite(extent) || extent < 0 || (extent === 0 && text.length > 0)) return;
        width = Math.max(width, extent / MEASUREMENT_SIZE);
      }
      // Include ink overhang, fallback faces, and a small shaping/rounding allowance.
      const guarded = width * 1.05 + [...text].length * 0.03;
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(key, guarded);
      return guarded;
    },
  };
}

const documentMeasurers = new WeakMap<Document, ReturnType<typeof createProfileFontMeasurer>>();

export function measuredProfileTextWidth(text: string, family: ElevationProfileFontFamily, weight: ProfileFontWeight): number | undefined {
  if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return;
  let measurer = documentMeasurers.get(document);
  if (!measurer) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) return;
    measurer = createProfileFontMeasurer(context);
    documentMeasurers.set(document, measurer);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', measurer.clear);
    fonts?.addEventListener('loadingerror', measurer.clear);
  }
  return measurer.measure(text, family, weight);
}

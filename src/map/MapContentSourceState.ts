import type { ContentLayer } from "../domain/project";

const appliedDataSignatures = new WeakMap<object, string>();

export function mapContentDataSignature(layer: ContentLayer): string {
  return JSON.stringify({
    appearance: layer.appearance,
    geometry: layer.geometry,
    opacity: layer.opacity,
  });
}

export function mapContentPaintSignature(layer: ContentLayer): string {
  return JSON.stringify({
    appearance: layer.appearance,
    opacity: layer.opacity,
  });
}

export function markMapContentSourceData(
  source: object,
  layer: ContentLayer,
): void {
  appliedDataSignatures.set(source, mapContentDataSignature(layer));
}

export function hasMapContentSourceData(
  source: object,
  layer: ContentLayer,
): boolean {
  return appliedDataSignatures.get(source) === mapContentDataSignature(layer);
}

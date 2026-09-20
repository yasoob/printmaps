import { coverImageBox, type StudioBox, type StudioProjector } from './studioGeometry';
import type { StudioCompositionDocument, StudioLayout } from './studioLayout';
import { studioText, type StudioPrimitive } from './studioPrimitives';

export function visiblePhotoStops(document: StudioCompositionDocument) {
  const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
  return document.studio.photos.stops.flatMap((stop, index) => {
    const layer = layers.get(stop.layerId);
    if (!layer?.visible) return [];
    if (layer.type !== 'poi' || layer.geometry?.type !== 'Point') throw new Error(`Photo "${stop.caption}" needs a point layer.`);
    const asset = document.studio.photos.assets[stop.assetId];
    if (!asset) throw new Error(`Photo "${stop.caption}" has no embedded image. Reattach the photo.`);
    return [{ ...stop, asset, coordinate: layer.geometry.coordinates, number: index + 1 }];
  });
}

function numberBadge(number: number, box: StudioBox): StudioPrimitive[] {
  const center = { x: box.x + 2, y: box.y + 2 };
  return [
    { kind: 'circle', center, radius: 2.3, fill: '#ffffff', stroke: '#202020', strokeWidth: 0.25 },
    studioText(String(number), { x: center.x, y: center.y + 0.9 }, { size: 2.8, maxWidth: 3.5, font: 'sans', color: '#202020' }),
  ];
}

function anchoredPhotos(document: StudioCompositionDocument, layout: StudioLayout, project: StudioProjector): StudioPrimitive[] {
  const settings = document.studio.photos;
  if (!settings.map.enabled) return [];
  const stops = visiblePhotoStops(document);
  const primitives: StudioPrimitive[] = [];
    const size = settings.map.sizeMm;
    for (const stop of stops) {
      const point = project(stop.coordinate);
      const box = { x: point.x - size / 2, y: point.y - size / 2, width: size, height: size };
      const border = settings.map.borderWidthMm;
      const frame: StudioPrimitive = settings.map.shape === 'circle'
        ? { kind: 'circle', center: point, radius: size / 2 + border, fill: settings.map.borderColor }
        : { kind: 'rect', box: { x: box.x - border, y: box.y - border, width: size + border * 2, height: size + border * 2 }, fill: settings.map.borderColor };
      primitives.push(
        { ...frame, clip: layout.map },
        { kind: 'image', asset: stop.asset, box, imageBox: coverImageBox(stop.asset, box), shape: settings.map.shape, clip: layout.map },
        ...numberBadge(stop.number, box).map((primitive) => ({ ...primitive, clip: layout.map })),
      );
      if (!settings.strip.enabled && stop.caption) {
        const captionBox = { x: box.x - 2, y: box.y + box.height + border, width: box.width + 4, height: 5 };
        primitives.push(
          { kind: 'rect', box: captionBox, fill: '#ffffff', clip: layout.map },
          { ...studioText(stop.caption, { x: point.x, y: captionBox.y + 3.5 }, { size: 2.5, maxWidth: captionBox.width - 2, font: 'sans', color: '#202020' }), clip: layout.map },
        );
      }
    }
  return primitives;
}

function stripPhotos(document: StudioCompositionDocument, layout: StudioLayout): StudioPrimitive[] {
  const settings = document.studio.photos, stops = visiblePhotoStops(document);
  const primitives: StudioPrimitive[] = [];
  if (layout.strip && stops.length > 0) {
    const strip = layout.strip, gap = settings.strip.gapMm;
    const cellWidth = (strip.width - gap * (stops.length + 1)) / stops.length;
    const size = Math.min(cellWidth, strip.height - gap * 2 - (settings.strip.showCaptions ? 6 : 0));
    if (size < 4) throw new Error('The photo strip is too small for these photos. Increase its height, reduce spacing, or remove some photos.');
    primitives.push({ kind: 'rect', box: strip, fill: settings.strip.backgroundColor });
    for (const [index, stop] of stops.entries()) {
      const box = { x: strip.x + gap + index * (cellWidth + gap) + (cellWidth - size) / 2, y: strip.y + gap, width: size, height: size };
      primitives.push(
        { kind: 'image', asset: stop.asset, box, imageBox: coverImageBox(stop.asset, box), shape: 'square' },
        ...numberBadge(stop.number, box),
      );
      if (settings.strip.showCaptions) {
        primitives.push(studioText(stop.caption || `Stop ${stop.number}`, { x: box.x + size / 2, y: box.y + size + 4 }, { size: 3, maxWidth: cellWidth, font: 'sans', color: '#202020' }));
      }
    }
  }
  return primitives;
}

export function photoPrimitives(document: StudioCompositionDocument, layout: StudioLayout, project: StudioProjector): StudioPrimitive[] {
  if (!document.studio.photos.map.enabled && !document.studio.photos.strip.enabled) return [];
  return [...anchoredPhotos(document, layout, project), ...stripPhotos(document, layout)];
}

import qrcode from 'qrcode-generator';
import type { DecorationPosition } from '../domain/studio';
import { canonicalStudioLongitude, projectedNorthAngle, scaleAtCenter, type StudioBox, type StudioPoint, type StudioProjector } from './studioGeometry';
import type { StudioCamera, StudioCompositionDocument } from './studioLayout';
import { studioText, type StudioPrimitive } from './studioPrimitives';

export function locationQrUrl(document: StudioCompositionDocument, camera: StudioCamera = document.camera): string {
  const qr = document.studio.decorations.qr;
  let coordinate = camera.center;
  if (qr.target === 'layer') {
    const layer = document.layers.find(({ id }) => id === qr.layerId);
    if (layer?.geometry?.type !== 'Point') throw new Error('Choose a point layer for the location QR code.');
    coordinate = layer.geometry.coordinates;
  }
  const query = `${coordinate[1].toFixed(6)},${canonicalStudioLongitude(coordinate[0]).toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function qrPrimitives(url: string, box: StudioBox): StudioPrimitive[] {
  const code = qrcode(0, 'M');
  code.addData(url, 'Byte');
  code.make();
  const count = code.getModuleCount(), moduleSize = box.width / (count + 8);
  if (moduleSize < 0.25) throw new Error('Increase the QR size: each printed module must be at least 0.25 mm.');
  const primitives: StudioPrimitive[] = [{ kind: 'rect', box, fill: '#ffffff' }];
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (code.isDark(row, column)) primitives.push({
        kind: 'rect',
        box: { x: box.x + (column + 4) * moduleSize, y: box.y + (row + 4) * moduleSize, width: moduleSize, height: moduleSize },
        fill: '#000000',
      });
    }
  }
  return primitives;
}

function decorationPlacer(map: StudioBox) {
  const occupied: StudioBox[] = [];
  const offsets: Partial<Record<DecorationPosition, number>> = {};
  return (position: DecorationPosition, width: number, height: number): StudioBox => {
    const offset = offsets[position] ?? 0;
    const box = {
      x: position.endsWith('left') ? map.x + 3 : map.x + map.width - width - 3,
      y: position.startsWith('top') ? map.y + 3 + offset : map.y + map.height - height - 3 - offset,
      width, height,
    };
    if (width + 6 > map.width || height + offset + 6 > map.height
      || occupied.some((other) => box.x < other.x + other.width && box.x + width > other.x && box.y < other.y + other.height && box.y + height > other.y)) {
      throw new Error('The decorations overlap or do not fit in the map. Choose another corner or reduce their sizes.');
    }
    offsets[position] = offset + height + 3;
    occupied.push(box);
    return box;
  };
}

function rotate(point: StudioPoint, center: StudioPoint, angle: number): StudioPoint {
  const radians = angle * Math.PI / 180, x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * Math.cos(radians) - y * Math.sin(radians), y: center.y + x * Math.sin(radians) + y * Math.cos(radians) };
}

function compassPrimitives(box: StudioBox, angle: number, color: string, isRose: boolean): StudioPrimitive[] {
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 + 1 };
  const radius = Math.min(box.width, box.height) * 0.3;
  const triangle = [{ x: center.x, y: center.y - radius }, { x: center.x - radius * 0.35, y: center.y + radius }, { x: center.x, y: center.y + radius * 0.4 }, { x: center.x + radius * 0.35, y: center.y + radius }];
  const primitives: StudioPrimitive[] = [
    { kind: 'rect', box, fill: '#ffffff' },
    { kind: 'path', points: triangle.map((point) => rotate(point, center, angle)), closed: true, fill: color },
    studioText('N', { x: center.x, y: box.y + 3 }, { size: 3, maxWidth: 4, color, font: 'sans' }),
  ];
  if (isRose) primitives.push({ kind: 'circle', center, radius, fill: 'none', stroke: color, strokeWidth: 0.3 });
  return primitives;
}

export function decorationPrimitives(document: StudioCompositionDocument, map: StudioBox, project: StudioProjector, camera: StudioCamera): StudioPrimitive[] {
  const { scale, compass, qr } = document.studio.decorations;
  const place = decorationPlacer(map);
  const primitives: StudioPrimitive[] = [];
  if (compass.enabled) {
    const box = place(compass.position, compass.sizeMm, compass.sizeMm);
    primitives.push(...compassPrimitives(box, projectedNorthAngle(camera.center, project), compass.color, compass.style === 'rose'));
  }
  if (scale.enabled) {
    if (camera.pitch !== 0 || document.studio.terrain.enabled) throw new Error('The scale bar requires a flat, non-terrain map. Set pitch to 0 and turn terrain off.');
    const measurement = scaleAtCenter(camera.center, project, scale.widthMm, scale.units);
    const box = place(scale.position, scale.widthMm + 4, 14);
    primitives.push(
      { kind: 'rect', box, fill: '#ffffff' },
      { kind: 'path', points: [{ x: box.x + 2, y: box.y + 5 }, { x: box.x + 2, y: box.y + 7 }, { x: box.x + 2 + measurement.widthMm, y: box.y + 7 }, { x: box.x + 2 + measurement.widthMm, y: box.y + 5 }], closed: false, fill: 'none', stroke: scale.color, strokeWidth: 0.5 },
      studioText(measurement.label, { x: box.x + box.width / 2, y: box.y + 4 }, { size: 3, maxWidth: box.width - 4, font: 'sans', color: scale.color }),
      studioText('at map center', { x: box.x + box.width / 2, y: box.y + 11 }, { size: 2, maxWidth: box.width - 4, font: 'sans', color: scale.color }),
    );
  }
  if (qr.enabled) primitives.push(...qrPrimitives(locationQrUrl(document, camera), place(qr.position, qr.sizeMm, qr.sizeMm)));
  return primitives;
}

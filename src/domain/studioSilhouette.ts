import type { AdministrativeArea } from './administrativeAreas';
import { createDefaultLayerAppearance, MAX_MERCATOR_LATITUDE, type ContentLayer } from './project';
import type { StudioTemplateApplication } from './studio';
import { posterTemplateSettings } from './studioTemplates';
import { combinedLayerBounds } from '../map/MapLayerBounds';
import { deriveStudioLayout, type StudioCompositionDocument } from '../print/studioLayout';
import type { StudioBox } from '../print/studioGeometry';

function mercatorY(latitude: number): number {
  const radians = latitude * Math.PI / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2;
}

function silhouettePoster(document: StudioCompositionDocument, area: AdministrativeArea, shouldPreserveLayout = false) {
  return shouldPreserveLayout ? { ...document.studio.poster }
    : posterTemplateSettings('silhouette', area.name, area.level === 'country' ? 'A place in the world' : 'A closer look');
}

export function createSilhouetteApplication(
  document: StudioCompositionDocument,
  area: AdministrativeArea,
  frame: StudioBox,
  viewport: Readonly<{ width: number; height: number; preserveLayout?: boolean }>,
): StudioTemplateApplication & { silhouette: ContentLayer } {
  if (document.camera.locked) throw new Error('Unlock the map area before fitting a country or region poster.');
  if (frame.width <= 0 || frame.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error('Wait for the map print frame before fitting the boundary.');
  }
  const appearance = createDefaultLayerAppearance('shape');
  if (appearance?.kind !== 'shape') throw new Error('The shape appearance is unavailable.');
  const poster = silhouettePoster(document, area, viewport.preserveLayout);
  const silhouette: ContentLayer = {
    id: `silhouette-${crypto.randomUUID()}`, name: `${area.name} silhouette`, type: 'shape',
    visible: true, locked: false, opacity: 100, geometry: structuredClone(area.geometry),
    appearance: { ...appearance, invert: true, fillColor: poster.backgroundColor, strokeWidth: 0.5, strokeColor: poster.backgroundColor },
  };
  poster.silhouetteLayerId = silhouette.id;
  const bounds = combinedLayerBounds([silhouette]);
  if (!bounds) throw new Error('This boundary extends outside the printable Mercator range. Choose another country or region.');
  const [[west, south], [east, north]] = bounds;
  const layout = deriveStudioLayout({ ...document, studio: { ...document.studio, poster } });
  const box = {
    x: frame.x + layout.map.x / document.page.widthMm * frame.width,
    y: frame.y + layout.map.y / document.page.heightMm * frame.height,
    width: layout.map.width / document.page.widthMm * frame.width,
    height: layout.map.height / document.page.heightMm * frame.height,
  };
  const spanX = Math.max((east - west) / 360, 1e-9), spanY = Math.max(mercatorY(south) - mercatorY(north), 1e-9);
  const zoom = Math.min(22, Math.log2(Math.min(box.width * 0.9 / (512 * spanX), box.height * 0.9 / (512 * spanY))));
  if (zoom < 0) throw new Error('The entire boundary does not fit at this frame size. Enlarge the editor or choose a smaller region.');
  const world = 512 * 2 ** zoom;
  const centerX = ((west + east) / 2 + 180) / 360 - (box.x + box.width / 2 - viewport.width / 2) / world;
  const centerY = (mercatorY(north) + mercatorY(south)) / 2 - (box.y + box.height / 2 - viewport.height / 2) / world;
  const longitude = ((centerX * 360 - 180 + 180) % 360 + 360) % 360 - 180;
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * centerY))) * 180 / Math.PI;
  if (Math.abs(latitude) > MAX_MERCATOR_LATITUDE) throw new Error('The fitted camera would exceed the printable Mercator range.');
  return { poster, silhouette, camera: { ...document.camera, center: [longitude, latitude], zoom, bearing: 0, pitch: 0 } };
}

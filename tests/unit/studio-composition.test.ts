import jsQR from 'jsqr';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';
import { createDefaultStudioSettings } from '../../src/domain/studio';
import { createPosterTemplateApplication, posterTemplateSettings, POSTER_STARTERS, POSTER_TEMPLATES } from '../../src/domain/studioTemplates';
import { createSilhouetteApplication } from '../../src/domain/studioSilhouette';
import { deriveStudioComposition, serializeStudioOverlaySvg } from '../../src/print/studioComposition';
import { locationQrUrl, qrPrimitives } from '../../src/print/studioDecorations';
import { coverImageBox, projectedNorthAngle, scaleAtCenter } from '../../src/print/studioGeometry';
import { deriveStudioLayout } from '../../src/print/studioLayout';
import { visiblePhotoStops } from '../../src/print/studioPhotos';
import type { AdministrativeArea } from '../../src/domain/administrativeAreas';
import type { StudioPrimitive } from '../../src/print/studioPrimitives';

function fixture() {
  return { ...createInitialProjectDocument(), studio: createDefaultStudioSettings() };
}
const project = ([lng, lat]: readonly [number, number]) => ({ x: 150 + (lng - 16.3725) * 100, y: 90 - (lat - 48.2084) * 100 });

function decodeQr(primitives: StudioPrimitive[], size: number) {
  const resolution = 900;
  const pixels = new Uint8ClampedArray(resolution * resolution * 4).fill(255);
  for (const primitive of primitives) {
    if (primitive.kind !== 'rect' || primitive.fill !== '#000000') continue;
    const { box } = primitive;
    for (let y = Math.round(box.y / size * resolution); y < Math.round((box.y + box.height) / size * resolution); y += 1) {
      for (let x = Math.round(box.x / size * resolution); x < Math.round((box.x + box.width) / size * resolution); x += 1) {
        pixels.set([0, 0, 0, 255], (y * resolution + x) * 4);
      }
    }
  }
  return jsQR(pixels, resolution, resolution)?.data;
}

describe('canonical poster composition', () => {
  it('leaves the default map untouched', () => {
    expect(deriveStudioComposition(fixture(), project)).toEqual([]);
  });

  it.each(POSTER_TEMPLATES)('builds $name without replacing user layers or camera', ({ id }) => {
    const document = fixture(), original = structuredClone(document);
    const application = createPosterTemplateApplication(document, id);
    expect(application.camera).toBeUndefined();
    expect(application).not.toHaveProperty('layers');
    expect(document).toEqual(original);
    const scene = deriveStudioComposition({ ...document, studio: { ...document.studio, poster: application.poster } }, project);
    expect(scene.some((primitive) => primitive.kind === 'text' && primitive.text === document.title)).toBe(true);
    expect(scene.every((primitive) => primitive.clip && primitive.clip.y + primitive.clip.height <= document.page.heightMm - 5)).toBe(true);
  });

  it('moves only explicit starters and respects camera lock', () => {
    const document = fixture(), starter = POSTER_STARTERS[0];
    expect(createPosterTemplateApplication(document, starter.templateId, starter).camera?.center).toEqual(starter.center);
    document.camera.locked = true;
    expect(() => createPosterTemplateApplication(document, starter.templateId, starter)).toThrow('Unlock');
  });

  it('escapes all user text and uses the same physical dimensions in SVG', () => {
    const document = fixture();
    document.studio.poster = posterTemplateSettings('classic', '</text><script>alert(1)</script>');
    const svg = serializeStudioOverlaySvg(document, project);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.querySelector('script')).toBeNull();
    expect(parsed.documentElement.getAttribute('viewBox')).toBe('0 0 297 210');
    expect(parsed.querySelector('text')?.textContent).toBe('</text><script>alert(1)</script>');
  });

  it('rejects layouts that hide the map instead of clipping silently', () => {
    const document = fixture();
    document.studio.poster = posterTemplateSettings('classic', 'A tiny page');
    document.page.heightMm = 25;
    expect(() => deriveStudioLayout(document)).toThrow('less than 12 mm');
  });

  it('uses local latitude and the actual projector for metric and imperial ground scale', () => {
    const equator = scaleAtCenter([0, 0], ([lng, lat]) => ({ x: lng * 100, y: -lat * 100 }), 30, 'metric');
    const north = scaleAtCenter([0, 60], ([lng, lat]) => ({ x: lng * 100, y: -lat * 100 }), 30, 'metric');
    expect(equator.metres).toBe(20_000);
    expect(north.metres).toBe(10_000);
    expect(equator.widthMm).toBeCloseTo(north.widthMm, 4);
    expect(scaleAtCenter([0, 0], ([lng]) => ({ x: lng * 100, y: 0 }), 30, 'imperial').label).toBe('20 mi');
  });

  it('rotates north using the projection, not a hard-coded upward arrow', () => {
    const radians = Math.PI / 4;
    const projector = ([lng, lat]: readonly [number, number]) => ({ x: lng * Math.cos(radians) + lat * Math.sin(radians), y: lng * Math.sin(radians) - lat * Math.cos(radians) });
    expect(projectedNorthAngle([0, 0], projector)).toBeCloseTo(45);
    expect(projectedNorthAngle([0, 85.051129], projector)).toBeCloseTo(45);
  });

  it('rejects non-finite projection consistently before any renderer sees the primitives', () => {
    const document = fixture();
    document.studio.decorations.compass.enabled = true;
    expect(() => deriveStudioComposition(document, () => ({ x: NaN, y: 10 }))).toThrow('projection is unavailable');
  });

  it('rejects dishonest pitched scale and over-dense coordinate grids', () => {
    const document = fixture();
    document.studio.decorations.scale.enabled = true;
    document.camera.pitch = 20;
    expect(() => deriveStudioComposition(document, project)).toThrow('flat');
    document.studio.decorations.scale.enabled = false;
    document.camera.pitch = 0;
    document.studio.decorations.grid.enabled = true;
    document.studio.decorations.grid.intervalDegrees = 0.001;
    expect(() => deriveStudioComposition(document, project)).toThrow('too dense');
  });

  it('produces a genuinely decodable QR with a four-module quiet zone', () => {
    const document = fixture();
    const url = locationQrUrl(document);
    const primitives = qrPrimitives(url, { x: 0, y: 0, width: 22, height: 22 });
    expect(decodeQr(primitives, 22)).toBe(url);
    expect(new URL(url).searchParams.get('query')).toBe('48.208400,16.372500');
    expect(() => qrPrimitives(url, { x: 0, y: 0, width: 8, height: 8 })).toThrow('0.25 mm');
  });

  it('follows a canonical POI for QR and photos, including visibility', () => {
    const document = fixture(), layer = document.layers.find(({ type }) => type === 'poi')!;
    document.studio.decorations.qr = { ...document.studio.decorations.qr, target: 'layer', layerId: layer.id };
    document.studio.photos.assets.photo = { id: 'photo', mimeType: 'image/png', width: 600, height: 400, dataUri: 'data:image/png;base64,AA==' };
    document.studio.photos.stops = [{ id: 'stop', layerId: layer.id, assetId: 'photo', caption: 'A memory' }];
    layer.geometry = { type: 'Point', coordinates: [12, 34] };
    expect(locationQrUrl(document)).toContain('34.000000%2C12.000000');
    expect(visiblePhotoStops(document)[0].coordinate).toEqual([12, 34]);
    layer.visible = false;
    expect(visiblePhotoStops(document)).toEqual([]);
  });

  it('center-crops photos without stretching and reserves strip space', () => {
    expect(coverImageBox({ width: 600, height: 400 }, { x: 10, y: 20, width: 20, height: 20 })).toEqual({ x: 5, y: 20, width: 30, height: 20 });
    const document = fixture();
    document.studio.photos.stops = [{ id: 'photo', layerId: 'poi-cafe', assetId: 'x', caption: 'Caption' }];
    document.studio.photos.strip.enabled = true;
    const layout = deriveStudioLayout(document);
    expect(layout.strip?.height).toBe(30);
    expect(layout.map.y + layout.map.height).toBe(layout.strip?.y);
  });
});

describe('silhouette poster fit', () => {
  const area: AdministrativeArea = {
    id: 'test', name: 'Test islands', source: 'test', countryCode: 'XX', level: 'country',
    geometry: { type: 'MultiPolygon', coordinates: [
      [[[10, 40], [12, 40], [12, 42], [10, 42], [10, 40]], [[10.5, 40.5], [10.5, 41], [11, 41], [11, 40.5], [10.5, 40.5]]],
      [[[13, 40], [13.2, 40], [13.2, 40.2], [13, 40.2], [13, 40]]],
    ] },
  };

  it('retains islands and holes, creates a new mask, and fits into the usable poster area', () => {
    const document = fixture();
    const application = createSilhouetteApplication(document, area, { x: 100, y: 50, width: 600, height: 400 }, { width: 800, height: 500 });
    expect(application.silhouette.geometry).toEqual(area.geometry);
    expect(application.silhouette.geometry).not.toBe(area.geometry);
    expect(application.silhouette.appearance).toMatchObject({ kind: 'shape', invert: true });
    expect(application.poster.silhouetteLayerId).toBe(application.silhouette.id);
    expect(application.camera?.zoom).toBeGreaterThan(5);
    expect(application.camera?.pitch).toBe(0);
    expect(document.layers).toHaveLength(4);
  });

  it('cannot bypass a camera lock', () => {
    const document = fixture();
    document.camera.locked = true;
    expect(() => createSilhouetteApplication(document, area, { x: 0, y: 0, width: 600, height: 400 }, { width: 600, height: 400 })).toThrow('Unlock');
  });

  it('admits a generated silhouette through the real store as one undoable change', () => {
    const store = createProjectStore(fixture());
    const before = store.getState().document;
    const application = createSilhouetteApplication(
      before, area, { x: 100, y: 50, width: 600, height: 400 }, { width: 800, height: 500 },
    );
    expect(store.getState().applyStudioTemplate(application)).toMatchObject({ ok: true });
    const after = store.getState().document;
    expect(after.studio.poster.silhouetteLayerId).toBe(application.silhouette.id);
    expect(after.layers.find(({ id }) => id === application.silhouette.id)).toMatchObject({
      geometry: area.geometry,
      appearance: { kind: 'shape', invert: true, strokeWidth: 0.5 },
    });
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().document).toEqual(before);
    store.getState().redo();
    expect(store.getState().document).toEqual(after);
  });
});

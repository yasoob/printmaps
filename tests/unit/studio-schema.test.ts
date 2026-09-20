import { createInitialProjectDocument, createNewProjectDocument, PROJECT_SCHEMA_VERSION } from '../../src/domain/project';
import { parseProjectDocument, parseProjectFileText, ProjectValidationCache } from '../../src/domain/projectFile';
import { createDefaultStudioSettings } from '../../src/domain/studio';
import { MAX_PHOTO_ASSET_BYTES, MAX_PHOTO_PROJECT_BYTES, parsePhotoAsset, parsePhotoAssets, validatePhotoFile } from '../../src/domain/studioPhotoAssets';
import { photoAsset, studioProject } from '../fixtures/studio';

it.each([24, 25])('migrates schema %i without discarding canonical content or enabling visual features', (schemaVersion) => {
  const source = createInitialProjectDocument();
  const legacy: Partial<typeof source> = { ...source };
  delete legacy.studio;
  const parsed = parseProjectFileText(JSON.stringify({ ...legacy, schemaVersion }));
  expect(parsed).toEqual({ ...source, schemaVersion: PROJECT_SCHEMA_VERSION });
  expect(parsed.studio).toEqual(createDefaultStudioSettings());
});

it.each([24, 25, 26])('retains rather than resets valid studio state supplied in schema %i', (schemaVersion) => {
  const source = studioProject();
  expect(parseProjectDocument({ ...source, schemaVersion })).toEqual(source);
});

it('round-trips all sections into detached deep-frozen settings', () => {
  const source = studioProject();
  const parsed = parseProjectFileText(JSON.stringify(source));
  expect(parsed).toEqual(source);
  expect(parsed.studio).not.toBe(source.studio);
  expect(parsed.studio.photos.assets).not.toBe(source.studio.photos.assets);
  expect(Object.isFrozen(parsed.studio)).toBe(true);
  expect(Object.isFrozen(parsed.studio.poster.title)).toBe(true);
  expect(Object.isFrozen(parsed.studio.photos.stops[0])).toBe(true);
  expect(Object.isFrozen(parsed.studio.terrain.buildings)).toBe(true);
});

it.each([
  ['missing namespace', undefined],
  ['null namespace', null],
  ['array namespace', []],
  ['missing section', { ...createDefaultStudioSettings(), terrain: undefined }],
  ['shadow camera', { ...createDefaultStudioSettings(), camera: { zoom: 12 } }],
  ['extra nested URL', { ...createDefaultStudioSettings(), wall: { ...createDefaultStudioSettings().wall, url: 'javascript:alert(1)' } }],
])('rejects %s in the current schema', (_label, studio) => {
  expect(() => parseProjectDocument({ ...createNewProjectDocument(), studio })).toThrow();
});

it.each([
  ['poster', { enabled: true }],
  ['poster', { ...createDefaultStudioSettings().poster, templateId: 'unknown' }],
  ['poster', { ...createDefaultStudioSettings().poster, marginsMm: { top: NaN, left: 1, right: 1, bottom: 1 } }],
  ['poster', { ...createDefaultStudioSettings().poster, title: { ...createDefaultStudioSettings().poster.title, text: 'x'.repeat(201) } }],
  ['poster', { ...createDefaultStudioSettings().poster, caption: { ...createDefaultStudioSettings().poster.caption, text: '\u{0}' } }],
  ['wall', { ...createDefaultStudioSettings().wall, matWidthMm: Infinity }],
  ['wall', { ...createDefaultStudioSettings().wall, wallColor: 'url(javascript:alert(1))' }],
  ['wall', { ...createDefaultStudioSettings().wall, frame: 'remote' }],
  ['terrain', { ...createDefaultStudioSettings().terrain, exaggeration: -1 }],
  ['terrain', { ...createDefaultStudioSettings().terrain, contours: { ...createDefaultStudioSettings().terrain.contours, intervalMeters: 0 } }],
  ['terrain', { ...createDefaultStudioSettings().terrain, buildings: { ...createDefaultStudioSettings().terrain.buildings, enabled: 'true' } }],
  ['video', { ...createDefaultStudioSettings().video, fps: 29 }],
  ['video', { ...createDefaultStudioSettings().video, durationSeconds: 60 }],
  ['video', { ...createDefaultStudioSettings().video, aspect: 'remote' }],
  ['relief', { ...createDefaultStudioSettings().relief, baseMm: 0 }],
  ['relief', { ...createDefaultStudioSettings().relief, detail: 'unbounded' }],
])('rejects malformed %s settings explicitly', (section, value) => {
  const source = createNewProjectDocument();
  expect(() => parseProjectDocument({ ...source, studio: { ...source.studio, [section]: value } })).toThrow();
});

it.each(['missing', 'basemap', 'route-01', 'poi-cafe'])('rejects silhouette references to %s', (silhouetteLayerId) => {
  const source = createInitialProjectDocument();
  source.studio.poster.silhouetteLayerId = silhouetteLayerId;
  expect(() => parseProjectDocument(source)).toThrow('polygon shape layer');
});

it('checks cross references again when layers change with a cached studio', () => {
  const source = studioProject();
  const cache = new ProjectValidationCache();
  const canonical = parseProjectDocument(source, cache);
  expect(() => parseProjectDocument({ ...canonical, layers: canonical.layers.filter(({ id }) => id !== 'poi-cafe') }, cache)).toThrow('Point POI');
  expect(() => parseProjectDocument({ ...canonical, layers: canonical.layers.filter(({ id }) => id !== 'route-01') }, cache)).toThrow('route layer');
});

it('never reuses validation for caller-mutated settings, even with the same cache', () => {
  const source = studioProject();
  const cache = new ProjectValidationCache();
  parseProjectDocument(source, cache);
  source.studio.photos.stops[0].assetId = 'missing';
  expect(() => parseProjectDocument(source, cache)).toThrow('missing photo asset');
});

it('rejects dangling photo assets, duplicate stops and incompatible location QR targets', () => {
  const source = studioProject();
  source.studio.photos.stops.push({ ...source.studio.photos.stops[0] });
  expect(() => parseProjectDocument(source)).toThrow('IDs must be unique');
  source.studio.photos.stops = [];
  expect(() => parseProjectDocument(source)).toThrow('referenced by a photo stop');
  source.studio.photos.assets = {};
  source.studio.decorations.qr.layerId = 'route-01';
  expect(() => parseProjectDocument(source)).toThrow('Point POI');
  source.studio.decorations.qr.target = 'map-center';
  expect(() => parseProjectDocument(source)).toThrow('without a layer ID');
});

it.each([
  { mimeType: 'image/svg+xml', dataUri: `data:image/svg+xml;base64,${btoa('<svg onload="alert(1)"/>')}` },
  { dataUri: 'https://example.test/photo.png' },
  { dataUri: 'javascript:alert(1)' },
  { dataUri: 'blob:https://example.test/photo' },
  { dataUri: 'data:image/png;base64,not base64!' },
  { dataUri: `data:image/png;base64,${btoa('<svg onload="alert(1)"/>')}` },
  { dataUri: 'data:image/jpeg;base64,/9j/' },
  { width: 100 },
  { height: Infinity },
  { width: 0 },
  { id: `sha256-${'0'.repeat(64)}` },
  { crop: { x: 1 } },
])('rejects unsafe or incorrect photo descriptors %#', (patch) => {
  expect(() => parsePhotoAsset({ ...photoAsset(), ...patch })).toThrow();
});

it('enforces image byte, dimension, count, encoded-total and decoded-total bounds', () => {
  const minimal = photoAsset();
  const baselineBytes = atob(minimal.dataUri.split(',', 2)[1]).length;
  expect(() => parsePhotoAsset(photoAsset(MAX_PHOTO_ASSET_BYTES - baselineBytes))).not.toThrow();
  expect(() => parsePhotoAsset(photoAsset(MAX_PHOTO_ASSET_BYTES - baselineBytes + 1))).toThrow('1 MiB');
  expect(() => parsePhotoAsset(photoAsset(0, 2049, 1))).toThrow('2048');
  const oversizedCount = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`key-${index}`, minimal]));
  expect(() => parsePhotoAssets(oversizedCount)).toThrow('at most 24');
  const largeAssets = Array.from({ length: 5 }, (_, index) => photoAsset(999_000 + index));
  expect(largeAssets.reduce((sum, asset) => sum + asset.dataUri.length, 0)).toBeGreaterThan(MAX_PHOTO_PROJECT_BYTES);
  expect(() => parsePhotoAssets(Object.fromEntries(largeAssets.map((asset) => [asset.id, asset])))).toThrow('6 MiB');
  const pixelAssets = Array.from({ length: 5 }, (_, index) => photoAsset(index, 2048, 2048));
  expect(() => parsePhotoAssets(Object.fromEntries(pixelAssets.map((asset) => [asset.id, asset])))).toThrow('decoded pixel');
});

it('provides a validated browser-file ingestion helper without decoding into mutable document objects', async () => {
  const asset = photoAsset();
  const bytes = Uint8Array.from(atob(asset.dataUri.split(',', 2)[1]), (character) => character.codePointAt(0)!);
  const file = new File([bytes], 'photo.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  expect(await validatePhotoFile(file)).toEqual(asset);
  await expect(validatePhotoFile(new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' }))).rejects.toThrow('not supported');
});

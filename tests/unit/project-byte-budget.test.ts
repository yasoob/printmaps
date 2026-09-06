import { createProjectStore, type ProjectState } from '../../src/app/store';
import { createPortableProjectFile } from '../../src/app/components/projectDownload';
import { parseProjectDocument, parseProjectFileText, ProjectValidationCache } from '../../src/domain/projectFile';
import { CompactJsonByteCache, MAX_PROJECT_FILE_BYTES, ProjectSizeError, portableProjectText, utf8Bytes } from '../../src/domain/projectSerialization';
import { validateCustomMarkerAssetCollection } from '../../src/domain/customMarkerAssets';
import type { ProjectMutationResult } from '../../src/domain/projectMutation';
import * as geometry from '../../src/domain/projectGeometry';
import * as project from '../../src/domain/project';
import { boundaryProject, byteBudgetProject, paddedMarker } from '../fixtures/portableBudget';
import { AutosavePersistenceSession } from '../../src/storage/AutosavePersistenceSession';
import { createIndexedDbAutosaveRepository } from '../../src/storage/autosave';
import { IDBFactory } from 'fake-indexeddb';

const full = byteBudgetProject();
const largerMarker = paddedMarker(99, 1_000_000);

it('counts exactly the actual UTF8 compact JSON, including every UTF16 code unit, escaping, keys, omissions and punctuation', () => {
  const allCodeUnits = Array.from({ length: 65_536 }, (_, code) => String.fromCodePoint(code)).join('');
  const sparse: unknown[] = [true, false, {}, { nested: [[], {}, null] }];
  sparse.length += 1;
  sparse.push(undefined);
  const values = [
    allCodeUnits, '😀é水\u{0}\b\t\n\r\f"\\\u{D800}\u{DFFF}', [-0, 1e-7, 1e21, NaN, Infinity, undefined],
    { '😀"\n': 'é', omitted: undefined, null: null, empty: [], toJSON: 'ordinary JSON property' },
    sparse,
  ];
  for (const value of values) expect(new CompactJsonByteCache().size(value)).toBe(utf8Bytes(JSON.stringify(value)));
});

it('exports the actual 160200-position importer result losslessly as compact JSON when readable JSON is too large', () => {
  const document = boundaryProject();
  expect(document.layers).toHaveLength(201);
  expect(utf8Bytes(JSON.stringify(document, null, 2))).toBeGreaterThan(MAX_PROJECT_FILE_BYTES);
  expect(utf8Bytes(JSON.stringify(document))).toBeLessThan(MAX_PROJECT_FILE_BYTES);
  const file = createPortableProjectFile(document);
  expect(file.size).toBe(utf8Bytes(JSON.stringify(document)));
  expect(parseProjectFileText(portableProjectText(document))).toEqual(parseProjectDocument(document));
});

it.each([-1, 0, 1])('applies the exact compact-byte limit at cap%+i with structurally valid geometry and assets', (delta) => {
  const document = { ...full, title: delta < 0 ? full.title.slice(0, -1) : full.title + 'x'.repeat(delta) };
  expect(utf8Bytes(JSON.stringify(document))).toBe(MAX_PROJECT_FILE_BYTES + delta);
  expect(() => validateCustomMarkerAssetCollection(document.assets)).not.toThrow();
  if (delta > 0) {
    expect(() => parseProjectDocument(document)).toThrow(ProjectSizeError);
    expect(() => createProjectStore(document)).toThrow(ProjectSizeError);
    expect(() => createPortableProjectFile(document)).toThrow(ProjectSizeError);
  } else {
    expect(() => parseProjectDocument(document)).not.toThrow();
    expect(createPortableProjectFile(document).size).toBe(MAX_PROJECT_FILE_BYTES + delta);
  }
}, 30_000);

const operations: [string, (state: ProjectState) => ProjectMutationResult][] = [
  ['title', (state) => state.setProjectTitle(`${state.document.title}x`)],
  ['layer name', (state) => state.renameLayer('marker-5', 'A longer layer name')],
  ['width', (state) => state.setPageDimension('widthMm', 298.125)],
  ['pitch', (state) => state.setCameraPitch(12)],
  ['bearing', (state) => state.setCameraBearing(90)],
  ['camera history', (state) => state.setCameraViewport([16.123456, 48.123456], 11.123456)],
  ['camera amend', (state) => state.setCameraViewport([16.123456, 48.123456], 11.123456, 'amend')],
  ['opacity', (state) => state.setLayerOpacity('marker-5', 99)],
  ['style', (state) => state.setMapStyle('blueprint')],
  ['custom color', (state) => state.setMapStyleColor('water', '#123456')],
  ['layer visibility', (state) => state.toggleLayerVisibility('marker-5')],
  ['map feature visibility', (state) => state.setMapFeatureVisibility('roads', false)],
  ['custom page preset', (state) => state.setPagePreset('Custom')],
  ['larger custom marker', (state) => state.setPoiCustomMarker('marker-5', largerMarker)],
  ['label', (state) => {
    const appearance = state.document.layers[0].appearance;
    if (appearance?.kind !== 'poi') throw new Error('Missing POI');
    return state.setLayerAppearance('marker-5', { ...appearance, label: 'A bigger label' });
  }],
  ['new POI', (state) => state.createPoi([0, 0])],
  ['batch', (state) => state.createPoiBatch([{ name: 'Extra', coordinates: [0, 0] }])],
  ['duplicate', (state) => state.duplicateLayer('marker-5')],
  ['import', (state) => state.importLayers([{ ...state.document.layers[0], id: 'extra' }], state.documentEpoch, state.document)],
  ['open', (state) => state.openDocument({ ...full, title: `${full.title}x` })],
];

it('rejects every growing scalar/create/import/duplicate/open operation atomically, retaining redo and producing no subscription/autosave activity', async () => {
  vi.useFakeTimers();
  const store = createProjectStore(full);
  store.getState().setProjectTitle(full.title.replace('X', 'Y'));
  store.getState().undo();
  store.getState().selectLayer('marker-5');
  const before = store.getState();
  const changed = vi.fn();
  const unsubscribe = store.subscribe(changed);
  const save = vi.fn();
  const stop = new AutosavePersistenceSession({
    store, repository: { load: vi.fn(), save, discard: vi.fn(), close: vi.fn() },
    onSaveStarted: vi.fn(), onSaveFailed: vi.fn(), onSaveSucceeded: vi.fn(),
  }).start();
  for (const [label, operation] of operations) {
    expect(operation(store.getState()), label).toMatchObject({ ok: false, code: 'capacity' });
    expect(store.getState(), label).toBe(before);
  }
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  await vi.advanceTimersByTimeAsync(500);
  expect(changed).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  expect(before.canRedo).toBe(true);
  stop(); unsubscribe(); vi.useRealTimers();
}, 30_000);

it('does not stringify or revisit immutable geometry/assets during camera updates, including after a rejected candidate', () => {
  const cache = new ProjectValidationCache();
  parseProjectDocument(full, cache);
  const parseGeometry = vi.spyOn(geometry, 'parseLayerGeometry');
  const stringify = vi.spyOn(JSON, 'stringify');
  const assetRead = vi.spyOn(Object, 'entries');
  for (let index = 1; index <= 10; index += 1) {
    const candidate = { ...full, camera: { ...full.camera, zoom: index } };
    expect(() => parseProjectDocument(candidate, cache)).not.toThrow();
  }
  expect(() => parseProjectDocument({ ...full, title: full.title + 'overflow' }, cache)).toThrow(ProjectSizeError);
  expect(() => parseProjectDocument(full, cache)).not.toThrow();
  expect(parseGeometry).not.toHaveBeenCalled();
  expect(stringify).not.toHaveBeenCalled();
  expect(assetRead.mock.calls.some(([value]) => value === full.assets)).toBe(false);
  parseGeometry.mockRestore(); stringify.mockRestore(); assetRead.mockRestore();
}, 30_000);

it('uses fresh validation for untrusted mutated input rather than another parse cache', () => {
  const value = boundaryProject();
  parseProjectDocument(value);
  value.title = 'x'.repeat(201);
  expect(() => parseProjectDocument(value)).toThrow('200 characters');
});

it('reuses detached validated history snapshots for accepted camera commits without traversing geometry or assets', () => {
  const store = createProjectStore(full);
  const original = store.getState().document;
  const parseGeometry = vi.spyOn(geometry, 'parseLayerGeometry');
  const cloneLayer = vi.spyOn(project, 'cloneContentLayer');
  const entries = vi.spyOn(Object, 'entries');
  const stringify = vi.spyOn(JSON, 'stringify');
  for (const bearing of [1, 2, 3]) expect(store.getState().setCameraBearing(bearing)).toMatchObject({ ok: true });
  expect(cloneLayer).not.toHaveBeenCalled();
  expect(parseGeometry).not.toHaveBeenCalled();
  expect(stringify).not.toHaveBeenCalled();
  expect(entries.mock.calls.some(([value]) => value === original.assets)).toBe(false);
  expect(store.getState().past[0].layers).not.toBe(original.layers);
  expect(store.getState().past[0].layers).toBe(store.getState().past[1].layers);
  parseGeometry.mockRestore(); cloneLayer.mockRestore(); entries.mockRestore(); stringify.mockRestore();
  store.getState().undo();
  expect(store.getState().document.camera.bearing).toBe(2);
  store.getState().redo();
  expect(store.getState().document.camera.bearing).toBe(3);
}, 30_000);

it('autosaves and reopens an exactly capped document without an extra newline pushing it over the Open budget', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const repository = createIndexedDbAutosaveRepository({ databaseName: 'portable-exact-cap' });
  await repository.load();
  await repository.save(full);
  const restored = await repository.load();
  expect(restored?.document).toEqual(parseProjectDocument(full));
  const text = portableProjectText(full);
  expect(utf8Bytes(text)).toBe(MAX_PROJECT_FILE_BYTES);
  expect(text.endsWith('\n')).toBe(false);
  expect(parseProjectFileText(text)).toEqual(restored?.document);
  expect(() => parseProjectFileText(`${text}\n`)).toThrow(ProjectSizeError);
  repository.close();
  vi.unstubAllGlobals();
}, 30_000);

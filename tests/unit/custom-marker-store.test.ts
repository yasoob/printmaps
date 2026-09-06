import { sha256Hex, type CustomMarkerAsset } from '../../src/domain/customMarkerAssets';
import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';
import { createProjectStore } from '../../src/app/store';
import { markerCapacityProject, svgMarkerAsset } from '../fixtures/customMarkerCapacity';
import { byteBudgetProject, paddedMarker } from '../fixtures/portableBudget';

const markerBase64 = btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path d="M0 0H100V120H0Z"/></svg>');
const markerBytes = Uint8Array.from(atob(markerBase64), (character) => character.codePointAt(0) ?? 0);
const asset: CustomMarkerAsset = {
  id: `sha256-${sha256Hex(markerBytes)}`,
  mimeType: 'image/svg+xml',
  width: 100,
  height: 120,
  dataUri: `data:image/svg+xml;base64,${markerBase64}`,
};

describe('canonical custom marker storage', () => {
  it('round-trips a 24-unit vector without changing dormant standard appearance', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const original = store.getState().document.layers.find(({ id }) => id === 'poi-cafe')!.appearance;
    const small = svgMarkerAsset();
    expect(store.getState().setPoiCustomMarker('poi-cafe', small)).toEqual({ ok: true, changed: true });
    const document = parseProjectFileText(JSON.stringify(store.getState().document));
    expect(document.assets[small.id]).toEqual(small);
    expect(document.layers.find(({ id }) => id === 'poi-cafe')?.appearance).toEqual({ ...original, customAssetId: small.id });
    const prior = store.getState();
    expect(prior.setPoiCustomMarker('poi-cafe', { ...small })).toEqual({ ok: true, changed: false });
    expect(store.getState()).toBe(prior);
    expect(prior.setPoiCustomMarker('poi-cafe', { ...small, width: 100 })).toMatchObject({ ok: false, code: 'invalid', error: expect.stringContaining('dimensions do not match') });
    expect(store.getState()).toBe(prior);
  });

  it.each(['count', 'encoded', 'decoded'] as const)('returns a specific %s capacity rejection atomically, then permits retry after capacity is freed', (kind) => {
    const store = createProjectStore(markerCapacityProject(kind));
    // Preserve a nonempty redo stack as well as the document and selection.
    store.getState().renameLayer('poi-cafe', 'Changed'); store.getState().undo();
    store.getState().selectLayer('poi-cafe');
    const prior = store.getState();
    const next = kind === 'encoded' ? paddedMarker(99, 400_000) : svgMarkerAsset();
    const message = kind === 'count' ? '64 custom marker assets' : (kind === 'encoded' ? '8 MiB encoded' : 'decoded pixel budget');
    expect(prior.setPoiCustomMarker('poi-cafe', next)).toMatchObject({
      ok: false, code: 'capacity', error: expect.stringContaining(message),
    });
    expect(store.getState()).toBe(prior);
    prior.deleteLayer('marker-0');
    expect(store.getState().setPoiCustomMarker('poi-cafe', next)).toEqual({ ok: true, changed: true });
    const roundTrip = parseProjectFileText(JSON.stringify(store.getState().document));
    expect(roundTrip.assets).toHaveProperty(next.id);
    store.getState().undo();
    expect(store.getState().document.assets).not.toHaveProperty(next.id);
  });

  it('prunes an exclusively owned old marker before evaluating a replacement at the count limit', () => {
    const store = createProjectStore(markerCapacityProject('count'));
    const previous = store.getState().document;
    const next = svgMarkerAsset();
    expect(store.getState().setPoiCustomMarker('marker-0', next)).toEqual({ ok: true, changed: true });
    expect(Object.keys(store.getState().document.assets)).toHaveLength(64);
    store.getState().undo();
    expect(store.getState().document).toEqual(previous);
    expect(store.getState().setPoiCustomMarker('poi-cafe', Object.values(previous.assets)[0])).toEqual({ ok: true, changed: true });
    expect(Object.keys(store.getState().document.assets)).toHaveLength(64);
  });

  it('returns portable-byte rejection through the same admission boundary', () => {
    const project = byteBudgetProject();
    const store = createProjectStore(project);
    const old = project.layers.find(({ id }) => id === 'marker-5')!.appearance;
    if (old?.kind !== 'poi' || !old.customAssetId) throw new Error('Expected marker fixture');
    const bytes = atob(project.assets[old.customAssetId].dataUri.split(',', 2)[1]).length;
    const prior = store.getState();
    expect(prior.setPoiCustomMarker('marker-5', paddedMarker(5, bytes + 3))).toMatchObject({
      ok: false, code: 'capacity', error: expect.stringContaining('10 MB portable limit'),
    });
    expect(store.getState()).toBe(prior);
  });

  it.each(['missing', 'route-01'])('rejects unavailable target %s without pretending an upload succeeded', (id) => {
    const store = createProjectStore(createInitialProjectDocument());
    const prior = store.getState();
    expect(prior.setPoiCustomMarker(id, asset)).toMatchObject({ ok: false, code: 'unavailable' });
    expect(store.getState()).toBe(prior);
  });

  it('attaches a hash-owned marker to one POI as a single undoable document edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setPoiCustomMarker('poi-cafe', asset);

    let state = store.getState();
    expect(state.document.assets).toEqual({ [asset.id]: asset });
    expect(state.document.layers.find(({ id }) => id === 'poi-cafe')?.appearance).toMatchObject({
      kind: 'poi',
      customAssetId: asset.id,
    });
    state.undo();
    state = store.getState();
    expect(state.document.assets).toEqual({});
    expect(state.document.layers.find(({ id }) => id === 'poi-cafe')?.appearance).toMatchObject({
      kind: 'poi',
      customAssetId: null,
    });
    state.redo();
    expect(store.getState().document.assets).toHaveProperty(asset.id);
  });

  it('keeps a shared marker while referenced and prunes it after the final POI is deleted', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setPoiCustomMarker('poi-cafe', asset);
    store.getState().duplicateLayer('poi-cafe');

    store.getState().deleteLayer('poi-cafe');
    expect(store.getState().document.assets).toHaveProperty(asset.id);
    store.getState().deleteLayer('poi-cafe-copy');
    expect(store.getState().document.assets).toEqual({});
  });

  it('keeps custom-asset ownership behind the dedicated marker action', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setPoiCustomMarker('poi-cafe', asset);
    const appearance = store.getState().document.layers.find(({ id }) => id === 'poi-cafe')?.appearance;
    if (appearance?.kind !== 'poi') throw new Error('Expected POI appearance.');

    store.getState().setLayerAppearance('poi-cafe', { ...appearance, color: '#445566', customAssetId: null });
    let document = store.getState().document;
    expect(document.layers.find(({ id }) => id === 'poi-cafe')?.appearance).toMatchObject({
      color: '#445566',
      customAssetId: asset.id,
    });
    expect(document.assets).toHaveProperty(asset.id);

    store.getState().setLayerAppearance('poi-cafe', {
      ...appearance,
      customAssetId: `sha256-${'f'.repeat(64)}`,
    });
    document = store.getState().document;
    expect(document.layers.find(({ id }) => id === 'poi-cafe')?.appearance).toMatchObject({ customAssetId: asset.id });
    expect(() => parseProjectFileText(JSON.stringify(document))).not.toThrow();
  });

  it('round-trips referenced canonical assets and rejects missing or mismatched hashes', () => {
    const source = createInitialProjectDocument();
    const poi = source.layers.find(({ id }) => id === 'poi-cafe');
    if (poi?.appearance?.kind !== 'poi') throw new Error('Expected POI fixture.');
    source.assets[asset.id] = asset;
    poi.appearance.customAssetId = asset.id;

    expect(parseProjectFileText(JSON.stringify(source))).toEqual(source);

    const missing = structuredClone(source);
    missing.assets = {};
    expect(() => parseProjectFileText(JSON.stringify(missing))).toThrow('references a missing custom marker asset');

    const mismatched = structuredClone(source);
    mismatched.assets[asset.id] = { ...mismatched.assets[asset.id], id: `sha256-${'b'.repeat(64)}` };
    expect(() => parseProjectFileText(JSON.stringify(mismatched))).toThrow('asset key must match its SHA-256 ID');

    const tampered = structuredClone(source);
    tampered.assets[asset.id] = {
      ...tampered.assets[asset.id],
      dataUri: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><circle cx="50" cy="60" r="40"/></svg>')}`,
    };
    expect(() => parseProjectFileText(JSON.stringify(tampered))).toThrow('content does not match its SHA-256 ID');

    const unreferenced = createInitialProjectDocument();
    unreferenced.assets[asset.id] = asset;
    expect(() => parseProjectFileText(JSON.stringify(unreferenced))).toThrow('is not referenced by a POI layer');
  });
});

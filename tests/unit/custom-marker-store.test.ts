import { sha256Hex, type CustomMarkerAsset } from '../../src/domain/customMarkerAssets';
import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';
import { createProjectStore } from '../../src/app/store';

const markerBase64 = 'PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEyMCI+PHBhdGggZD0iTTAgMEgxMDBWMTIwSDBaIi8+PC9zdmc+';
const markerBytes = Uint8Array.from(atob(markerBase64), (character) => character.codePointAt(0) ?? 0);
const asset: CustomMarkerAsset = {
  id: `sha256-${sha256Hex(markerBytes)}`,
  mimeType: 'image/svg+xml',
  width: 100,
  height: 120,
  dataUri: `data:image/svg+xml;base64,${markerBase64}`,
};

describe('canonical custom marker storage', () => {
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
      dataUri: `data:image/svg+xml;base64,${btoa('<svg viewBox="0 0 100 120"><circle cx="50" cy="60" r="40"/></svg>')}`,
    };
    expect(() => parseProjectFileText(JSON.stringify(tampered))).toThrow('content does not match its SHA-256 ID');

    const unreferenced = createInitialProjectDocument();
    unreferenced.assets[asset.id] = asset;
    expect(() => parseProjectFileText(JSON.stringify(unreferenced))).toThrow('is not referenced by a POI layer');
  });
});

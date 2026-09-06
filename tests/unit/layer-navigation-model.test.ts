import { captureLayerReorder, filterLayers, isLayerReorderCurrent, layerFocusIndex, layerReorderDestination } from '../../src/app/components/layerNavigationModel';
import { createProjectStore } from '../../src/app/store';
import { parseProjectFileText } from '../../src/domain/projectFile';
import { filteredLayerNavigationProject, layerNavigationProject } from '../fixtures/layerNavigationProject';

describe('layer navigation model', () => {
  it('uses parser-valid 300-point fixtures and preserves duplicate-name IDs', () => {
    const project = layerNavigationProject();
    project.layers[5].name = 'Place duplicate';
    project.layers[50].name = 'PLACE duplicate';
    expect(parseProjectFileText(JSON.stringify(project))).toEqual(project);
    expect(filterLayers(project.layers, ' place DUPLICATE ').map((layer) => layer.id)).toEqual(['place-6', 'place-51']);
    expect(filterLayers(project.layers, ' '.repeat(3))).toBe(project.layers);
    expect(filterLayers(project.layers, 'absent')).toEqual([]);
  });

  it.each([
    ['place-1', 2, ['place-2', 'place-3', 'place-4', 'place-5', 'place-1', 'basemap']],
    ['place-5', 0, ['place-5', 'place-1', 'place-2', 'place-3', 'place-4', 'basemap']],
    ['place-3', 0, ['place-3', 'place-1', 'place-2', 'place-4', 'place-5', 'basemap']],
    ['place-1', 1, ['place-2', 'place-3', 'place-1', 'place-4', 'place-5', 'basemap']],
    ['place-5', 1, ['place-1', 'place-2', 'place-5', 'place-3', 'place-4', 'basemap']],
  ])('moves %s to visible index %s without reordering hidden neighbors', (id, visibleIndex, expected) => {
    const store = createProjectStore(filteredLayerNavigationProject());
    const before = store.getState().document;
    const layers = before.layers;
    const visible = filterLayers(layers, 'keep').map((layer) => layer.id);
    const index = layerReorderDestination(layers, visible, id, visibleIndex);
    expect(index).not.toBeNull();
    store.getState().moveLayer(id, index!);
    expect(store.getState().document.layers.map((layer) => layer.id)).toEqual(expected);
    expect(store.getState().document.layers.filter((layer) => !visible.includes(layer.id)).map((layer) => layer.id)).toEqual(['place-2', 'place-4', 'basemap']);
    store.getState().undo();
    expect(store.getState().document).toEqual(before);
    store.getState().redo();
    expect(store.getState().document.layers.map((layer) => layer.id)).toEqual(expected);
  });

  it('keeps the basemap fixed and permits locked content reorder', () => {
    const project = filteredLayerNavigationProject();
    project.layers[0].locked = true;
    const ids = project.layers.map((layer) => layer.id);
    expect(layerReorderDestination(project.layers, ids, 'place-1', 5)).toBe(4);
    expect(layerReorderDestination(project.layers, ids, 'place-1', -1)).toBe(0);
    expect(layerReorderDestination(project.layers, ids, 'basemap', 0)).toBeNull();
    expect(layerReorderDestination(project.layers, ids, 'absent', 0)).toBeNull();
    expect(layerReorderDestination(project.layers, [], 'place-1', 0)).toBeNull();
    expect(layerReorderDestination(project.layers, ids, 'place-1', 1.5)).toBeNull();
  });

  it('owns drag snapshots by epoch, exact filter and canonical layer identity, not camera or selection', () => {
    const store = createProjectStore(filteredLayerNavigationProject());
    const state = store.getState();
    const owner = captureLayerReorder(state.document.layers, state.documentEpoch, 'keep', 'place-1');
    store.getState().selectLayer('place-3');
    store.getState().setCameraViewport([16.4, 48.21], 12);
    expect(isLayerReorderCurrent(owner, store.getState().document.layers, state.documentEpoch, 'keep')).toBe(true);
    expect(isLayerReorderCurrent(owner, [...state.document.layers], state.documentEpoch, 'keep')).toBe(false);
    expect(isLayerReorderCurrent(owner, state.document.layers, state.documentEpoch + 1, 'keep')).toBe(false);
    expect(isLayerReorderCurrent(owner, state.document.layers, state.documentEpoch, 'KEEP')).toBe(false);
  });

  it.each([
    ['ArrowUp', 0, 0], ['ArrowDown', 2, 3], ['ArrowDown', 4, 4],
    ['Home', 3, 0], ['End', 1, 4], ['Enter', 1, null], [' ', 1, null], ['Tab', 1, null],
  ])('maps %s at %s to %s without wrapping or treating activation as navigation', (key, index, expected) => {
    expect(layerFocusIndex(key, index, 5)).toBe(expected);
  });
});

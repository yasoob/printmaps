import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

const shapeGeometry = (store: ReturnType<typeof createProjectStore>, id: string) => (
  store.getState().document.layers.find((layer) => layer.id === id)?.geometry
);

describe('shape vertex store edits', () => {
  it('moves the first shape vertex and its closing coordinate as one undoable edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setShapeVertex('area-center', 0, 0, [16.35, 48.19]);

    expect(shapeGeometry(store, 'area-center')).toEqual({
      type: 'Polygon',
      coordinates: [[
        [16.35, 48.19], [16.395, 48.198], [16.395, 48.22], [16.354, 48.22], [16.35, 48.19],
      ]],
    });
    store.getState().undo();
    expect(shapeGeometry(store, 'area-center')).toEqual({
      type: 'Polygon',
      coordinates: [[
        [16.354, 48.198], [16.395, 48.198], [16.395, 48.22], [16.354, 48.22], [16.354, 48.198],
      ]],
    });
    store.getState().redo();
    expect(shapeGeometry(store, 'area-center')?.coordinates[0]).toEqual([
      [16.35, 48.19], [16.395, 48.198], [16.395, 48.22], [16.354, 48.22], [16.35, 48.19],
    ]);
  });

  it('rejects a shape vertex move that would leave fewer than three distinct vertices', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().createShape([[16.31, 48.19], [16.4, 48.19], [16.36, 48.24]]);
    const historyLength = store.getState().past.length;

    store.getState().setShapeVertex('shape-01', 0, 1, [16.31, 48.19]);

    expect(shapeGeometry(store, 'shape-01')).toEqual({
      type: 'Polygon',
      coordinates: [[[16.31, 48.19], [16.4, 48.19], [16.36, 48.24], [16.31, 48.19]]],
    });
    expect(store.getState().past).toHaveLength(historyLength);
  });

  it('moves a hole vertex without changing the outer ring', () => {
    const document = createInitialProjectDocument();
    const shape = document.layers.find((layer) => layer.id === 'area-center');
    if (shape?.geometry?.type !== 'Polygon') throw new Error('Expected the initial shape polygon.');
    const outerRing = shape.geometry.coordinates[0];
    shape.geometry.coordinates.push([
      [16.36, 48.2], [16.37, 48.2], [16.365, 48.21], [16.36, 48.2],
    ]);
    const store = createProjectStore(document);

    store.getState().setShapeVertex('area-center', 1, 0, [16.361, 48.201]);

    expect(shapeGeometry(store, 'area-center')).toEqual({
      type: 'Polygon',
      coordinates: [outerRing, [
        [16.361, 48.201], [16.37, 48.2], [16.365, 48.21], [16.361, 48.201],
      ]],
    });
  });

  it.each([
    { label: 'wrong layer type', id: 'route-01', ringIndex: 0, vertexIndex: 0, coordinates: [16.35, 48.19] },
    { label: 'missing ring', id: 'area-center', ringIndex: 1, vertexIndex: 0, coordinates: [16.35, 48.19] },
    { label: 'closing coordinate', id: 'area-center', ringIndex: 0, vertexIndex: 4, coordinates: [16.35, 48.19] },
    { label: 'negative vertex', id: 'area-center', ringIndex: 0, vertexIndex: -1, coordinates: [16.35, 48.19] },
    { label: 'non-integer ring', id: 'area-center', ringIndex: 0.5, vertexIndex: 0, coordinates: [16.35, 48.19] },
    { label: 'out-of-range longitude', id: 'area-center', ringIndex: 0, vertexIndex: 0, coordinates: [181, 48.19] },
    { label: 'unchanged coordinate', id: 'area-center', ringIndex: 0, vertexIndex: 0, coordinates: [16.354, 48.198] },
  ] as const)('rejects a $label edit without changing geometry or history', ({ id, ringIndex, vertexIndex, coordinates }) => {
    const store = createProjectStore(createInitialProjectDocument());
    const initialGeometry = shapeGeometry(store, 'area-center');

    store.getState().setShapeVertex(id, ringIndex, vertexIndex, coordinates);

    expect(shapeGeometry(store, 'area-center')).toEqual(initialGeometry);
    expect(store.getState().canUndo).toBe(false);
  });
});

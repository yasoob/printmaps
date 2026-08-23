import { createProjectStore } from '../../src/app/store';
import {
  ADMINISTRATIVE_AREAS,
  administrativeAreaById,
  mergeAdministrativeAreas,
} from '../../src/domain/administrativeAreas';
import { createInitialProjectDocument } from '../../src/domain/project';

function signedRingArea(ring: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const [x1, y1] = ring[index - 1];
    const [x2, y2] = ring[index];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

describe('bundled administrative areas', () => {
  it('exposes a small sourced country catalogue with closed bounded polygons', () => {
    expect(ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country').map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'AUT', name: 'Austria' },
      { id: 'HUN', name: 'Hungary' },
      { id: 'SVK', name: 'Slovakia' },
    ]);

    for (const area of ADMINISTRATIVE_AREAS) {
      expect(area.source).toContain('Natural Earth');
      expect(area.geometry.type).toBe('Polygon');
      const ring = area.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring.at(-1)).toEqual(ring[0]);
      expect(ring.every(([longitude, latitude]) => (
        Number.isFinite(longitude)
        && Number.isFinite(latitude)
        && Math.abs(longitude) <= 180
        && Math.abs(latitude) <= 90
      ))).toBe(true);
    }
    expect(administrativeAreaById('missing')).toBeUndefined();
  });

  it('merges adjacent sourced Austrian regions into one polygon without internal borders', () => {
    expect(ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'region').map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'AT-1', name: 'Burgenland' },
      { id: 'AT-2', name: 'Carinthia' },
      { id: 'AT-3', name: 'Lower Austria' },
      { id: 'AT-4', name: 'Upper Austria' },
      { id: 'AT-5', name: 'Salzburg' },
      { id: 'AT-6', name: 'Styria' },
      { id: 'AT-8', name: 'Vorarlberg' },
      { id: 'AT-9', name: 'Vienna' },
    ]);

    const lowerAustria = administrativeAreaById('AT-3');
    const vienna = administrativeAreaById('AT-9');
    const merged = mergeAdministrativeAreas(['AT-3', 'AT-9']);

    expect(lowerAustria?.geometry.coordinates).toHaveLength(2);
    expect(vienna?.geometry.coordinates).toHaveLength(1);
    expect(merged).toMatchObject({
      name: 'Lower Austria + Vienna',
      geometry: { type: 'Polygon' },
    });
    expect(merged?.geometry.coordinates).toHaveLength(1);
    expect(new Set(merged?.geometry.coordinates[0].map(String))).toEqual(new Set(lowerAustria?.geometry.coordinates[0].map(String)));
    expect(signedRingArea(merged!.geometry.coordinates[0])).toBeGreaterThan(0);
    expect(mergeAdministrativeAreas(['AT-3', 'missing'])).toBeUndefined();
  });

  it('rejects a disconnected region selection instead of treating another exterior as a hole', () => {
    expect(mergeAdministrativeAreas(['AT-1', 'AT-8'])).toBeUndefined();
  });

  it('adds a selected administrative area as one undoable canonical shape', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createAdministrativeArea('AUT');

    const area = store.getState().document.layers.find(({ id }) => id === 'admin-aut');
    expect(area).toMatchObject({
      name: 'Austria',
      type: 'shape',
      visible: true,
      locked: false,
      appearance: { kind: 'shape' },
      geometry: administrativeAreaById('AUT')?.geometry,
    });
    expect(store.getState().selectedId).toBe('admin-aut');
    expect(store.getState().document.layers.at(-1)?.type).toBe('basemap');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(store.getState().document.layers.some(({ id }) => id === 'admin-aut')).toBe(false);
    expect(store.getState().selectedId).toBeNull();

    store.getState().createAdministrativeArea('missing');
    expect(store.getState().canUndo).toBe(false);
  });

  it('adds a merged region selection as one canonical layer and one undo step', () => {
    const store = createProjectStore(createInitialProjectDocument());

    const createdId = store.getState().createAdministrativeAreas(['AT-3', 'AT-9']);

    expect(createdId).toBe('admin-at-3-at-9');
    const layer = store.getState().document.layers.find(({ id }) => id === createdId);
    expect(layer).toMatchObject({
      name: 'Lower Austria + Vienna',
      type: 'shape',
      geometry: { type: 'Polygon' },
    });
    expect(layer?.geometry?.type === 'Polygon' ? layer.geometry.coordinates : []).toHaveLength(1);
    expect(store.getState().selectedId).toBe(createdId);
    store.getState().undo();
    expect(store.getState().document.layers.some(({ id }) => id === createdId)).toBe(false);
    expect(store.getState().canUndo).toBe(false);
  });
});

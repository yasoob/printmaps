import { createProjectStore } from '../../src/app/store';
import {
  ADMINISTRATIVE_AREAS,
  administrativeAreaById,
} from '../../src/domain/administrativeAreas';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('bundled administrative areas', () => {
  it('exposes a small sourced country catalogue with closed bounded polygons', () => {
    expect(ADMINISTRATIVE_AREAS.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'AUT', name: 'Austria' },
      { id: 'HUN', name: 'Hungary' },
      { id: 'SVK', name: 'Slovakia' },
    ]);

    for (const area of ADMINISTRATIVE_AREAS) {
      expect(area.level).toBe('country');
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
});

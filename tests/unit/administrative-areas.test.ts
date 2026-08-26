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

describe('bundled Slovak administrative regions', () => {
  it('exposes eight sourced Slovak regions with closed bounded polygons', () => {
    const regions = ADMINISTRATIVE_AREAS.filter(({ countryCode, level }) => countryCode === 'SVK' && level === 'region');

    expect(regions.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'SK-BL', name: 'Bratislava' },
      { id: 'SK-TA', name: 'Trnava' },
      { id: 'SK-TC', name: 'Trenčín' },
      { id: 'SK-NI', name: 'Nitra' },
      { id: 'SK-ZI', name: 'Žilina' },
      { id: 'SK-BC', name: 'Banská Bystrica' },
      { id: 'SK-PV', name: 'Prešov' },
      { id: 'SK-KI', name: 'Košice' },
    ]);
    expect(regions.every(({ geometry, source }) => (
      source.includes('downloaded 2026-08-26')
      && geometry.type === 'Polygon'
      && geometry.coordinates.every((ring) => ring.length >= 4 && ring.at(-1)?.join(',') === ring[0].join(','))
    ))).toBe(true);
  });
});

describe('bundled administrative areas', () => {
  it('exposes every Vienna municipal district from one bounded attributed source', () => {
    const municipalities = ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'municipality');

    expect(municipalities).toHaveLength(23);
    expect(municipalities.map(({ id, name }) => ({ id, name }))).toEqual(expect.arrayContaining([
      { id: 'AT-9-01', name: 'Innere Stadt' },
      { id: 'AT-9-23', name: 'Liesing' },
    ]));
    expect(municipalities.every(({ source }) => (
      source.includes('City of Vienna Open Government Data')
      && source.includes('CC BY 3.0 AT')
      && source.includes('simplified')
    ))).toBe(true);
    expect(municipalities.every(({ geometry }) => (
      geometry.type === 'Polygon'
      && geometry.coordinates.every((ring) => ring.length >= 4 && ring.at(-1)?.join(',') === ring[0].join(','))
      && geometry.coordinates.reduce((total, ring) => total + ring.length, 0) <= 500
    ))).toBe(true);
  });

  it('represents Tyrol as its exact disconnected MultiPolygon geometry', () => {
    const tyrol = administrativeAreaById('AT-7');

    expect(tyrol).toMatchObject({
      id: 'AT-7',
      name: 'Tyrol',
      level: 'region',
      geometry: { type: 'MultiPolygon' },
    });
    expect(tyrol?.geometry.type === 'MultiPolygon' ? tyrol.geometry.coordinates : []).toHaveLength(2);
    expect(tyrol?.geometry.type === 'MultiPolygon'
      ? tyrol.geometry.coordinates.map((polygon) => polygon[0].length)
      : []).toEqual([332, 102]);
  });

  it('exposes a small sourced country catalogue with closed bounded polygons', () => {
    expect(ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'country').map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'AUT', name: 'Austria' },
      { id: 'BEL', name: 'Belgium' },
      { id: 'NLD', name: 'Netherlands' },
      { id: 'DNK', name: 'Denmark' },
      { id: 'SWE', name: 'Sweden' },
      { id: 'LTU', name: 'Lithuania' },
      { id: 'DEU', name: 'Germany' },
      { id: 'CHE', name: 'Switzerland' },
      { id: 'HUN', name: 'Hungary' },
      { id: 'CZE', name: 'Czechia' },
      { id: 'POL', name: 'Poland' },
      { id: 'SVK', name: 'Slovakia' },
    ]);

    for (const area of ADMINISTRATIVE_AREAS) {
      if (area.level === 'municipality') continue;
      expect(area.source).toContain('Natural Earth');
      const polygons = area.geometry.type === 'Polygon'
        ? [area.geometry.coordinates]
        : area.geometry.coordinates;
      for (const polygon of polygons) {
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring.at(-1)).toEqual(ring[0]);
          expect(ring.every(([longitude, latitude]) => (
            Number.isFinite(longitude)
            && Number.isFinite(latitude)
            && Math.abs(longitude) <= 180
            && Math.abs(latitude) <= 90
          ))).toBe(true);
        }
      }
    }
    expect(administrativeAreaById('missing')).toBeUndefined();
  });

  it('merges adjacent sourced Austrian regions into one polygon without internal borders', () => {
    expect(ADMINISTRATIVE_AREAS.filter(({ countryCode, level }) => countryCode === 'AUT' && level === 'region').map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 'AT-1', name: 'Burgenland' },
      { id: 'AT-2', name: 'Carinthia' },
      { id: 'AT-3', name: 'Lower Austria' },
      { id: 'AT-4', name: 'Upper Austria' },
      { id: 'AT-5', name: 'Salzburg' },
      { id: 'AT-6', name: 'Styria' },
      { id: 'AT-7', name: 'Tyrol' },
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
    if (merged?.geometry.type !== 'Polygon') throw new Error('Expected a merged Polygon.');
    expect(merged.geometry.coordinates).toHaveLength(1);
    expect(new Set(merged.geometry.coordinates[0].map(String))).toEqual(new Set(lowerAustria?.geometry.coordinates[0].map(String)));
    expect(signedRingArea(merged.geometry.coordinates[0])).toBeGreaterThan(0);
    expect(mergeAdministrativeAreas(['AT-3', 'missing'])).toBeUndefined();
  });

  it('rejects a disconnected region selection instead of treating another exterior as a hole', () => {
    expect(mergeAdministrativeAreas(['AT-1', 'AT-8'])).toBeUndefined();
  });

  it('rejects region selections that cross country catalogues', () => {
    expect(mergeAdministrativeAreas(['AT-1', 'SK-BL'])).toBeUndefined();
  });

  it('merges adjacent Vienna municipal districts without an internal border', () => {
    const merged = mergeAdministrativeAreas(['AT-9-01', 'AT-9-08']);

    expect(merged).toMatchObject({
      id: 'AT-9-01+AT-9-08',
      name: 'Innere Stadt + Josefstadt',
      level: 'municipality',
    });
    expect(merged?.geometry.type).toBe('Polygon');
    expect(merged?.geometry.coordinates).toHaveLength(1);
    expect(mergeAdministrativeAreas(['AT-9-01', 'AT-9-23'])).toBeUndefined();
    expect(mergeAdministrativeAreas(['AT-9-01', 'AT-3'])).toBeUndefined();
  });

  it('merges representative connected Vienna selections without artificial holes', () => {
    const selections = [
      ['AT-9-02', 'AT-9-20'],
      ['AT-9-16', 'AT-9-17'],
      ADMINISTRATIVE_AREAS.filter(({ level }) => level === 'municipality').map(({ id }) => id),
    ];

    for (const selection of selections) {
      const merged = mergeAdministrativeAreas(selection);
      expect(merged?.geometry.type, selection.join(' + ')).toBe('Polygon');
      expect(merged?.geometry.coordinates, selection.join(' + ')).toHaveLength(1);
    }
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

  it('adds Tyrol as a detached canonical MultiPolygon in one undoable edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createAdministrativeAreas(['AT-7']);

    const layer = store.getState().document.layers.find(({ id }) => id === 'admin-at-7');
    expect(layer?.geometry).toMatchObject({ type: 'MultiPolygon' });
    expect(layer?.geometry?.type === 'MultiPolygon' ? layer.geometry.coordinates : []).toHaveLength(2);
    expect(layer?.geometry).not.toBe(administrativeAreaById('AT-7')?.geometry);
    expect(store.getState().selectedId).toBe('admin-at-7');
    store.getState().undo();
    expect(store.getState().document.layers.some(({ id }) => id === 'admin-at-7')).toBe(false);
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

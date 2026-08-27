import { createProjectStore } from '../../src/app/store';
import {
  ADMINISTRATIVE_AREAS,
  administrativeAreaById,
  mergeAdministrativeAreaRecords,
  mergeAdministrativeAreas,
  type AdministrativeArea,
} from '../../src/domain/administrativeAreas';
import { createInitialProjectDocument } from '../../src/domain/project';
import { MAX_PROJECT_COORDINATES } from '../../src/domain/projectFile';

function generatedArea(id: string, geometry: AdministrativeArea['geometry']): AdministrativeArea {
  return { countryCode: 'TST', id, name: id, level: 'region', source: 'Generated test data', geometry };
}

describe('exceptional bundled Vienna municipalities', () => {
  it('exposes every Vienna municipal district from one bounded attributed source', () => {
    expect(ADMINISTRATIVE_AREAS).toHaveLength(23);
    expect(ADMINISTRATIVE_AREAS.every(({ level }) => level === 'municipality')).toBe(true);
    expect(ADMINISTRATIVE_AREAS.map(({ id, name }) => ({ id, name }))).toEqual(expect.arrayContaining([
      { id: 'AT-9-01', name: 'Innere Stadt' },
      { id: 'AT-9-23', name: 'Liesing' },
    ]));
    expect(ADMINISTRATIVE_AREAS.every(({ source }) => (
      source.includes('City of Vienna Open Government Data')
      && source.includes('CC BY 3.0 AT')
      && source.includes('simplified')
    ))).toBe(true);
    expect(ADMINISTRATIVE_AREAS.every(({ geometry }) => (
      geometry.type === 'Polygon'
      && geometry.coordinates.every((ring) => ring.length >= 4 && ring.at(-1)?.join(',') === ring[0].join(','))
      && geometry.coordinates.reduce((total, ring) => total + ring.length, 0) <= 500
    ))).toBe(true);
    expect(administrativeAreaById('AUT')).toBeUndefined();
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
    expect(mergeAdministrativeAreas(['AT-9-01', 'missing'])).toBeUndefined();
  });

  it('merges representative connected Vienna selections without artificial holes', () => {
    const selections = [
      ['AT-9-02', 'AT-9-20'],
      ['AT-9-16', 'AT-9-17'],
      ADMINISTRATIVE_AREAS.map(({ id }) => id),
    ];

    for (const selection of selections) {
      const merged = mergeAdministrativeAreas(selection);
      expect(merged?.geometry.type, selection.join(' + ')).toBe('Polygon');
      expect(merged?.geometry.coordinates, selection.join(' + ')).toHaveLength(1);
    }
  });

  it('adds a Vienna district as one undoable canonical shape', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().createAdministrativeArea('AT-9-01');

    const area = store.getState().document.layers.find(({ id }) => id === 'admin-at-9-01');
    expect(area).toMatchObject({
      name: 'Innere Stadt',
      type: 'shape',
      visible: true,
      locked: false,
      appearance: { kind: 'shape' },
      geometry: administrativeAreaById('AT-9-01')?.geometry,
    });
    expect(store.getState().selectedId).toBe('admin-at-9-01');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(store.getState().document.layers.some(({ id }) => id === 'admin-at-9-01')).toBe(false);
  });
});

it('merges an adjacent region into a multipart generated region without losing its island', () => {
  const multipart = generatedArea('TST-ISLANDS', {
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [2, 0], [2, 2], [0, 0]]],
      [[[10, 10], [11, 10], [11, 11], [10, 10]]],
    ],
  });
  const adjacent = generatedArea('TST-EAST', {
    type: 'Polygon',
    coordinates: [[[2, 0], [3, 0], [2, 2], [2, 0]]],
  });

  const merged = mergeAdministrativeAreaRecords([multipart, adjacent]);

  expect(merged).toMatchObject({
    id: 'TST-ISLANDS+TST-EAST',
    name: 'TST-ISLANDS + TST-EAST',
    geometry: { type: 'MultiPolygon' },
  });
  expect(merged?.geometry.type === 'MultiPolygon' ? merged.geometry.coordinates : []).toHaveLength(2);
});

it('rejects a disconnected region even when another region bridges multipart components', () => {
  const multipart = generatedArea('TST-MULTI', {
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [1, 0], [1, 1], [0, 0]]],
      [[[2, 0], [3, 0], [2, 1], [2, 0]]],
    ],
  });
  const bridge = generatedArea('TST-BRIDGE', {
    type: 'Polygon',
    coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]],
  });
  const disconnected = generatedArea('TST-DISCONNECTED', {
    type: 'Polygon',
    coordinates: [[[10, 10], [11, 10], [11, 11], [10, 10]]],
  });

  expect(mergeAdministrativeAreaRecords([multipart, bridge, disconnected])).toBeUndefined();
});

it('rejects a disconnected region beside overlapping multipart components', () => {
  const overlapping = generatedArea('TST-OVERLAPPING', {
    type: 'MultiPolygon',
    coordinates: [
      [[[0, 0], [4, 0], [0, 4], [0, 0]]],
      [[[0, 0], [4, 0], [0, 4], [0, 0]]],
    ],
  });
  const disconnected = generatedArea('TST-DISCONNECTED', {
    type: 'Polygon',
    coordinates: [[[3, 3], [3.5, 3], [3, 3.5], [3, 3]]],
  });

  expect(mergeAdministrativeAreaRecords([overlapping, disconnected])).toBeUndefined();
});

it('does not add a generated area beyond aggregate project coordinate capacity', () => {
  const document = createInitialProjectDocument();
  document.layers = [
    {
      id: 'near-capacity',
      name: 'Near capacity',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: {
        type: 'LineString',
        coordinates: Array.from(
          { length: MAX_PROJECT_COORDINATES - 3 },
          () => [16, 48] as [number, number],
        ),
      },
    },
    { id: 'basemap', name: 'Basemap', type: 'basemap', visible: true, locked: true, opacity: 100 },
  ];
  const store = createProjectStore(document);

  const createdId = store.getState().createAdministrativeArea(generatedArea('TST-1', {
    type: 'Polygon',
    coordinates: [[[10, 48], [11, 48], [11, 49], [10, 48]]],
  }));

  expect(createdId).toBeNull();
  expect(store.getState().document.layers).toHaveLength(2);
  expect(store.getState().canUndo).toBe(false);
});

import { createProjectStore } from '../../src/app/store';
import type { AdministrativeArea } from '../../src/domain/administrativeAreas';
import { createInitialProjectDocument } from '../../src/domain/project';
import { MAX_PROJECT_COORDINATES } from '../../src/domain/projectFile';

function generatedArea(id: string, geometry: AdministrativeArea['geometry']): AdministrativeArea {
  return { countryCode: 'TST', id, name: id, level: 'region', source: 'Generated test data', geometry };
}

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

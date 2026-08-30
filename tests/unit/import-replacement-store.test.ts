import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import { MAX_PROJECT_COORDINATES } from '../../src/domain/projectFile';

describe('imported layer replacement', () => {
  it('preserves layer identity and styling as one history edit', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const sourceDocument = store.getState().document;
    const original = sourceDocument.layers.find(({ id }) => id === 'route-01');
    const replacement: ContentLayer = {
      id: 'incoming-route',
      name: 'Incoming route name',
      type: 'route',
      visible: false,
      locked: false,
      opacity: 25,
      geometry: { type: 'LineString', coordinates: [[15.9, 48.1], [16.1, 48.3]] },
    };
    expect(original).toBeDefined();
    const originalCoordinates = original?.geometry?.type === 'LineString'
      ? original.geometry.coordinates
      : [];
    if (original?.appearance?.kind === 'route') {
      original.route = { kind: 'road', closed: false };
      original.appearance.color = '#112233';
      original.appearance.width = 7;
      original.appearance.marker = {
        pictogram: 'bike',
        placement: { type: 'fraction', fraction: 0.25 },
        orientToPath: true,
        reverseFacing: true,
      };
      original.appearance.segmentStyles = [
        { color: '#abcdef' },
        { width: 6 },
        { strokeStyle: 'dashed' },
      ];
      original.provenance = {
        provider: 'mapbox',
        service: 'directions-v5',
        waypoints: originalCoordinates.map(([longitude, latitude]) => (
          [longitude, latitude]
        )),
        profile: 'driving',
        distanceMeters: 1000,
        durationSeconds: 100,
      };
    }
    replacement.geometry = {
      type: 'LineString',
      coordinates: [[16.326, 48.194], [16.353, 48.205], [16.1, 48.3]],
    };
    store.getState().selectLayer('route-01');

    expect(store.getState().replaceLayerFromImport(
      'route-01', replacement, store.getState().documentEpoch, sourceDocument,
    )).toBe(true);

    const replaced = store.getState().document.layers.find(({ id }) => id === 'route-01');
    expect(replaced).toMatchObject({
      id: original!.id,
      name: original!.name,
      type: original!.type,
      visible: original!.visible,
      locked: original!.locked,
      opacity: original!.opacity,
      route: { kind: 'straight', closed: false },
      geometry: replacement.geometry,
      appearance: {
        ...original!.appearance,
        segmentStyles: [{ color: '#abcdef' }, null],
      },
    });
    expect(replaced?.provenance).toBeUndefined();
    expect(store.getState().document.layers.map(({ id }) => id))
      .toEqual(sourceDocument.layers.map(({ id }) => id));
    expect(store.getState().selectedId).toBe('route-01');
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(store.getState().document.layers.find(({ id }) => id === 'route-01')).toEqual(original);
    store.getState().redo();
    expect(store.getState().document.layers.find(({ id }) => id === 'route-01'))
      .toMatchObject({
        route: { kind: 'straight', closed: false },
        geometry: replacement.geometry,
        appearance: {
          color: '#112233',
          width: 7,
          marker: {
            pictogram: 'bike',
            placement: { type: 'fraction', fraction: 0.25 },
            orientToPath: true,
            reverseFacing: true,
          },
          segmentStyles: [{ color: '#abcdef' }, null],
        },
      });
  });

  it('rejects geometry that contradicts the canonical layer type', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const sourceDocument = store.getState().document;
    const invalidReplacement: ContentLayer = {
      id: 'incoming-route',
      name: 'Contradictory route',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: { type: 'Point', coordinates: [16, 48] },
    };

    expect(store.getState().replaceLayerFromImport(
      'route-01', invalidReplacement, store.getState().documentEpoch, sourceDocument,
    )).toBe(false);
    expect(store.getState().document).toBe(sourceDocument);
    expect(store.getState().canUndo).toBe(false);
  });

  it('rejects malformed same-type geometry at the canonical store boundary', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const sourceDocument = store.getState().document;
    const invalidReplacement: ContentLayer = {
      id: 'incoming-route',
      name: 'Invalid route',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: { type: 'LineString', coordinates: [[16, 48], [16.1, 90]] },
    };

    expect(store.getState().replaceLayerFromImport(
      'route-01', invalidReplacement, store.getState().documentEpoch, sourceDocument,
    )).toBe(false);
    expect(store.getState().document).toBe(sourceDocument);
    expect(store.getState().canUndo).toBe(false);
  });

  it('rejects a replacement that exceeds aggregate project coordinate capacity', () => {
    const document = createInitialProjectDocument();
    document.layers.push({
      id: 'capacity-route',
      name: 'Capacity route',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: {
        type: 'LineString',
        coordinates: Array.from(
          { length: MAX_PROJECT_COORDINATES - 10 },
          () => [16, 48] as [number, number],
        ),
      },
    });
    const store = createProjectStore(document);
    const sourceDocument = store.getState().document;
    const replacement: ContentLayer = {
      id: 'incoming-route',
      name: 'One position too many',
      type: 'route',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: {
        type: 'LineString',
        coordinates: [[16, 48], [16.1, 48.1], [16.2, 48.2], [16.3, 48.3], [16.4, 48.4]],
      },
    };

    expect(store.getState().replaceLayerFromImport(
      'route-01', replacement, store.getState().documentEpoch, sourceDocument,
    )).toBe(false);
    expect(store.getState().document).toBe(sourceDocument);
    expect(store.getState().canUndo).toBe(false);
  });
});

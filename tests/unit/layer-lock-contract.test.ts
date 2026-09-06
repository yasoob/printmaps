import { createProjectStore, type ProjectState } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

const cases: { id: string; move: (state: ProjectState) => void }[] = [
  { id: 'poi-cafe', move: (state) => state.setPoiCoordinates('poi-cafe', [17, 48.22]) },
  { id: 'route-01', move: (state) => state.setRouteVertex('route-01', 0, [17, 48.22]) },
  { id: 'area-center', move: (state) => state.setShapeVertex('area-center', 0, 0, [17, 48.22]) },
];

it.each(cases)('protects $id geometry and deletion without freezing its name or appearance', ({ id, move }) => {
  const store = createProjectStore(createInitialProjectDocument());
  const actions = store.getState();
  actions.toggleLayerLock(id);
  const lockedDocument = store.getState().document;
  const history = store.getState().past;

  move(actions);
  actions.deleteLayer(id);
  expect(store.getState().document).toBe(lockedDocument);
  expect(store.getState().past).toBe(history);

  actions.renameLayer(id, 'Renamed while locked');
  actions.setLayerOpacity(id, 55);
  actions.toggleLayerVisibility(id);
  expect(store.getState().document.layers.find((layer) => layer.id === id)).toMatchObject({
    name: 'Renamed while locked', opacity: 55, visible: false, locked: true,
  });

  actions.toggleLayerLock(id);
  actions.toggleLayerVisibility(id);
  const beforeMove = store.getState().document;
  move(actions);
  expect(store.getState().document).not.toBe(beforeMove);
  actions.deleteLayer(id);
  expect(store.getState().document.layers.some((layer) => layer.id === id)).toBe(false);
});

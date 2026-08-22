import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('project store map feature visibility history', () => {
  it('commits a road visibility change as one undoable style edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setMapFeatureVisibility('roads', false);

    expect(store.getState().document.style.visibility.roads).toBe(false);
    expect(store.getState().document.style.visibility.buildings).toBe(true);
    expect(store.getState().document.style.visibility.labels).toBe(true);
    store.getState().undo();
    expect(store.getState().document.style.visibility.roads).toBe(true);
    store.getState().redo();
    expect(store.getState().document.style.visibility.roads).toBe(false);
  });
});

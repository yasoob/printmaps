import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('project store global text scale history', () => {
  it('commits a valid text scale as one undoable map-style edit', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setMapTextScale(125);

    expect(store.getState().document.style.textScalePercent).toBe(125);
    store.getState().undo();
    expect(store.getState().document.style.textScalePercent).toBe(100);
    store.getState().redo();
    expect(store.getState().document.style.textScalePercent).toBe(125);
  });

  it.each([49, 201, NaN, Infinity])('rejects invalid text scale %s without changing history', (value) => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setMapTextScale(value);

    expect(store.getState().document.style.textScalePercent).toBe(100);
    expect(store.getState().canUndo).toBe(false);
  });
});

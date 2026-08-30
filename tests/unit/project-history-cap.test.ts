import { createProjectStore } from '../../src/app/store';
import { MAX_HISTORY_ENTRIES } from '../../src/app/storeDocument';
import { createInitialProjectDocument } from '../../src/domain/project';

/**
 * Each undo entry is a deep copy of the whole document, so the stack has to be
 * bounded: an uncapped session grows for as long as the tab stays open.
 */

const createDocument = createInitialProjectDocument;

describe('undo history cap', () => {
  it('caps undo history and discards the oldest entries', () => {
    const store = createProjectStore(createDocument());
    const edits = MAX_HISTORY_ENTRIES + 40;
    for (let index = 0; index < edits; index += 1) {
      store.getState().setCameraBearing((index % 179) + 1);
    }

    expect(store.getState().past).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(store.getState().canUndo).toBe(true);
  });

  it('keeps the most recent edits undoable after the cap discards older ones', () => {
    const store = createProjectStore(createDocument());
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 10; index += 1) {
      store.getState().setCameraBearing((index % 179) + 1);
    }
    const finalBearing = store.getState().document.camera.bearing;
    const previousBearing = store.getState().past.at(-1)?.camera.bearing;

    store.getState().undo();

    expect(previousBearing).not.toBe(finalBearing);
    expect(store.getState().document.camera.bearing).toBe(previousBearing);
    expect(store.getState().canRedo).toBe(true);
    store.getState().redo();
    expect(store.getState().document.camera.bearing).toBe(finalBearing);
  });

  it('exhausts capped history without reporting more undo steps than it retains', () => {
    const store = createProjectStore(createDocument());
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 25; index += 1) {
      store.getState().setCameraBearing((index % 179) + 1);
    }

    for (let index = 0; index < MAX_HISTORY_ENTRIES; index += 1) store.getState().undo();

    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().future).toHaveLength(MAX_HISTORY_ENTRIES);
  });

  it('caps history that grows back through redo', () => {
    const store = createProjectStore(createDocument());
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 5; index += 1) {
      store.getState().setCameraBearing((index % 179) + 1);
    }
    for (let index = 0; index < 30; index += 1) store.getState().undo();
    for (let index = 0; index < 30; index += 1) store.getState().redo();

    expect(store.getState().past).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(store.getState().canRedo).toBe(false);
  });
});

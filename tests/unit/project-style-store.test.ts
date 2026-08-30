import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('project store map style history', () => {
  it('preserves a custom basemap layer name when the style changes', () => {
    const document = createInitialProjectDocument();
    const basemap = document.layers.find((layer) => layer.type === 'basemap');
    if (!basemap) throw new Error('Expected fixture basemap.');
    basemap.name = 'Client reference map';
    const store = createProjectStore(document);

    store.getState().setMapStyle('night-ink');

    expect(store.getState().document.layers.find((layer) => layer.type === 'basemap')?.name)
      .toBe('Client reference map');
    expect(store.getState().document.style.preset).toBe('night-ink');
  });

  it('coalesces live Quick Tune changes and preserves explicit color overrides through undo', () => {
    const store = createProjectStore(createInitialProjectDocument());

    store.getState().setMapStyleTone('warm');
    store.getState().setMapStyleAdjustment('contrast', 60);
    store.getState().setMapStyleAdjustment('contrast', 72, 'amend');
    store.getState().setMapStyleColor('water', '#123456');

    expect(store.getState().document.style.customization).toEqual({
      tone: 'warm',
      contrast: 72,
      detail: 50,
      colors: { water: '#123456' },
    });
    store.getState().undo();
    expect(store.getState().document.style.customization.colors).toEqual({});
    store.getState().undo();
    expect(store.getState().document.style.customization.contrast).toBe(50);
    store.getState().undo();
    expect(store.getState().document.style.customization.tone).toBe('balanced');
  });

  it('resets customization when choosing a new base preset', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setMapStyleColor('label', '#abcdef');

    store.getState().setMapStyle('night-ink');

    expect(store.getState().document.style.customization).toEqual({
      tone: 'balanced',
      contrast: 50,
      detail: 50,
      colors: {},
    });
  });

  it('resets the complete style to Paper as one undoable action', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setMapStyle('night-ink');
    store.getState().setMapStyleTone('cool');

    store.getState().resetMapStyle();

    expect(store.getState().document.style.preset).toBe('paper');
    expect(store.getState().document.style.customization).toEqual({
      tone: 'balanced',
      contrast: 50,
      detail: 50,
      colors: {},
    });
    store.getState().undo();
    expect(store.getState().document.style.preset).toBe('night-ink');
    expect(store.getState().document.style.customization.tone).toBe('cool');
  });

  it('clears an abandoned redo branch even when a live gesture continues in amend mode', () => {
    const store = createProjectStore(createInitialProjectDocument());
    store.getState().setMapStyleTone('warm');
    store.getState().undo();
    expect(store.getState().canRedo).toBe(true);

    store.getState().setMapStyleAdjustment('detail', 60, 'amend');

    expect(store.getState().canRedo).toBe(false);
    store.getState().redo();
    expect(store.getState().document.style.customization).toMatchObject({
      tone: 'balanced',
      detail: 60,
    });
  });
});

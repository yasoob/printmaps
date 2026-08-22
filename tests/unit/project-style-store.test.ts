import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument } from '../../src/domain/project';

describe('project store map style history', () => {
  it('preserves a custom basemap layer name when the style changes', () => {
    const document = createInitialProjectDocument();
    const basemap = document.layers.find((layer) => layer.type === 'basemap');
    if (!basemap) throw new Error('Expected fixture basemap.');
    basemap.name = 'Client reference map';
    const store = createProjectStore(document);

    store.getState().setMapStyle('positron');

    expect(store.getState().document.layers.find((layer) => layer.type === 'basemap')?.name)
      .toBe('Client reference map');
    expect(store.getState().document.style.preset).toBe('positron');
  });
});

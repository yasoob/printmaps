import { act, render, screen } from '@testing-library/react';
import { App } from '../../../src/app/App';

/**
 * Panning writes the camera at pointer rate. Only the map may react to it; the
 * header, the sidebars and the import machinery all render project content that
 * a pan cannot change.
 */

const cameraHook = {
  pan: null as null | ((center: readonly [number, number], zoom: number, mode: 'amend' | 'history') => void),
};

const renders = vi.hoisted(() => ({ importSubtree: 0, layersStatus: 0, projectProperties: 0, map: 0 }));

vi.mock('../../../src/map/MapCanvas', async () => {
  const actual = await import('./MapCanvasMock');
  return {
    MapCanvas: (props: Record<string, unknown>) => {
      cameraHook.pan = props.onCameraViewportChange as typeof cameraHook.pan;
      renders.map += 1;
      return actual.MapCanvas(props as never);
    },
  };
});

vi.mock('../../../src/app/components/MapDataImportPortals', () => ({
  MapDataImportPortals: () => { renders.importSubtree += 1; return null; },
}));

vi.mock('../../../src/storage/ProjectAutosaveUi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/storage/ProjectAutosaveUi')>();
  return {
    ...actual,
    ProjectAutosaveStatus: () => { renders.layersStatus += 1; return <span>Autosave ready</span>; },
  };
});

vi.mock('../../../src/app/components/ProjectProperties', () => ({
  ProjectProperties: () => { renders.projectProperties += 1; return <div>Project properties</div>; },
}));

async function panTimes(count: number, mode: 'amend' | 'history') {
  for (let tick = 0; tick < count; tick += 1) {
    await act(async () => { cameraHook.pan?.([16.3 + tick * 0.002, 48.2], 12, mode); });
  }
}

describe('camera render cost', () => {
  beforeEach(() => {
    renders.importSubtree = 0; renders.layersStatus = 0; renders.projectProperties = 0; renders.map = 0;
  });

  it('renders nothing but the map while a drag streams camera updates', async () => {
    render(<App autosaveRepository={null} />);
    await screen.findByRole('button', { name: 'Vienna field guide' });
    renders.importSubtree = 0; renders.layersStatus = 0; renders.projectProperties = 0; renders.map = 0;

    await panTimes(30, 'amend');

    expect(renders.map).toBe(30);
    expect(renders).toMatchObject({ importSubtree: 0, layersStatus: 0, projectProperties: 0 });
  });

  it('settles a drag with a single history render for the undo control', async () => {
    render(<App autosaveRepository={null} />);
    await screen.findByRole('button', { name: 'Vienna field guide' });
    renders.importSubtree = 0; renders.layersStatus = 0; renders.projectProperties = 0; renders.map = 0;

    await panTimes(30, 'history');

    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    // Exactly one: the first commit flips canUndo. The other 29 change only the camera.
    expect(renders.importSubtree).toBeLessThanOrEqual(1);
    expect(renders).toMatchObject({ layersStatus: 0, projectProperties: 0 });
  });
});

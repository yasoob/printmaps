import { createRef, Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { StoreApi } from 'zustand/vanilla';
import { LayerIdentityProperties } from '../../../src/app/components/LayerIdentityProperties';
import { LayerProperties } from '../../../src/app/components/LayerProperties';
import { LayersSidebar } from '../../../src/app/components/LayersSidebar';
import { PropertiesSidebar } from '../../../src/app/components/PropertiesSidebar';
import { StudioHeader } from '../../../src/app/components/StudioHeader';
import { ProjectStoreContext } from '../../../src/app/projectStoreContext';
import { createProjectStore, type ProjectState } from '../../../src/app/store';
import { createInitialProjectDocument } from '../../../src/domain/project';
import type { ProjectAutosaveState } from '../../../src/storage/useProjectAutosave';

const renderMetrics = vi.hoisted(() => ({
  layerIcon: vi.fn(),
  projectProperties: vi.fn(),
  shapeVertices: vi.fn(),
  sidebarStatus: vi.fn(),
  switches: vi.fn(),
  title: vi.fn(),
}));

function LayerIcon() { renderMetrics.layerIcon(); return <span />; }

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return { ...actual, Layers3: LayerIcon, MapPin: LayerIcon, Route: LayerIcon, Shapes: LayerIcon };
});

vi.mock('../../../src/app/components/ProjectTitleEditor', () => ({
  ProjectTitleEditor: () => {
    renderMetrics.title();
    return <button type="button">Project title</button>;
  },
}));

vi.mock('../../../src/app/components/ProjectProperties', () => ({
  ProjectProperties: () => {
    renderMetrics.projectProperties();
    return <div>Project properties</div>;
  },
}));

vi.mock('../../../src/app/components/ShapeVertexControls', () => ({
  ShapeVertexControls: () => {
    renderMetrics.shapeVertices();
    return <div>Shape vertices</div>;
  },
}));

vi.mock('../../../src/app/components/UiControls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/app/components/UiControls')>();
  return {
    ...actual,
    Switch: ({ ariaLabel, isChecked }: { ariaLabel?: string; isChecked: boolean }) => {
      renderMetrics.switches();
      return <input aria-label={ariaLabel} checked={isChecked} readOnly type="checkbox" />;
    },
  };
});

vi.mock('../../../src/storage/ProjectAutosaveUi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/storage/ProjectAutosaveUi')>();
  return {
    ...actual,
    ProjectAutosaveStatus: () => {
      renderMetrics.sidebarStatus();
      return <span>Autosave ready</span>;
    },
  };
});

function headerProps() {
  return {
    projectTitleRef: createRef<HTMLButtonElement>(),
    exportButtonRef: createRef<HTMLButtonElement>(),
    importButtonRef: createRef<HTMLButtonElement>(),
    importInputRef: createRef<HTMLInputElement>(),
    finishImportWork: vi.fn(),
    isImportWorkActive: false,
    startImportWork: vi.fn(() => 1),
    exportDisabled: false,
    importDisabled: false,
    importOpen: false,
    replacementRequest: null,
    inert: false,
    onOpen: vi.fn(),
    onImport: vi.fn(() => true),
    onImportOpenChange: vi.fn(),
    onExport: vi.fn(),
  };
}

function panCamera(store: StoreApi<ProjectState>) {
  act(() => { store.getState().setCameraViewport([16.4, 48.2], 12); });
}

function autosaveState(): ProjectAutosaveState {
  return {
    corrupted: false,
    decisionPending: false,
    status: 'Autosave ready',
    statusKind: 'status',
    discard: vi.fn(async () => true),
  };
}

describe('editor render boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not rerender the project identity for selection or camera updates', () => {
    const store = createProjectStore(createInitialProjectDocument());
    render(
      <ProjectStoreContext value={store}>
        <StudioHeader {...headerProps()} />
      </ProjectStoreContext>,
    );

    act(() => { store.getState().selectLayer('area-center'); });
    panCamera(store);

    expect(renderMetrics.title).toHaveBeenCalledOnce();
  });

  it('rerenders only rows whose visible list state changes', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const initial = store.getState();
    const autosave = autosaveState();
    const props = {
      activePanel: null,
      autosave,
      closePanel: vi.fn(),
      layers: initial.document.layers,
      onKeyDown: vi.fn(),
      panelRef: createRef<HTMLElement>(),
      setPreviewedLayerId: vi.fn(),
    };
    store.getState().selectLayer('route-01');
    const { rerender } = render(
      <ProjectStoreContext value={store}>
        <LayersSidebar {...props} />
      </ProjectStoreContext>,
    );

    act(() => { store.getState().selectLayer('area-center'); });
    panCamera(store);
    const movedLayers = initial.document.layers.map((layer) => layer.id === 'area-center'
      ? { ...layer, geometry: structuredClone(layer.geometry) }
      : layer);
    rerender(
      <ProjectStoreContext value={store}>
        <LayersSidebar {...props} layers={movedLayers} />
      </ProjectStoreContext>,
    );

    expect(renderMetrics.layerIcon).toHaveBeenCalledTimes(initial.document.layers.length + 2);
    expect(renderMetrics.sidebarStatus).toHaveBeenCalledOnce();
  });

  it('does not rerender project controls for camera center and zoom changes', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const props = {
      activePanel: null,
      closePanel: vi.fn(),
      onDeleteSelected: vi.fn(),
      onKeyDown: vi.fn(),
      onLocate: vi.fn(),
      onReplaceLayerData: vi.fn(),
      panelRef: createRef<HTMLElement>(),
      selectedLayerId: null,
      setPreviewedLayerId: vi.fn(),
    };
    render(
      <ProjectStoreContext value={store}>
        <PropertiesSidebar {...props} />
      </ProjectStoreContext>,
    );

    panCamera(store);

    expect(renderMetrics.projectProperties).toHaveBeenCalledOnce();
  });

  it('keeps camera-rate document writes out of the header and sidebars', () => {
    const store = createProjectStore(createInitialProjectDocument());
    const commits = { header: 0, layers: 0, properties: 0 };
    const count = (key: keyof typeof commits) => () => { commits[key] += 1; };
    render(
      <ProjectStoreContext value={store}>
        <Profiler id="header" onRender={count('header')}><StudioHeader {...headerProps()} /></Profiler>
        <Profiler id="layers" onRender={count('layers')}>
          <LayersSidebar
            activePanel={null}
            autosave={autosaveState()}
            closePanel={vi.fn()}
            layers={store.getState().document.layers}
            onKeyDown={vi.fn()}
            panelRef={createRef<HTMLElement>()}
            setPreviewedLayerId={vi.fn()}
          />
        </Profiler>
        <Profiler id="properties" onRender={count('properties')}>
          <PropertiesSidebar
            activePanel={null}
            closePanel={vi.fn()}
            onDeleteSelected={vi.fn()}
            onKeyDown={vi.fn()}
            onLocate={vi.fn()}
            onReplaceLayerData={vi.fn()}
            panelRef={createRef<HTMLElement>()}
            selectedLayerId={null}
            setPreviewedLayerId={vi.fn()}
          />
        </Profiler>
      </ProjectStoreContext>,
    );
    commits.header = 0; commits.layers = 0; commits.properties = 0;

    for (let tick = 0; tick < 5; tick += 1) {
      act(() => { store.getState().setCameraViewport([16.4 + tick * 0.01, 48.2], 12, 'amend'); });
    }

    expect(store.getState().document.camera.center[0]).toBeCloseTo(16.44);
    expect(commits).toEqual({ header: 0, layers: 0, properties: 0 });
  });

  it('refreshes memoized callbacks when their behavior changes', () => {
    const initial = createProjectStore(createInitialProjectDocument()).getState();
    const layer = initial.document.layers.find(({ id }) => id === 'route-01');
    expect(layer).toBeDefined();
    if (!layer) return;
    const firstDelete = vi.fn();
    const currentDelete = vi.fn();
    const stable = {
      layer,
      nameDraft: layer.name,
      opacityDraft: String(layer.opacity),
      onDuplicate: vi.fn(),
      onNameChange: vi.fn(),
      onNameCommit: vi.fn(),
      onOpacityChange: vi.fn(),
      onOpacityCommit: vi.fn(),
      onReplace: vi.fn(),
      onToggleLock: vi.fn(),
      onToggleVisibility: vi.fn(),
    };
    const { rerender } = render(<LayerIdentityProperties {...stable} onDelete={firstDelete} />);

    rerender(<LayerIdentityProperties {...stable} onDelete={currentDelete} />);
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));

    expect(currentDelete).toHaveBeenCalledOnce();
    expect(firstDelete).not.toHaveBeenCalled();
  });

  it('updates shape vertices without rerendering identity and appearance controls', () => {
    const initial = createProjectStore(createInitialProjectDocument()).getState();
    const shape = initial.document.layers.find(({ id }) => id === 'area-center');
    expect(shape?.geometry?.type).toBe('Polygon');
    if (!shape || shape.geometry?.type !== 'Polygon') return;
    const props = {
      assets: initial.document.assets,
      layer: shape,
      onAppearanceChange: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onOpacityChange: vi.fn(),
      onPoiCoordinatesChange: vi.fn(),
      onPoiCustomMarkerChange: vi.fn(),
      onRename: vi.fn(),
      onReplace: vi.fn(),
      onRouteVertexChange: vi.fn(),
      onRouteVertexInsert: vi.fn(),
      onRouteVertexRemove: vi.fn(),
      onShapeVertexChange: vi.fn(),
      onToggleLock: vi.fn(),
      onToggleVisibility: vi.fn(),
    };
    const { rerender } = render(<LayerProperties {...props} />);
    const movedShape = { ...shape, geometry: structuredClone(shape.geometry) };
    movedShape.geometry.coordinates = movedShape.geometry.coordinates
      .map((ring) => ring.map(([longitude, latitude]) => [longitude + 0.01, latitude]));

    rerender(<LayerProperties {...props} layer={movedShape} />);

    expect(renderMetrics.switches).toHaveBeenCalledTimes(3);
    expect(renderMetrics.shapeVertices).toHaveBeenCalledTimes(2);
  });
});

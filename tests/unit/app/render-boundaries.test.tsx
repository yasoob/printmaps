import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerIdentityProperties } from '../../../src/app/components/LayerIdentityProperties';
import { LayerProperties } from '../../../src/app/components/LayerProperties';
import { LayersSidebar } from '../../../src/app/components/LayersSidebar';
import { PropertiesSidebar } from '../../../src/app/components/PropertiesSidebar';
import { StudioHeader } from '../../../src/app/components/StudioHeader';
import { createProjectStore, type ProjectState } from '../../../src/app/store';
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

function headerProps(project: ProjectState) {
  return {
    project,
    projectTitleRef: createRef<HTMLButtonElement>(),
    exportButtonRef: createRef<HTMLButtonElement>(),
    importButtonRef: createRef<HTMLButtonElement>(),
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

function cameraProject(project: ProjectState): ProjectState {
  return {
    ...project,
    canUndo: true,
    document: {
      ...project.document,
      camera: { ...project.document.camera, center: [16.4, 48.2], zoom: 12 },
    },
    past: [project.document],
  };
}

function autosaveState(): ProjectAutosaveState {
  return {
    recoveryDraft: null,
    corrupted: false,
    decisionPending: false,
    status: 'Autosave ready',
    statusKind: 'status',
    recover: vi.fn(),
    discard: vi.fn(async () => true),
  };
}

describe('editor render boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does not rerender the project identity for selection or camera updates', () => {
    const initial = createProjectStore().getState();
    const props = headerProps(initial);
    const { rerender } = render(<StudioHeader {...props} />);

    rerender(<StudioHeader {...props} project={{ ...initial, selectedId: 'area-center' }} />);
    rerender(<StudioHeader {...props} project={cameraProject(initial)} />);

    expect(renderMetrics.title).toHaveBeenCalledOnce();
  });

  it('rerenders only rows whose visible list state changes', () => {
    const initial = createProjectStore().getState();
    const autosave = autosaveState();
    const props = {
      activePanel: null,
      autosave,
      closePanel: vi.fn(),
      draggedLayerIdRef: createRef<string | null>(),
      layers: initial.document.layers,
      onKeyDown: vi.fn(),
      panelRef: createRef<HTMLElement>(),
      setPreviewedLayerId: vi.fn(),
    };
    const { rerender } = render(
      <LayersSidebar {...props} project={{ ...initial, selectedId: 'route-01' }} />,
    );

    rerender(<LayersSidebar {...props} project={{ ...initial, selectedId: 'area-center' }} />);
    rerender(
      <LayersSidebar {...props} project={{ ...cameraProject(initial), selectedId: 'area-center' }} />,
    );
    const movedLayers = initial.document.layers.map((layer) => layer.id === 'area-center'
      ? { ...layer, geometry: structuredClone(layer.geometry) }
      : layer);
    rerender(
      <LayersSidebar
        {...props}
        layers={movedLayers}
        project={{
          ...initial,
          document: { ...initial.document, layers: movedLayers },
          selectedId: 'area-center',
        }}
      />,
    );

    expect(renderMetrics.layerIcon).toHaveBeenCalledTimes(initial.document.layers.length + 2);
    expect(renderMetrics.sidebarStatus).toHaveBeenCalledTimes(2);
  });

  it('does not rerender project controls for camera center and zoom changes', () => {
    const initial = createProjectStore().getState();
    const props = {
      activePanel: null,
      closePanel: vi.fn(),
      onDeleteSelected: vi.fn(),
      onKeyDown: vi.fn(),
      onLocate: vi.fn(),
      onReplaceLayerData: vi.fn(),
      panelRef: createRef<HTMLElement>(),
      project: initial,
      selectedLayer: null,
      setPreviewedLayerId: vi.fn(),
    };
    const { rerender } = render(<PropertiesSidebar {...props} />);

    rerender(<PropertiesSidebar {...props} project={cameraProject(initial)} />);

    expect(renderMetrics.projectProperties).toHaveBeenCalledOnce();
  });

  it('refreshes memoized callbacks when their behavior changes', () => {
    const initial = createProjectStore().getState();
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
    fireEvent.click(screen.getByRole('button', { name: 'Layer menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete layer' }));

    expect(currentDelete).toHaveBeenCalledOnce();
    expect(firstDelete).not.toHaveBeenCalled();
  });

  it('updates shape vertices without rerendering identity and appearance controls', () => {
    const initial = createProjectStore().getState();
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

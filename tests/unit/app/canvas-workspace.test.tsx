import { createRef, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ContentLayer } from '../../../src/domain/project';
import { CanvasWorkspace } from '../../../src/app/components/CanvasWorkspace';
import { LayerPreviewProvider } from '../../../src/app/LayerPreviewProvider';

const preloadRouteEditor = vi.hoisted(() => vi.fn());
vi.mock('../../../src/map/useTerraDrawRoutes', () => ({ preloadRouteEditor }));

const renderedLayerArrays = vi.hoisted(() => [] as ContentLayer[][]);
const renderedContentRevisions = vi.hoisted(() => [] as Array<object | undefined>);

vi.mock('../../../src/map/MapCanvas', () => ({
  MapCanvas: ({ layers, contentRevision }: {
    layers: ContentLayer[];
    contentRevision?: object;
  }) => {
    renderedLayerArrays.push(layers);
    renderedContentRevisions.push(contentRevision);
    return <div data-testid="map-canvas" />;
  },
}));

const layers: ContentLayer[] = [
  {
    id: 'route',
    name: 'Route',
    type: 'route',
    visible: true,
    locked: false,
    opacity: 100,
    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
  },
  {
    id: 'basemap',
    name: 'Basemap',
    type: 'basemap',
    visible: true,
    locked: true,
    opacity: 100,
  },
];

function renderWorkspace(element: ReactElement) {
  return render(element, { wrapper: LayerPreviewProvider });
}

const sharedProps = {
  layers,
  assets: {},
  camera: { bearing: 0, center: [16.3725, 48.2084] as [number, number], locked: false, pitch: 0, zoom: 11.2 },
  stylePreset: 'paper' as const,
  styleCustomization: { tone: 'balanced' as const, contrast: 50, detail: 50, colors: {} },
  language: 'local' as const,
  textScalePercent: 100,
  featureVisibility: { roads: true, buildings: true, labels: true, water: true, parks: true, landuse: true, transit: true },
  documentEpoch: 0,
  importFitRequest: { request: 0 },
  page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' } as const,
  pageBoundaryVisible: true,
  activePanel: null,
  layersTriggerRef: createRef<HTMLButtonElement>(),
  propertiesTriggerRef: createRef<HTMLButtonElement>(),
  onLayerSelect: vi.fn(),
  onRouteVertexChange: vi.fn(),
  onRouteVertexInsert: vi.fn(),
  onCameraViewportChange: vi.fn(),
  onCreateAdministrativeArea: vi.fn(),
  onCreateAdministrativeAreas: vi.fn(),
  onCreateDirectionsRoute: vi.fn(),
  onReplaceDirectionsRoute: vi.fn(),
  onReplaceRouteDraft: vi.fn(),
  onCreateIsochroneArea: vi.fn(),
  onCreatePoi: vi.fn(),
  onCreatePoiBatch: vi.fn(),
  onCreateSearchPoi: vi.fn(),
  onCreateRoute: vi.fn(),
  onReplaceAuthoredRoute: vi.fn(),
  onCreateShape: vi.fn(),
  onAuthoringChange: vi.fn(),
  onBackgroundClick: vi.fn(),
  onExporterChange: vi.fn(),
  openPanel: vi.fn(),
  routeExtensionRequest: null,
};

describe('CanvasWorkspace map content', () => {
  beforeEach(() => {
    renderedLayerArrays.length = 0;
    renderedContentRevisions.length = 0;
  });

  it('reuses the geometry layer array when unrelated selection state changes', () => {
    const { rerender } = renderWorkspace(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const initialLayers = renderedLayerArrays.at(-1);

    rerender(<CanvasWorkspace {...sharedProps} selectedId="route" />);

    expect(renderedLayerArrays.at(-1)).toBe(initialLayers);
    expect(renderedContentRevisions.at(-1)).toBe(initialLayers);
  });

  it('advances the content revision after an immutable layer update', () => {
    const { rerender } = renderWorkspace(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const initialRevision = renderedContentRevisions.at(-1);
    const updatedLayers = layers.map((layer) => (
      layer.id === 'route' ? { ...layer, opacity: 50 } : layer
    ));

    rerender(<CanvasWorkspace {...sharedProps} layers={updatedLayers} selectedId={null} />);

    expect(renderedContentRevisions.at(-1)).not.toBe(initialRevision);
    expect(renderedContentRevisions.at(-1)).toBe(renderedLayerArrays.at(-1));
  });
});

describe('route editor warm-up', () => {
  beforeEach(() => preloadRouteEditor.mockClear());

  it('fetches the route editor when the route tool is hovered, before it is activated', () => {
    renderWorkspace(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const routeTool = screen.getByRole('button', { name: 'Route (R)' });

    expect(preloadRouteEditor).not.toHaveBeenCalled();
    fireEvent.pointerEnter(routeTool);

    expect(preloadRouteEditor).toHaveBeenCalled();
  });

  it('fetches the route editor when the route tool receives keyboard focus', () => {
    renderWorkspace(<CanvasWorkspace {...sharedProps} selectedId={null} />);

    fireEvent.focus(screen.getByRole('button', { name: 'Route (R)' }));

    expect(preloadRouteEditor).toHaveBeenCalled();
  });

  it('leaves other tools alone', () => {
    renderWorkspace(<CanvasWorkspace {...sharedProps} selectedId={null} />);

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Area (S)' }));

    expect(preloadRouteEditor).not.toHaveBeenCalled();
  });
});

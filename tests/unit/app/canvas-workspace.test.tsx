import { createRef } from 'react';
import { render } from '@testing-library/react';
import type { ContentLayer } from '../../../src/domain/project';
import { CanvasWorkspace } from '../../../src/app/components/CanvasWorkspace';

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

const sharedProps = {
  layers,
  camera: { bearing: 0, pitch: 0 },
  stylePreset: 'liberty' as const,
  previewedId: null,
  documentEpoch: 0,
  page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' } as const,
  activePanel: null,
  layersTriggerRef: createRef<HTMLButtonElement>(),
  propertiesTriggerRef: createRef<HTMLButtonElement>(),
  onLayerSelect: vi.fn(),
  onCreatePoi: vi.fn(),
  onCreateRoute: vi.fn(),
  onCreateShape: vi.fn(),
  onAuthoringChange: vi.fn(),
  onBackgroundClick: vi.fn(),
  onExporterChange: vi.fn(),
  openPanel: vi.fn(),
};

describe('CanvasWorkspace map content', () => {
  beforeEach(() => {
    renderedLayerArrays.length = 0;
    renderedContentRevisions.length = 0;
  });

  it('reuses the geometry layer array when unrelated selection state changes', () => {
    const { rerender } = render(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const initialLayers = renderedLayerArrays.at(-1);

    rerender(<CanvasWorkspace {...sharedProps} selectedId="route" />);

    expect(renderedLayerArrays.at(-1)).toBe(initialLayers);
    expect(renderedContentRevisions.at(-1)).toBe(initialLayers);
  });

  it('advances the content revision after an immutable layer update', () => {
    const { rerender } = render(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const initialRevision = renderedContentRevisions.at(-1);
    const updatedLayers = layers.map((layer) => (
      layer.id === 'route' ? { ...layer, opacity: 50 } : layer
    ));

    rerender(<CanvasWorkspace {...sharedProps} layers={updatedLayers} selectedId={null} />);

    expect(renderedContentRevisions.at(-1)).not.toBe(initialRevision);
    expect(renderedContentRevisions.at(-1)).toBe(renderedLayerArrays.at(-1));
  });
});

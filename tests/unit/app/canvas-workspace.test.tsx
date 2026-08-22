import { createRef } from 'react';
import { render } from '@testing-library/react';
import type { ContentLayer } from '../../../src/domain/project';
import { CanvasWorkspace } from '../../../src/app/components/CanvasWorkspace';

const renderedLayerArrays = vi.hoisted(() => [] as ContentLayer[][]);

vi.mock('../../../src/map/MapCanvas', () => ({
  MapCanvas: ({ layers }: { layers: ContentLayer[] }) => {
    renderedLayerArrays.push(layers);
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
  previewedId: null,
  page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' } as const,
  activePanel: null,
  layersTriggerRef: createRef<HTMLButtonElement>(),
  propertiesTriggerRef: createRef<HTMLButtonElement>(),
  onLayerSelect: vi.fn(),
  onBackgroundClick: vi.fn(),
  onExporterChange: vi.fn(),
  openPanel: vi.fn(),
};

describe('CanvasWorkspace map content', () => {
  beforeEach(() => {
    renderedLayerArrays.length = 0;
  });

  it('reuses the geometry layer array when unrelated selection state changes', () => {
    const { rerender } = render(<CanvasWorkspace {...sharedProps} selectedId={null} />);
    const initialLayers = renderedLayerArrays.at(-1);

    rerender(<CanvasWorkspace {...sharedProps} selectedId="route" />);

    expect(renderedLayerArrays.at(-1)).toBe(initialLayers);
  });
});

import { act, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { MapCanvas } from '../../src/map/MapCanvas';
import type { MapFrameProjection } from '../../src/map/MapFrameProjection';
import { StudioMapCanvas, type StudioMapCanvasProps } from '../../src/app/studio/StudioMapCanvas';
import { createInitialProjectDocument } from '../../src/domain/project';

const { mapRender } = vi.hoisted(() => ({
  mapRender: vi.fn<(props: ComponentProps<typeof MapCanvas>) => void>(),
}));
vi.mock('../../src/map/MapCanvas', () => ({
  MapCanvas: (props: ComponentProps<typeof MapCanvas>) => {
    mapRender(props);
    return <div data-testid="native-map" />;
  },
}));

function propsForProject(): StudioMapCanvasProps {
  const document = createInitialProjectDocument();
  return {
    camera: document.camera, page: document.page, layers: document.layers, assets: document.assets,
    selectedId: null, previewedId: null, onLayerSelect: vi.fn(), onBackgroundClick: vi.fn(),
    composition: document,
  };
}

beforeEach(() => mapRender.mockClear());

it('does not attach a projection listener when all composition features are off', () => {
  render(<StudioMapCanvas {...propsForProject()} />);
  expect(mapRender.mock.calls.at(-1)?.[0].onFrameProjectionChange).toBeUndefined();
  expect(screen.queryByLabelText('Poster artwork')).not.toBeInTheDocument();
});

it('updates only the derived artwork on live projection events without rerendering the map', () => {
  const props = propsForProject();
  if (!props.composition) throw new Error('Fixture composition is missing.');
  props.composition.studio.poster.enabled = true;
  props.composition.studio.poster.title = {
    ...props.composition.studio.poster.title, enabled: true, text: 'Our adventure',
  };
  render(<StudioMapCanvas {...props} />);
  const notify = mapRender.mock.calls.at(-1)?.[0].onFrameProjectionChange;
  expect(notify).toBeTypeOf('function');
  const renderCount = mapRender.mock.calls.length;
  const projection: MapFrameProjection = {
    projectToFrame: () => ({ x: 0.5, y: 0.5 }),
    frame: { x: 40, y: 20, width: 400, height: 300 },
    referenceLongitude: 16, bearing: 15, pitch: 0,
    camera: { center: [16, 48], zoom: 11, bearing: 15, pitch: 0 },
  };
  act(() => notify?.(projection));
  expect(screen.getByText('Our adventure')).toBeInTheDocument();
  expect(screen.getByLabelText('Poster artwork')).toHaveStyle({ left: '40px', top: '20px' });
  expect(mapRender.mock.calls).toHaveLength(renderCount);
  act(() => notify?.(null));
  expect(screen.queryByLabelText('Poster artwork')).not.toBeInTheDocument();
  expect(mapRender.mock.calls).toHaveLength(renderCount);
});

import { act, cleanup, render, screen } from '@testing-library/react';
import { MapCanvas } from '../../src/map/MapCanvas';
import type { MapFrameProjection } from '../../src/map/MapFrameProjection';
import { SharedMapPreview } from '../../src/sharing/SharedMapPreview';
import { createInitialProjectDocument } from '../../src/domain/project';
import { studioProject } from '../fixtures/studio';

vi.mock('../../src/map/MapCanvas', () => ({
  MapCanvas: vi.fn(() => <div data-testid="map-canvas" />),
}));

beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

function projection(): MapFrameProjection {
  return {
    frame: { x: 20, y: 30, width: 600, height: 400 },
    referenceLongitude: 16.3725, bearing: 0, pitch: 0,
    camera: { center: [16.3725, 48.2084], zoom: 11.2, bearing: 0, pitch: 0 },
    projectToFrame: ([longitude, latitude]) => ({
      x: 0.5 + (longitude - 16.3725) / 0.2,
      y: 0.5 - (latitude - 48.2084) / 0.2,
    }),
  };
}

it('plain maps do not subscribe to composition updates and no mutation callbacks reach the renderer', () => {
  const document = createInitialProjectDocument();
  render(<SharedMapPreview document={document} canNavigate={false} />);
  const props = vi.mocked(MapCanvas).mock.calls.at(-1)![0];
  expect(props.onFrameProjectionChange).toBeUndefined();
  expect(props.terrain).toBe(document.studio.terrain);
  expect(props.camera?.locked).toBe(true);
  expect(props.selectedId).toBeNull();
  for (const key of [
    'onCameraViewportChange', 'onMapClick', 'onPoiCoordinatesChange', 'onRouteGeometryChange',
    'onRouteVertexChange', 'onRouteVertexInsert', 'routeAuthoring', 'routeDraftEditing', 'onShapeGeometryChange',
  ]) expect(Reflect.get(props, key)).toBeUndefined();
});

it('renders the canonical poster, photo stops, photo strip and decorations without pan-rate map rerenders', () => {
  const document = studioProject();
  document.studio.terrain.enabled = false;
  document.studio.poster.title.text = 'Shared <script>not executable</script>';
  const original = JSON.stringify(document);
  render(<SharedMapPreview document={document} canNavigate />);
  expect(screen.getByRole('status')).toHaveTextContent('Preparing shared artwork');
  const publish = vi.mocked(MapCanvas).mock.calls.at(-1)![0].onFrameProjectionChange!;
  act(() => { publish(projection()); });
  const artwork = screen.getByLabelText('Poster artwork');
  expect(artwork).toHaveTextContent(document.studio.poster.title.text);
  expect(artwork).toHaveTextContent('A photo');
  expect(artwork.querySelectorAll('image')).toHaveLength(2);
  expect(artwork.querySelector('script')).toBeNull();
  expect(artwork).toHaveStyle({ left: '20px', top: '30px', width: '600px', height: '400px' });
  const mapRenderCount = vi.mocked(MapCanvas).mock.calls.length;
  act(() => { publish({ ...projection(), frame: { x: 10, y: 15, width: 300, height: 200 } }); });
  expect(artwork).toHaveStyle({ left: '10px', width: '300px' });
  expect(vi.mocked(MapCanvas)).toHaveBeenCalledTimes(mapRenderCount);
  expect(JSON.stringify(document)).toBe(original);
});

it('passes terrain without rewriting it and surfaces incompatible composition rather than silently omitting it', () => {
  const document = studioProject();
  render(<SharedMapPreview document={document} canNavigate />);
  const props = vi.mocked(MapCanvas).mock.calls.at(-1)![0];
  expect(props.terrain).toBe(document.studio.terrain);
  act(() => { props.onFrameProjectionChange!(projection()); });
  expect(screen.getByRole('alert')).toHaveTextContent('scale bar requires a flat, non-terrain map');
  expect(document.studio.terrain.enabled).toBe(true);
});

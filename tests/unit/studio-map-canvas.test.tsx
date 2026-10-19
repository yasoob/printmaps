import { act, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { MapCanvas } from '../../src/map/MapCanvas';
import type { MapFrameProjection } from '../../src/map/MapFrameProjection';
import { StudioMapCanvas, type StudioMapCanvasProps } from '../../src/app/studio/StudioMapCanvas';
import { createInitialProjectDocument } from '../../src/domain/project';
import { StudioPosterPreview } from '../../src/app/studio/StudioPosterPreview';
import { studioProject } from '../fixtures/studio';

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

const projectPhotoToFrame = (coordinate: readonly [number, number]) => ({
  x: (coordinate[0] - 16.2) / 0.4, y: (48.3 - coordinate[1]) / 0.2,
});

it('does not attach a projection listener when all composition features are off', () => {
  render(<StudioMapCanvas {...propsForProject()} />);
  expect(mapRender.mock.calls.at(-1)?.[0].onFrameProjectionChange).toBeUndefined();
  expect(screen.queryByLabelText('Poster artwork')).not.toBeInTheDocument();
});

it('puts the export credit strip in the print frame without poster artwork and keeps it stable across camera moves', () => {
  const props = propsForProject();
  const { rerender } = render(<StudioMapCanvas {...props} />);
  const credit = mapRender.mock.calls.at(-1)?.[0].printFrameContent;
  expect(credit).toBeTruthy();
  const { container } = render(<>{credit}</>);
  expect(container.querySelector('rect')?.getAttribute('fill')).toBe('#ffffff');
  expect(container.querySelector('text')?.textContent).toBe('© OpenStreetMap contributors (openstreetmap.org/copyright) · OpenMapTiles · OpenFreeMap');
  rerender(<StudioMapCanvas {...props} camera={{ ...props.camera!, zoom: props.camera!.zoom + 1 }} />);
  expect(mapRender.mock.calls.at(-1)?.[0].printFrameContent).toBe(credit);
});

it('paints the credit with the poster artwork, and not in the print frame, when a poster is composed', () => {
  const props = propsForProject();
  props.composition!.studio.poster.enabled = true;
  render(<StudioMapCanvas {...props} />);
  expect(mapRender.mock.calls.at(-1)?.[0].printFrameContent).toBeUndefined();
  act(() => mapRender.mock.calls.at(-1)?.[0].onFrameProjectionChange?.({
    projectToFrame: () => ({ x: 0.5, y: 0.5 }), frame: { x: 0, y: 0, width: 400, height: 300 },
    referenceLongitude: 16, bearing: 0, pitch: 0, camera: { center: [16, 48], zoom: 11, bearing: 0, pitch: 0 },
  }));
  expect(screen.getByLabelText('Poster artwork')).toHaveTextContent('openstreetmap.org/copyright');
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

it('retains photo nodes across caption and earlier primitive insertions, with safe unique clip IDs', () => {
  const document = studioProject();
  document.studio.terrain.enabled = false;
  document.studio.decorations.scale.enabled = false;
  document.studio.decorations.qr.enabled = false;
  document.studio.photos.stops[0].id = 'photo with spaces & # punctuation';
  const projectToFrame = projectPhotoToFrame;
  const { container, rerender } = render(<StudioPosterPreview document={document} projectToFrame={projectToFrame} />);
  const images = [...container.querySelectorAll('image')];
  expect(images).toHaveLength(2);
  const next = structuredClone(document);
  next.studio.photos.stops[0].caption = 'Changed caption';
  next.studio.decorations.grid.enabled = false;
  next.studio.poster.title.enabled = false;
  rerender(<StudioPosterPreview document={next} projectToFrame={projectToFrame} />);
  expect([...container.querySelectorAll('image')]).toEqual(images);
  expect(screen.getByText('Changed caption')).toBeVisible();
  for (const image of images) {
    const clip = image.getAttribute('clip-path')!.slice(5, -1);
    expect(clip).not.toMatch(/\s|&|#/);
    expect([...container.querySelectorAll('[id]')].some((node) => node.id === clip)).toBe(true);
  }
});

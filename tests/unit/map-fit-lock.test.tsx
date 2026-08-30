import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { ContentLayer } from '../../src/domain/project';
import { useMapFitRequests } from '../../src/map/useMapFitRequests';

const route: ContentLayer = {
  id: 'route',
  name: 'Route',
  type: 'route',
  visible: true,
  locked: false,
  opacity: 100,
  geometry: { type: 'LineString', coordinates: [[16.3, 48.2], [16.4, 48.3]] },
};
const fitBounds = vi.fn();
const map = { fitBounds };

type HarnessProps = {
  isLocked: boolean;
  layers?: ContentLayer[];
  request: number;
};

function Harness({ isLocked, layers = [route], request }: HarnessProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapReference = useRef(map);
  const cameraViewportChangeMode = useRef<'amend' | 'history'>('history');
  useMapFitRequests({
    camera: { bearing: 0, center: [16.3725, 48.2084], locked: isLocked, pitch: 0, zoom: 11.2 },
    cameraViewportChangeMode,
    container,
    fitImportBounds: [[16.2, 48.1], [16.5, 48.4]],
    fitImportRequest: request,
    fitLayerId: 'route',
    fitLayerRequest: request,
    fitRequest: request,
    layers,
    map: mapReference as never,
  });
  return <div><div ref={container} data-testid="map-root" /><div className="print-frame" /></div>;
}

describe('map fit requests while the map area is locked', () => {
  it('consumes every fit path without moving and does not replay them after unlock', async () => {
    fitBounds.mockClear();
    const view = render(<Harness isLocked request={1} />);

    expect(fitBounds).not.toHaveBeenCalled();
    view.rerender(<Harness isLocked={false} request={1} />);
    expect(fitBounds).not.toHaveBeenCalled();

    view.rerender(<Harness isLocked={false} request={2} />);
    await waitFor(() => expect(fitBounds).toHaveBeenCalledTimes(3));
  });

  it('fits only visible geometry inside the print frame', async () => {
    fitBounds.mockClear();
    const hiddenRoute: ContentLayer = {
      ...route,
      id: 'hidden-route',
      visible: false,
      geometry: { type: 'LineString', coordinates: [[-120, 30], [-110, 40]] },
    };
    const layers = [route, hiddenRoute];
    const view = render(<Harness isLocked={false} layers={layers} request={0} />);
    vi.spyOn(view.getByTestId('map-root'), 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 1000, 800));
    vi.spyOn(view.container.querySelector<HTMLElement>('.print-frame')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(250, 150, 700, 500));

    view.rerender(<Harness isLocked={false} layers={layers} request={1} />);

    await waitFor(() => expect(fitBounds).toHaveBeenNthCalledWith(1, [[16.3, 48.2], [16.4, 48.3]], {
      bearing: 0,
      duration: 0,
      maxZoom: 16,
      padding: { top: 132, right: 182, bottom: 232, left: 182 },
      pitch: 0,
    }));
  });
});

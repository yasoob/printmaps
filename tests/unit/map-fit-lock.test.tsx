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
  request: number;
};

function Harness({ isLocked, request }: HarnessProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapReference = useRef(map);
  useMapFitRequests({
    camera: { bearing: 0, locked: isLocked, pitch: 0 },
    container,
    fitImportBounds: [[16.2, 48.1], [16.5, 48.4]],
    fitImportRequest: request,
    fitLayerId: 'route',
    fitLayerRequest: request,
    fitRequest: request,
    layers: [route],
    map: mapReference as never,
  });
  return <div ref={container} />;
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
});

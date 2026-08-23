import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GeolocationControl } from '../../../src/app/components/GeolocationControl';

function installGeolocationMock() {
  let success: PositionCallback | undefined;
  let failure: PositionErrorCallback | undefined;
  const getCurrentPosition = vi.fn((nextSuccess: PositionCallback, nextFailure: PositionErrorCallback) => {
    success = nextSuccess;
    failure = nextFailure;
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
  return {
    fail: (code: number) => failure?.({
      code,
      message: 'fixture error',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    }),
    getCurrentPosition,
    succeed: (longitude: number, latitude: number) => success?.({
      coords: { longitude, latitude },
    } as GeolocationPosition),
  };
}

describe('browser geolocation control', () => {
  it('reports progress and sends a valid browser position to the map', async () => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    let confirmApplied: (() => void) | undefined;
    const onLocate = vi.fn((_coordinate: [number, number], onApplied: () => void) => {
      confirmApplied = onApplied;
    });
    render(<GeolocationControl locked={false} onLocate={onLocate} />);
    const locate = screen.getByRole('button', { name: 'Use my location' });

    await user.click(locate);

    expect(locate).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Finding your location');
    act(() => geolocation.succeed(16.3725, 48.2084));

    expect(onLocate).toHaveBeenCalledWith([16.3725, 48.2084], expect.any(Function));
    expect(locate).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Location found. Waiting for the map renderer');
    act(() => confirmApplied?.());
    expect(screen.getByRole('status')).toHaveTextContent('Map centered on your current location');
    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
  });

  it('explains denied permission and allows a successful retry', async () => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    const onLocate = vi.fn((_coordinate: [number, number], onApplied: () => void) => onApplied());
    render(<GeolocationControl locked={false} onLocate={onLocate} />);
    const locate = screen.getByRole('button', { name: 'Use my location' });

    await user.click(locate);
    act(() => geolocation.fail(1));

    expect(screen.getByRole('alert')).toHaveTextContent('Location permission was denied');
    expect(screen.getByRole('alert')).toHaveTextContent('try again');
    expect(locate).toBeEnabled();

    await user.click(locate);
    act(() => geolocation.succeed(-73.9857, 40.7484));

    expect(onLocate).toHaveBeenCalledWith([-73.9857, 40.7484], expect.any(Function));
    expect(screen.getByRole('status')).toHaveTextContent('Map centered');
  });

  it.each([
    [2, 'current location is unavailable'],
    [3, 'Finding your location timed out'],
  ])('explains browser location error %s and keeps retry available', async (code, message) => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    render(<GeolocationControl locked={false} onLocate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    act(() => geolocation.fail(code));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Use my location' })).toBeEnabled();
  });

  it('reports unavailable browser geolocation without starting a request', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    const user = userEvent.setup();
    render(<GeolocationControl locked={false} onLocate={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Location is unavailable in this browser');
  });

  it.each([
    [181, 48.2084],
    [16.3725, 86],
  ])('rejects invalid browser coordinate %s,%s without moving the map', async (longitude, latitude) => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    const onLocate = vi.fn();
    render(<GeolocationControl locked={false} onLocate={onLocate} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    act(() => geolocation.succeed(longitude, latitude));

    expect(screen.getByRole('alert')).toHaveTextContent('invalid location');
    expect(onLocate).not.toHaveBeenCalled();
  });

  it('ignores a pending location after the map becomes locked', async () => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    const onLocate = vi.fn();
    const view = render(<GeolocationControl locked={false} onLocate={onLocate} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    view.rerender(<GeolocationControl locked onLocate={onLocate} />);
    act(() => geolocation.succeed(16.3725, 48.2084));

    expect(onLocate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Unlock the map area');
  });

  it('ignores a pending location after the project document changes', async () => {
    const geolocation = installGeolocationMock();
    const user = userEvent.setup();
    const onLocate = vi.fn();
    const view = render(<GeolocationControl locked={false} requestScope={1} onLocate={onLocate} />);

    await user.click(screen.getByRole('button', { name: 'Use my location' }));
    view.rerender(<GeolocationControl locked={false} requestScope={2} onLocate={onLocate} />);
    act(() => geolocation.succeed(16.3725, 48.2084));

    expect(onLocate).not.toHaveBeenCalled();
  });
});

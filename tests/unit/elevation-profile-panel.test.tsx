import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ElevationProfilePanel } from '../../src/app/components/ElevationProfilePanel';
import type { ElevationProfile } from '../../src/elevation/profile';

const profile: ElevationProfile = {
  samples: [
    { coordinate: [16, 48], distanceMeters: 0, elevationMeters: 120 },
    { coordinate: [16.1, 48.1], distanceMeters: 20_000, elevationMeters: 260 },
  ],
  totalDistanceMeters: 20_000,
  minimumElevationMeters: 120,
  maximumElevationMeters: 260,
  totalAscentMeters: 140,
  totalDescentMeters: 0,
  sourceLabel: 'Copernicus DEM GLO-90 via Open-Meteo',
};

describe('ElevationProfilePanel', () => {
  it('generates an inspectable attributed profile for the selected route', async () => {
    const user = userEvent.setup();
    const loadProfile = vi.fn(async () => profile);
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={loadProfile}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    expect(await screen.findByRole('img', { name: 'Alpine Route elevation profile' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Elevation summary' })).toBeInTheDocument();
    expect(screen.getByText('20.0 km')).toBeInTheDocument();
    expect(screen.getByText('120–260 m')).toBeInTheDocument();
    expect(screen.getByText('↑ 140 m')).toBeInTheDocument();
    expect(screen.getByText('Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.')).toBeInTheDocument();
    expect(screen.getByText('Copernicus DEM GLO-90 via Open-Meteo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download elevation PNG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download elevation PDF' })).toBeEnabled();
  });

  it('lets the user cancel a pending terrain request and retry', async () => {
    const user = userEvent.setup();
    let requestSignal: AbortSignal | undefined;
    const loadProfile = vi.fn((_: readonly (readonly [number, number])[], options: { signal: AbortSignal }) => {
      requestSignal = options.signal;
      return new Promise<ElevationProfile>(() => {});
    });
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={loadProfile}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    await user.click(screen.getByRole('button', { name: 'Cancel elevation profile request' }));

    expect(requestSignal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Generate elevation profile' })).toBeEnabled();
  });
});

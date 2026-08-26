import { fireEvent, render, screen } from '@testing-library/react';
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
    expect(screen.getByLabelText('Total ascent 140 m')).toHaveTextContent('140 m');
    expect(screen.getByText('Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.')).toBeInTheDocument();
    expect(screen.getByText('Copernicus DEM GLO-90 via Open-Meteo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download elevation PNG' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Download elevation PDF' })).toBeEnabled();
  });

  it('switches the profile summary between metric and imperial units', async () => {
    const user = userEvent.setup();
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    await user.click(screen.getByRole('radio', { name: 'Imperial' }));

    expect(screen.getByText('12.4 mi')).toBeInTheDocument();
    expect(screen.getByText('394–853 ft')).toBeInTheDocument();
    expect(screen.getByLabelText('Total ascent 459 ft')).toHaveTextContent('459 ft');
    expect(screen.getByRole('radio', { name: 'Metric' })).not.toBeChecked();
  });

  it('previews route-coherent curve, fill, and grid settings', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        routeColor="#d9363e"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const color = screen.getByLabelText('Profile curve color');
    expect(color).toHaveValue('#d9363e');
    fireEvent.input(color, { target: { value: '#2457a6' } });
    await user.click(screen.getByRole('checkbox', { name: 'Fill below curve' }));
    await user.click(screen.getByRole('checkbox', { name: 'Horizontal grid' }));

    expect(container.querySelector('.elevation-line')).toHaveStyle({ stroke: '#2457a6' });
    expect(container.querySelector('.elevation-area')).not.toBeInTheDocument();
    expect(container.querySelector('.elevation-grid-horizontal')).not.toBeInTheDocument();
    expect(container.querySelector('.elevation-grid-vertical')).toBeInTheDocument();
  });

  it('lets the user hide the profile curve without hiding the fill', async () => {
    const user = userEvent.setup(); const { container } = render(<ElevationProfilePanel coordinates={[[16, 48], [16.1, 48.1]]} routeName="Alpine Route" loadProfile={vi.fn(async () => profile)} />);
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    await user.click(screen.getByRole('checkbox', { name: 'Curve stroke' }));
    expect(container.querySelector('.elevation-line')).not.toBeInTheDocument();
    expect(container.querySelector('.elevation-area')).toBeInTheDocument();
    expect(screen.getByLabelText('Profile curve color')).toBeDisabled();
  });

  it('previews a custom profile fill color', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const fillColor = screen.getByLabelText('Profile fill color');
    fireEvent.input(fillColor, { target: { value: '#f2b84b' } });

    expect(container.querySelector('.elevation-area')).toHaveStyle({ fill: '#f2b84b' });
  });

  it('previews an optional two-color profile gradient', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    await user.click(screen.getByRole('checkbox', { name: 'Gradient fill' }));
    fireEvent.input(screen.getByLabelText('Profile gradient color'), { target: { value: '#f2b84b' } });

    expect(container.querySelector('.elevation-area')).toHaveStyle({ fill: 'url(#elevation-fill-gradient)' });
    expect(container.querySelector('.elevation-area')).not.toHaveAttribute('fill');
    expect(container.querySelector(':scope .elevation-fill-gradient stop:last-child')).toHaveAttribute('stop-color', '#f2b84b');
  });

  it('previews bounded minimum and maximum elevation markers', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const markerColor = screen.getByLabelText('Elevation marker color');
    fireEvent.input(markerColor, { target: { value: '#7c3aed' } });

    const markers = container.querySelector('.elevation-markers');
    expect(markers?.querySelectorAll(':scope circle')).toHaveLength(2);
    expect(markers?.querySelector(':scope circle')).toHaveStyle({ fill: '#7c3aed' });

    await user.click(screen.getByRole('checkbox', { name: 'Elevation markers' }));
    expect(container.querySelector('.elevation-markers')).not.toBeInTheDocument();
  });

  it('applies only font sizes from the documented 20 to 70 range', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const fontSize = screen.getByRole('spinbutton', { name: 'Profile font size' });
    await user.clear(fontSize);
    await user.type(fontSize, '56');
    expect(fontSize).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('.elevation-marker-label')).toHaveStyle({ fontSize: '56px' });
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();

    await user.clear(fontSize);
    await user.type(fontSize, '71');
    expect(fontSize).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('.elevation-marker-label')).toHaveStyle({ fontSize: '56px' });
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeDisabled();
  });

  it('applies only print widths from the documented 50 to 300 mm range', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const printWidth = screen.getByRole('spinbutton', { name: 'Profile print width' });
    await user.clear(printWidth);
    await user.type(printWidth, '220');
    expect(printWidth).not.toHaveAttribute('aria-invalid');
    expect(container.querySelector('.elevation-chart')).toHaveAttribute('data-print-width-mm', '220');
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();

    await user.clear(printWidth);
    await user.type(printWidth, '49');
    expect(printWidth).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('.elevation-chart')).toHaveAttribute('data-print-width-mm', '220');
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeDisabled();
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

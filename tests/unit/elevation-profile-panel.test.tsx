import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { ElevationProfilePanel as ProfilePanel } from '../../src/app/components/ElevationProfilePanel';
import { ElevationProfileSession } from '../../src/app/elevation/ElevationProfileSession';
import type { ProfileLoader, ProfilePosition } from '../../src/app/elevation/profileSessionTypes';
import type { ElevationProfile } from '../../src/elevation/profile';
import { serializeElevationProfileSvg } from '../../src/export/elevationProfile';

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

function ElevationProfilePanel({ coordinates, routeName, routeColor = '#0d79c7', loadProfile }: {
  coordinates: readonly ProfilePosition[]; routeName: string; routeColor?: string; loadProfile: ProfileLoader;
}) {
  const [model] = useState(() => new ElevationProfileSession({ coordinates, name: routeName, color: routeColor, kind: 'straight' }, { loadProfile }));
  useEffect(() => () => model.dispose(), [model]);
  return <ProfilePanel model={model} />;
}

describe('ElevationProfilePanel travel estimates', () => {
  it('shows transparent walking and cycling time estimates for the route distance', async () => {
    const user = userEvent.setup();
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const estimates = screen.getByRole('group', { name: 'Travel time estimates' });
    expect(estimates).toHaveTextContent('Walking · 5 km/h4 h');
    expect(estimates).toHaveTextContent('Cycling · 15 km/h1 h 20 min');
    expect(estimates).toHaveTextContent('Distance-only estimates; terrain, stops, and conditions are not included.');
  });

  it('never reports zero minutes for a positive route distance', async () => {
    const user = userEvent.setup();
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.001, 48.001]]}
        routeName="Short Route"
        loadProfile={vi.fn(async () => ({
          ...profile,
          samples: [profile.samples[0], { ...profile.samples[1], distanceMeters: 100 }],
          totalDistanceMeters: 100,
        }))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const estimates = screen.getByRole('group', { name: 'Travel time estimates' });
    expect(estimates).toHaveTextContent('Cycling · 15 km/h<1 min');
    expect(estimates).not.toHaveTextContent('0 min');
  });
});

describe('ElevationProfilePanel local route source', () => {
  it('announces profile route file reading and completion', async () => {
    const user = userEvent.setup();
    let finishReading!: (text: string) => void;
    const fileText = new Promise<string>((resolve) => { finishReading = resolve; });
    const gpxText = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test"><rte><name>Uploaded route</name><rtept lat="48.2" lon="16.3"/><rtept lat="48.4" lon="16.5"/></rte></gpx>`;
    const gpx = new File([gpxText], 'uploaded.gpx', { type: 'application/gpx+xml' });
    Object.defineProperty(gpx, 'text', { value: () => fileText });
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Selected route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );

    await user.upload(screen.getByLabelText('Profile route file'), gpx);
    const readingStatus = screen.getByRole('status');
    expect(readingStatus).toHaveTextContent('Reading profile route file…');
    expect(readingStatus.closest('[aria-busy="true"]')).toBeNull();

    finishReading(gpxText);
    expect(await screen.findByRole('status')).toHaveTextContent('Profile route loaded: Uploaded route.');
  });

  it('switches the profile source between the selected route and one local route file', async () => {
    const user = userEvent.setup();
    const loadProfile = vi.fn(async () => profile);
    render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Selected route"
        loadProfile={loadProfile}
      />,
    );
    const gpx = new File([`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="test"><rte><name>Uploaded route</name><rtept lat="48.2" lon="16.3"/><rtept lat="48.4" lon="16.5"/></rte></gpx>`], 'uploaded.gpx', { type: 'application/gpx+xml' });

    await user.upload(screen.getByLabelText('Profile route file'), gpx);
    expect(await screen.findByText('Uploaded route · uploaded.gpx')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    expect(loadProfile).toHaveBeenLastCalledWith([[16.3, 48.2], [16.5, 48.4]], expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(await screen.findByRole('img', { name: 'Uploaded route elevation profile' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Use selected map route' }));
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    expect(loadProfile).toHaveBeenLastCalledWith([[16, 48], [16.1, 48.1]], expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(await screen.findByRole('img', { name: 'Selected route elevation profile' })).toBeVisible();
  });
});

describe('ElevationProfilePanel print-safe fonts', () => {
  it('uses the complete download serializer for the accessible SVG/PNG preview', async () => {
    const user = userEvent.setup();
    const { container } = render(<ElevationProfilePanel coordinates={[[16, 48], [16.1, 48.1]]} routeName="Alpine <Route>" loadProfile={vi.fn(async () => profile)} />);
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));
    await user.selectOptions(screen.getByLabelText('Profile font', { exact: true }), 'serif');
    await user.click(screen.getByRole('radio', { name: 'Imperial' }));
    fireEvent.change(screen.getByLabelText('Profile font size', { exact: true }), { target: { value: '60' } });
    fireEvent.change(screen.getByLabelText('Profile print width', { exact: true }), { target: { value: '220' } });
    const chart = container.querySelector('svg.elevation-chart')!;
    const id = chart.getAttribute('aria-labelledby')!.replace(/-title$/, '');
    const expected = document.createElement('div');
    expected.innerHTML = serializeElevationProfileSvg(profile, 'Alpine <Route>', { fontFamily: 'serif', fontSize: 60, units: 'imperial', printWidthMm: 220 }, id);
    expect(chart.outerHTML).toBe(expected.querySelector('svg')?.outerHTML);
    expect(screen.getByRole('img', { name: 'Alpine <Route> elevation profile' })).toBe(chart);
    const roles = [...chart.querySelectorAll<SVGElement>('[data-profile-text]')].map((text) => text.dataset.profileText);
    expect(roles).toEqual(expect.arrayContaining(['title', 'distance-axis', 'elevation-axis', 'summary', 'source']));
  });

  it('lets the user choose a print-safe profile font', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ElevationProfilePanel
        coordinates={[[16, 48], [16.1, 48.1]]}
        routeName="Alpine Route"
        loadProfile={vi.fn(async () => profile)}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Generate elevation profile' }));

    const font = screen.getByRole('combobox', { name: 'Profile font' });
    await user.selectOptions(font, 'serif');

    expect(container.querySelector('.elevation-chart')).toHaveAttribute('font-family', 'Georgia,Times New Roman,serif');
    const markerLabel = container.querySelector('.elevation-marker-label');
    expect(markerLabel).toHaveAttribute('font-family', 'Georgia,Times New Roman,serif');
    expect(font).toHaveValue('serif');
  });
});

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
    expect(within(screen.getByRole('group', { name: 'Elevation summary' })).getByText('20.0 km')).toBeInTheDocument();
    expect(screen.getByText('120–260 m')).toBeInTheDocument();
    expect(screen.getByLabelText('Total ascent 140 m')).toHaveTextContent('140 m');
    expect(screen.getByText('Up to 100 sampled route coordinates are sent to Open-Meteo only when you generate a profile.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Copernicus DEM GLO-90 via Open-Meteo' })).toBeInTheDocument();
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

    expect(within(screen.getByRole('group', { name: 'Elevation summary' })).getByText('12.4 mi')).toBeInTheDocument();
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

    expect(container.querySelector('.elevation-line')).toHaveAttribute('stroke', '#2457a6');
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

    expect(container.querySelector('.elevation-area')).toHaveAttribute('fill', '#f2b84b');
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

    const gradient = container.querySelector('linearGradient')!;
    expect(container.querySelector('.elevation-area')).toHaveAttribute('fill', `url(#${gradient.id})`);
    expect(gradient.querySelector('stop:last-child')).toHaveAttribute('stop-color', '#f2b84b');
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
    expect(markers).toHaveAttribute('fill', '#7c3aed');

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
    expect(container.querySelector('.elevation-marker-label')).toHaveAttribute('font-size', '56');
    expect(screen.getByRole('button', { name: 'Download elevation SVG' })).toBeEnabled();

    await user.clear(fontSize);
    await user.type(fontSize, '71');
    expect(fontSize).toHaveAttribute('aria-invalid', 'true');
    expect(container.querySelector('.elevation-marker-label')).toHaveAttribute('font-size', '56');
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

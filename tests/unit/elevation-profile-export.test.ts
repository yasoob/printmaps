import {
  createElevationProfileLayout,
  createElevationProfilePng,
  createElevationProfilePdf,
  serializeElevationProfileSvg,
} from '../../src/export/elevationProfile';
import type { ElevationProfile } from '../../src/elevation/profile';

const profile: ElevationProfile = {
  samples: [
    { coordinate: [16, 48], distanceMeters: 0, elevationMeters: 120 },
    { coordinate: [16.1, 48.1], distanceMeters: 10_000, elevationMeters: 260 },
    { coordinate: [16.2, 48.2], distanceMeters: 20_000, elevationMeters: 180 },
  ],
  totalDistanceMeters: 20_000,
  minimumElevationMeters: 120,
  maximumElevationMeters: 260,
  totalAscentMeters: 140,
  totalDescentMeters: 80,
  sourceLabel: 'Copernicus DEM GLO-90 via Open-Meteo',
};

describe('elevation profile exports', () => {
  it('creates an attributed vector SVG and exact-page PDF from the same profile', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine <Route>');
    expect(svg).toContain('data-elevation-profile="true"');
    expect(svg).toContain('Alpine &lt;Route&gt;');
    expect(svg).toContain('20.0 km');
    expect(svg).toContain('Copernicus DEM GLO-90 via Open-Meteo');
    expect(svg).toMatch(/<path[^>]+d="M [^"]+"/);

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 425.19685 212.598425]');
    expect(text).toContain('Copernicus DEM GLO-90 via Open-Meteo');
  });

  it('rasterizes the same attributed SVG into a PNG', async () => {
    const expected = new Blob(['png'], { type: 'image/png' });
    const rasterize = vi.fn(async (svg: string) => {
      expect(svg).toContain('data-elevation-profile="true"');
      expect(svg).toContain('Copernicus DEM GLO-90 via Open-Meteo');
      return expected;
    });

    await expect(createElevationProfilePng(profile, 'Alpine Route', { rasterize })).resolves.toBe(expected);
  });

  it('uses imperial distances and elevations consistently in SVG and PDF exports', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', { units: 'imperial' });
    expect(svg).toContain('12.4 mi');
    expect(svg).toContain('459 ft');
    expect(svg).not.toContain('20.0 km');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', { units: 'imperial' });
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('12.4 mi | ascent 459 ft | descent 262 ft');
    expect(text).not.toContain('20.0 km');
  });

  it('keeps curve color, fill, and grid choices consistent across vector exports', async () => {
    const options = {
      curveColor: '#2457a6',
      showFill: false,
      showHorizontalGrid: false,
      showVerticalGrid: true,
    } as const;
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', options);
    expect(svg).toContain('stroke="#2457a6"');
    expect(svg).toContain('data-grid-axis="vertical"');
    expect(svg).not.toContain('data-grid-axis="horizontal"');
    expect(svg).not.toContain('data-profile-fill="true"');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', options);
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('0.141176 0.341176 0.65098 RG');
    expect(text).toContain('% grid vertical');
    expect(text).not.toContain('% grid horizontal');
    expect(text).not.toContain('% profile fill');
  });

  it('rejects an invalid curve color before serializing an export', async () => {
    expect(() => serializeElevationProfileSvg(profile, 'Alpine Route', { curveColor: 'red;stroke-width:99' }))
      .toThrow('six-digit hexadecimal color');
    await expect(createElevationProfilePdf(profile, 'Alpine Route', { curveColor: '#12345g' }))
      .rejects.toThrow('six-digit hexadecimal color');
  });

  it('rejects non-renderable finite profile measurements', () => {
    const pathological: ElevationProfile = {
      ...profile,
      maximumElevationMeters: Number.MAX_VALUE,
      samples: profile.samples.map((sample) => ({ ...sample, elevationMeters: Number.MAX_VALUE })),
    };

    expect(() => createElevationProfileLayout(pathological)).toThrow('valid route measurements');
  });

  it('fails closed when the PDF base font cannot encode the route title', async () => {
    await expect(createElevationProfilePdf(profile, '山道')).rejects.toThrow('cannot encode');
  });
});

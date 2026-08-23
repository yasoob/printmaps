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

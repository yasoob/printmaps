import {
  createElevationProfileLayout,
  createElevationProfilePng,
  serializeElevationProfileSvg,
} from '../../src/export/elevationProfile';
import { createElevationProfilePdf } from '../../src/export/elevationProfilePdf';
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
    expect(svg).toContain('fill="none" stroke="#0d79c7"');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route');
    const bytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 425.19685 212.598425]');
    expect(text).toContain('Copernicus DEM GLO-90 via Open-Meteo');
    expect(text).toContain('0.05098 0.47451 0.780392 RG 2.5 w');
  });

  it('uses the selected print width for exact SVG and PDF dimensions', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', { printWidthMm: 220 });
    expect(svg).toContain('width="220mm" height="110mm"');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', { printWidthMm: 220 });
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('/MediaBox [0 0 623.622047 311.811024]');
    expect(text).toContain('1.466667 0 0 1.466667 0 0 cm');

    expect(() => serializeElevationProfileSvg(profile, 'Alpine Route', { printWidthMm: 49 }))
      .toThrow('between 50 and 300');
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

  it('rasterizes PNG output at twelve pixels per selected print millimetre', async () => {
    const expected = new Blob(['png'], { type: 'image/png' });
    const rasterize = vi.fn(async (_svg: string, width: number, height: number) => {
      expect(width).toBe(2640);
      expect(height).toBe(1320);
      return expected;
    });

    await expect(createElevationProfilePng(profile, 'Alpine Route', { printWidthMm: 220, rasterize }))
      .resolves.toBe(expected);
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

  it('omits the curve stroke consistently across SVG, PNG, and PDF exports', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', { showCurve: false });
    expect(svg).not.toContain('fill="none" stroke="#0d79c7"');

    const rasterize = vi.fn(async (pngSvg: string) => {
      expect(pngSvg).not.toContain('fill="none" stroke="#0d79c7"');
      return new Blob(['png'], { type: 'image/png' });
    });
    await createElevationProfilePng(profile, 'Alpine Route', { showCurve: false, rasterize });
    expect(rasterize).toHaveBeenCalledOnce();

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', { showCurve: false });
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).not.toContain('0.05098 0.47451 0.780392 RG 2.5 w');
  });

  it('applies a selected print-safe font across SVG and PDF exports', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', { fontFamily: 'serif' });
    expect(svg).toContain('font-family="Georgia,Times New Roman,serif"');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', { fontFamily: 'serif' });
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('/BaseFont /Times-Roman');
  });

  it('keeps marker, font-size, and fill-color choices consistent across vector exports', async () => {
    const options = {
      fillColor: '#f2b84b',
      fontSize: 56,
      markerColor: '#7c3aed',
      showElevationMarkers: true,
    } as const;

    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', options);
    expect(svg).toContain('data-profile-fill="true"');
    expect(svg).toContain('fill="#f2b84b"');
    expect(svg).toContain('data-elevation-markers="true"');
    expect(svg).toContain('fill="#7c3aed"');
    expect(svg).toContain('font-size="56"');
    expect(svg).toContain('120 m');
    expect(svg).toContain('260 m');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', options);
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('% profile fill color 0.94902 0.721569 0.294118');
    expect(text).toContain('% elevation markers');
    expect(text).toContain('0.486275 0.227451 0.929412 rg');
    expect(text).toContain('BT /F1 16.8 Tf');
    expect(text).toContain('(120 m) Tj');
    expect(text).toContain('(260 m) Tj');
  });

  it('keeps the selected two-color fill gradient consistent across vector exports', async () => {
    const options = {
      fillColor: '#f2b84b',
      gradientColor: '#ffffff',
      showGradient: true,
    } as const;

    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', options);
    expect(svg).toContain('<linearGradient id="elevation-profile-gradient"');
    expect(svg).toContain('stop-color="#f2b84b"');
    expect(svg).toContain('stop-color="#ffffff"');
    expect(svg).toContain('fill="url(#elevation-profile-gradient)"');

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', options);
    const text = new TextDecoder().decode(await pdf.arrayBuffer());
    expect(text).toContain('/ShadingType 2');
    expect(text).toContain('/C0 [0.94902 0.721569 0.294118] /C1 [1 1 1]');
    expect(text).toContain('/Sh1 sh');
  });
});

describe('elevation profile export safeguards', () => {

  it('keeps maximum-size endpoint markers clear of the title in vector exports', async () => {
    const descendingProfile: ElevationProfile = {
      ...profile,
      samples: [
        { coordinate: [16, 48], distanceMeters: 0, elevationMeters: 260 },
        { coordinate: [16.1, 48.1], distanceMeters: 10_000, elevationMeters: 180 },
        { coordinate: [16.2, 48.2], distanceMeters: 20_000, elevationMeters: 120 },
      ],
    };
    const svgLayout = createElevationProfileLayout(descendingProfile);
    const svg = serializeElevationProfileSvg(descendingProfile, 'Descending Route', { fontSize: 70 });
    const svgMarkerLabel = /<text x="81" y="([\d.]+)"[^>]*>260 m<\/text>/.exec(svg);
    expect(svgMarkerLabel).not.toBeNull();
    expect(Number(svgMarkerLabel?.[1])).toBeGreaterThan(svgLayout.points[0].y);

    const pdf = await createElevationProfilePdf(descendingProfile, 'Descending Route', { fontSize: 70, units: 'imperial' });
    const pdfText = new TextDecoder().decode(await pdf.arrayBuffer());
    const pdfMarkerLabel = /[\d.]+ ([\d.]+) Td \(853 ft\) Tj/.exec(pdfText);
    const pdfLayout = createElevationProfileLayout(descendingProfile, 150 * 72 / 25.4, 75 * 72 / 25.4, { units: 'imperial' });
    expect(pdfMarkerLabel).not.toBeNull();
    expect(Number(pdfMarkerLabel?.[1])).toBeLessThan(75 * 72 / 25.4 - pdfLayout.points[0].y);
  });

  it('keeps maximum-size near-edge marker labels inside the plot', () => {
    const nearEdgeProfile: ElevationProfile = {
      ...profile,
      samples: [
        { coordinate: [16, 48], distanceMeters: 0, elevationMeters: 120 },
        { coordinate: [16.01, 48.01], distanceMeters: 1000, elevationMeters: 260 },
        { coordinate: [16.2, 48.2], distanceMeters: 20_000, elevationMeters: 180 },
      ],
    };

    const svg = serializeElevationProfileSvg(nearEdgeProfile, 'Near-edge Route', { fontSize: 70 });
    expect(svg).toMatch(/<text x="119\.25"[^>]+text-anchor="start"[^>]*>260 m<\/text>/);
  });

  it('keeps maximum-size vector footers on separate bounded lines', async () => {
    const svg = serializeElevationProfileSvg(profile, 'Alpine Route', { fontSize: 70 });
    const svgSummaryPosition = /<text x="81" y="([\d.]+)">20\.0 km/.exec(svg);
    const svgSourcePosition = /<text x="819" y="([\d.]+)" text-anchor="end">Copernicus DEM GLO-90 via Open-Meteo<\/text>/.exec(svg);
    expect(svgSummaryPosition).not.toBeNull();
    expect(svgSourcePosition).not.toBeNull();
    expect(Number(svgSourcePosition?.[1])).toBeGreaterThan(Number(svgSummaryPosition?.[1]));

    const pdf = await createElevationProfilePdf(profile, 'Alpine Route', { fontSize: 70 });
    const pdfText = new TextDecoder().decode(await pdf.arrayBuffer());
    const summaryPosition = /BT \/F1 12\.25 Tf\n[\d.]+ ([\d.]+) Td \(20\.0 km/.exec(pdfText);
    const sourcePosition = /BT \/F1 10\.5 Tf\n([\d.]+) ([\d.]+) Td \(Copernicus DEM GLO-90 via Open-Meteo\)/.exec(pdfText);
    expect(summaryPosition).not.toBeNull();
    expect(sourcePosition).not.toBeNull();
    expect(Number(sourcePosition?.[2])).toBeLessThan(Number(summaryPosition?.[1]));
    const layout = createElevationProfileLayout(profile, 150 * 72 / 25.4, 75 * 72 / 25.4);
    const estimatedSourceWidth = profile.sourceLabel.length * 10.5 * 0.5;
    expect(Number(sourcePosition?.[1]) + estimatedSourceWidth).toBeLessThanOrEqual(layout.plot.left + layout.plot.width);
  });

  it('rejects an invalid curve color before serializing an export', async () => {
    expect(() => serializeElevationProfileSvg(profile, 'Alpine Route', { curveColor: 'red;stroke-width:99' }))
      .toThrow('six-digit hexadecimal color');
    await expect(createElevationProfilePdf(profile, 'Alpine Route', { curveColor: '#12345g' }))
      .rejects.toThrow('six-digit hexadecimal color');
  });

  it('rejects unsafe profile appearance values before serializing an export', async () => {
    expect(() => serializeElevationProfileSvg(profile, 'Alpine Route', { fillColor: 'url(https://example.com)' }))
      .toThrow('fill color');
    expect(() => serializeElevationProfileSvg(profile, 'Alpine Route', { markerColor: '#12345g' }))
      .toThrow('marker color');
    await expect(createElevationProfilePdf(profile, 'Alpine Route', { fontSize: 71 }))
      .rejects.toThrow('between 20 and 70');
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

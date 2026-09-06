import { createElevationProfileLayout, createElevationProfileScene, formatElevationProfileNumber, serializeElevationProfileSvg } from '../../src/export/elevationProfile';
import { createElevationProfilePdf } from '../../src/export/elevationProfilePdf';
import { profileTextBounds, hasProfileTextIntersection } from '../../src/export/elevationProfileText';
import { printProfile, stressPrintProfile } from '../fixtures/elevationProfile';

const fonts = ['sans', 'serif', 'mono'] as const;
const units = ['metric', 'imperial'] as const;
const sizes = [20, 40, 60, 70];
const cases = fonts.flatMap((fontFamily) => units.flatMap((unit) => sizes.map((fontSize) => ({ fontFamily, units: unit, fontSize }))));

describe('UX042 font-aware print scene', () => {
  it.each(cases)('reserves bounded non-overlapping text for $fontFamily $units $fontSize', (options) => {
    for (const profile of [printProfile, stressPrintProfile()]) {
      const scene = createElevationProfileScene(profile, 'Alpine route', options);
      const boxes = scene.texts.map((text) => profileTextBounds(text, options.fontFamily));
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.top).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(900);
        expect(box.bottom).toBeLessThanOrEqual(450);
      }
      for (const [index, box] of boxes.entries()) {
        const remaining = boxes.slice(index + 1);
        for (const other of remaining) expect(hasProfileTextIntersection(box, other, 0)).toBe(false);
      }
      expect(scene.layout.plot.height).toBeGreaterThanOrEqual(110);
      const distanceLabels = scene.texts.filter((text) => text.role === 'distance-axis');
      expect(distanceLabels.at(-1)?.text).toBe(scene.layout.distanceTicks.at(-1)?.label);
      const source = scene.texts.find((text) => text.role === 'source')!;
      const summary = scene.texts.find((text) => text.role === 'summary')!;
      expect(profileTextBounds(source, options.fontFamily).top).toBeGreaterThan(profileTextBounds(summary, options.fontFamily).bottom);
    }
  });

  it.each(fonts)('retains all 200-character titles with %s rather than clipping or truncating', (fontFamily) => {
    for (const title of ['A long mountain itinerary '.repeat(8), '山'.repeat(200), 'W'.repeat(200)]) {
      const scene = createElevationProfileScene(stressPrintProfile(), title, { fontFamily, fontSize: 70 });
      const headings = scene.texts.filter((text) => text.role === 'title');
      expect(headings.map((text) => text.text).join('')).toBe(title);
      expect(headings.length).toBeGreaterThan(1);
      const boxes = scene.texts.map((text) => profileTextBounds(text, fontFamily));
      for (const [index, box] of boxes.entries()) {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(900);
        const remaining = boxes.slice(index + 1);
        for (const other of remaining) expect(hasProfileTextIntersection(box, other, 0)).toBe(false);
      }
    }
  });

  it('keeps extrema near the same edge readable and retains a flat-profile marker', () => {
    const nearEdge = stressPrintProfile();
    const scene = createElevationProfileScene(nearEdge, 'Edge extrema', { fontSize: 70, fontFamily: 'serif', units: 'imperial' });
    expect(scene.markers).toHaveLength(2);
    const labels = scene.texts.filter((text) => text.role === 'marker');
    expect(labels.map((text) => text.fontSize)).toEqual([70, 70]);
    expect(hasProfileTextIntersection(profileTextBounds(labels[0], 'serif'), profileTextBounds(labels[1], 'serif'))).toBe(false);
    const flat = { ...printProfile, minimumElevationMeters: 100, maximumElevationMeters: 100, samples: printProfile.samples.map((sample) => ({ ...sample, elevationMeters: 100 })) };
    expect(createElevationProfileScene(flat, 'Flat', { fontSize: 70 }).markers).toHaveLength(1);
  });

  it('serializes every scene row with escaped content and isolated accessible IDs', () => {
    const title = 'Alpine <route> & "friends"';
    const svg = serializeElevationProfileSvg(printProfile, title, { showGradient: true, fontSize: 60 }, 'preview-safe');
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.querySelector('svg')?.getAttribute('aria-labelledby')).toBe('preview-safe-title');
    expect(document.querySelector('title')?.textContent).toBe(`${title} elevation profile`);
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('linearGradient')?.id).toBe('preview-safe-gradient');
    const roles = [...document.querySelectorAll<SVGElement>('[data-profile-text]')].map((text) => text.dataset.profileText);
    expect(roles).toEqual(expect.arrayContaining(['title', 'distance-axis', 'elevation-axis', 'summary', 'source', 'marker']));
  });

  it.each(cases)('preserves independent PDF point scaling and $fontFamily $units $fontSize settings', async (options) => {
    const pdf = await createElevationProfilePdf(printProfile, 'Alpine Route', { ...options, printWidthMm: 220 });
    const text = await pdf.text();
    const font = { sans: 'Helvetica', serif: 'Times-Roman', mono: 'Courier' }[options.fontFamily];
    expect(text).toContain(`/BaseFont /${font}`);
    expect(text).toContain(`BT /F1 ${formatElevationProfileNumber(options.fontSize * 0.3)} Tf`);
    expect(text).toContain('/MediaBox [0 0 623.622047 311.811024]');
    expect(text).toContain('1.466667 0 0 1.466667 0 0 cm');
    expect(text).toContain(options.units === 'metric' ? '20.0 km | ascent 140 m' : '12.4 mi | ascent 459 ft');
    const width = 150 * 72 / 25.4, height = 75 * 72 / 25.4;
    expect(createElevationProfileLayout(printProfile, width, height, options).plot).toEqual({
      left: width * 0.09, top: height * 0.16, width: width * 0.85, height: height * 0.65,
    });
  });

  it.each([50, 220, 300])('preserves the PDF 2:1 physical page at %imm', async (printWidthMm) => {
    const pdf = await createElevationProfilePdf(printProfile, 'Alpine Route', { printWidthMm, fontSize: 70 });
    const text = await pdf.text();
    const width = formatElevationProfileNumber(printWidthMm * (72 / 25.4));
    const height = formatElevationProfileNumber(printWidthMm / 2 * (72 / 25.4));
    expect(text).toContain(`/MediaBox [0 0 ${width} ${height}]`);
  });
});

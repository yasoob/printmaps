import { createProfileFontMeasurer } from '../../src/export/elevationProfileFontMetrics';
import { createElevationProfileScene } from '../../src/export/elevationProfileScene';
import { fitProfileTitle, profileTextBounds, profileTextWeight, profileTextWidth } from '../../src/export/elevationProfileText';
import { printProfile } from '../fixtures/elevationProfile';

describe('UX042 font-aware advance bounds', () => {
  it('measures every fallback face with the actual weight and includes ink overhang', () => {
    const fonts: string[] = [];
    const context = {
      font: '',
      measureText: vi.fn((text: string) => {
        fonts.push(context.font);
        const advance = context.font.endsWith('px serif') ? 1100 : 900;
        return { width: text.length * advance, actualBoundingBoxLeft: 10, actualBoundingBoxRight: text.length * advance + 20 } as TextMetrics;
      }),
    };
    const measurer = createProfileFontMeasurer(context);
    expect(measurer.measure('HH', 'serif', 600)).toBeGreaterThan(2.23);
    expect(fonts).toEqual([
      '600 1000px Georgia,Times New Roman,serif',
      '600 1000px Times New Roman,serif',
      '600 1000px serif',
    ]);
    measurer.measure('HH', 'serif', 600);
    expect(context.measureText).toHaveBeenCalledTimes(3);
    measurer.measure('HH', 'serif', 400);
    expect(context.measureText).toHaveBeenCalledTimes(6);
    measurer.clear();
    measurer.measure('HH', 'serif', 400);
    expect(context.measureText).toHaveBeenCalledTimes(9);
  });

  it('does not assume that a Unicode code point occupies one em', () => {
    const context = {
      font: '', measureText: vi.fn(() => ({ width: 6500, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 6500 }) as TextMetrics),
    };
    expect(createProfileFontMeasurer(context).measure('﷽', 'serif', 600)).toBeGreaterThan(6.5);
  });

  it('does not cache unavailable measurements', () => {
    const context = {
      font: '', measureText: vi.fn(() => ({ width: NaN }) as TextMetrics),
    };
    const measurer = createProfileFontMeasurer(context);
    expect(measurer.measure('H', 'sans', 600)).toBeUndefined();
    expect(measurer.measure('H', 'sans', 600)).toBeUndefined();
    expect(context.measureText).toHaveBeenCalledTimes(2);
  });

  it('rejects empty measurements for nonempty text rather than underestimating a lost context', () => {
    const context = {
      font: '', measureText: vi.fn(() => ({ width: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 0 }) as TextMetrics),
    };
    expect(createProfileFontMeasurer(context).measure('Wide title', 'serif', 600)).toBeUndefined();
  });

  it('uses one weight definition for text fitting, bounds and serialization roles', () => {
    expect(profileTextWeight('title')).toBe(600);
    expect(profileTextWeight('marker')).toBe(600);
    expect(profileTextWeight('source')).toBe(400);
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZmw') {
      expect(profileTextWidth(letter, 1, 'serif', 600)).toBeGreaterThanOrEqual(0.95);
    }
    expect(profileTextWidth('H', 1, 'serif', 600)).toBeGreaterThan(profileTextWidth('H', 1, 'serif', 400));
  });

  it.each(['H'.repeat(200), 'mw'.repeat(100), '﷽'.repeat(200), '﷽'])('fits complete broad text even without a browser canvas: %s', (title) => {
    const heading = fitProfileTitle(title, { maximumFontSize: 42, width: 864, height: 60, family: 'serif' });
    expect(heading.lines.join('')).toBe(title);
    for (const line of heading.lines) expect(profileTextWidth(line, heading.fontSize, 'serif', 600)).toBeLessThanOrEqual(864);
    const scene = createElevationProfileScene(printProfile, title, { fontFamily: 'serif', fontSize: 70 });
    for (const text of scene.texts) {
      const bounds = profileTextBounds(text, 'serif');
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(900);
    }
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { planPdfExport } from '../../src/app/components/exportDialogPdf';
import { NATIVE_SYMBOL_BUFFER_PX } from '../../src/app/components/exportDialogRaster';
import { PAGE_PRESET_DEFINITIONS } from '../../src/domain/pagePresets';
import type { ProjectDocument } from '../../src/domain/project';
import { createDefaultStudioSettings } from '../../src/domain/studio';
import { planLayeredPsdExport } from '../../src/export/layeredPsdPlan';
import { DEFAULT_EXPORT_PREFLIGHT_LIMITS, planExportPreflight } from '../../src/export/preflight';
import { PRINT_SIZES, pixelDimensions, pixelsPerInchForDistance, printSize } from '../../src/marketing/printSizes';

const contentPages = [
  'printmaps-net-alternative',
  'map-print-size-guide',
  'share-and-embed-maps',
  'printable-map-maker',
  'gpx-map-maker',
  'layered-map-export',
  'about',
] as const;

function pageSource(slug: string): string {
  return readFileSync(path.resolve(process.cwd(), 'src/pages', `${slug}.astro`), 'utf8');
}

function registrySource(slug: string): string {
  return readFileSync(path.resolve(process.cwd(), 'src/marketing/pages', `${slug}.ts`), 'utf8');
}

function documentFor(size: { longEdgeMm: number; shortEdgeMm: number }): ProjectDocument {
  return {
    page: { widthMm: size.longEdgeMm, heightMm: size.shortEdgeMm },
    layers: [{ type: 'basemap' }, { type: 'route' }, { type: 'poi' }],
    style: { visibility: { labels: true } },
  } as unknown as ProjectDocument;
}

function pngDelivery(size: { longEdgeMm: number; shortEdgeMm: number }): 'single' | 'streaming' | 'blocked' {
  const request = {
    format: 'png' as const,
    page: { widthMm: size.longEdgeMm, heightMm: size.shortEdgeMm },
    dpi: 300,
    attributions: ['credit'],
    basemap: 'raster' as const,
    vectorOverlays: true,
    missing: {},
    rasterLayers: [],
    cancellationSupported: true,
  };
  const limits = { tileOverlapPx: NATIVE_SYMBOL_BUFFER_PX };
  if (planExportPreflight({ ...request, rasterDelivery: 'single-png' }, limits).safe) return 'single';
  if (planExportPreflight({ ...request, rasterDelivery: 'streaming-png' }, limits).safe) return 'streaming';
  return 'blocked';
}

function psdDpi(name: string): number {
  return planLayeredPsdExport(documentFor(printSize(name))).effectiveDpi;
}

describe('print size guide data', () => {
  it('includes every editor page preset with its exact dimensions', () => {
    for (const preset of PAGE_PRESET_DEFINITIONS) {
      expect(printSize(preset.label)).toMatchObject({ longEdgeMm: preset.longEdgeMm, shortEdgeMm: preset.shortEdgeMm, preset: true });
    }
    const areas = PRINT_SIZES.map((size) => size.longEdgeMm * size.shortEdgeMm);
    for (let index = 1; index < areas.length; index += 1) expect(areas[index]).toBeGreaterThanOrEqual(areas[index - 1]);
  });

  it('computes the pixel figures quoted in the copy', () => {
    expect(pixelDimensions(printSize('A3'), 300)).toBe('4,961\u{A0}×\u{A0}3,508');
    expect(pixelDimensions(printSize('A2'), 300)).toBe('7,016\u{A0}×\u{A0}4,961');
    expect(pixelDimensions(printSize('50 × 70 cm'), 300)).toBe('8,268\u{A0}×\u{A0}5,906');
    expect(pixelDimensions(printSize('Tabloid (11 × 17 in)'), 300)).toBe('5,100\u{A0}×\u{A0}3,300');
  });

  it('uses the one-arcminute rule for viewing distance', () => {
    expect(Math.round(pixelsPerInchForDistance(30))).toBe(291);
    expect(Math.round(pixelsPerInchForDistance(100))).toBe(87);
  });
});

describe('export capabilities quoted on the content pages', () => {
  it('keeps custom pages up to 1330 mm a side', () => {
    expect(DEFAULT_EXPORT_PREFLIGHT_LIMITS.maxPageSideMm).toBe(1330);
  });

  it('defaults poster margins to 10 mm on every side', () => {
    expect(createDefaultStudioSettings().poster.marginsMm).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it('writes a single 300 DPI PNG up to 50 × 70 cm and streams A1 and 24 × 36 in', () => {
    for (const name of ['A2', '50 × 70 cm', '18 × 24 in']) expect(pngDelivery(printSize(name))).toBe('single');
    for (const name of ['A1', '24 × 36 in']) expect(pngDelivery(printSize(name))).toBe('streaming');
  });

  it('renders 300 DPI PDFs up to A1', () => {
    for (const size of PRINT_SIZES) expect(planPdfExport(documentFor(size)).safe).toBe(true);
  });

  it('keeps layered PSD at 300 DPI up to A4 and US Letter and lowers it above', () => {
    expect(psdDpi('A4')).toBe(300);
    expect(psdDpi('US Letter')).toBe(300);
    expect(psdDpi('A3')).toBeLessThan(300);
  });
});

describe('content page copy', () => {
  const banned = [
    /\bunlock/i, /\belevate/i, /\bseamless/i, /\beffortless/i, /\bempower/i, /game-?changer/i, /dive into/i, /\bdelve/i,
    /in today's/i, /whether you're/i, /look no further/i, /the perfect\b/i, /\bstunning/i, /breathtaking/i, /bring your .* to life/i,
    /next level/i, /next-level/i, /\bjourney/i, /tapestry/i, /\bcurated/i, /\brobust/i, /cutting-edge/i, /\bleverage/i,
    /\bboasts?\b/i, /\bvibrant/i, /\bcrucial/i, /\bpivotal/i, /!\s/, /[\u{1F300}-\u{1FAFF}]/u, /[“”‘’]/,
  ];
  const negative = [/\bdoes not support\b/i, /\bdoesn't support\b/i, /\bnot supported\b/i, /\bcannot be revoked\b/i, /\blacks?\b/i, /\bunsupported\b/i];

  it.each(contentPages)('%s avoids banned and negative phrasing', (slug) => {
    const text = `${pageSource(slug)}\n${registrySource(slug)}`.replaceAll(/^import .*$/gm, '');
    for (const pattern of [...banned, ...negative]) expect(text, `${slug} matches ${pattern}`).not.toMatch(pattern);
  });

  it('dates the competitor comparison and cites its sources', () => {
    const source = pageSource('printmaps-net-alternative');
    expect(source).toContain("const checked = '19 October 2026'");
    for (const path of ['printmaps.net/pricing', 'printmaps.net/features', 'printmaps.net/information-for-ai']) expect(source).toContain(path);
  });
});

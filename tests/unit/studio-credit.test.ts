import { createInitialProjectDocument, type ProjectDocument } from '../../src/domain/project';
import { BASEMAP_ATTRIBUTION, projectAttributionText, projectPrintAttributionText } from '../../src/domain/projectAttributions';
import { creditCommands } from '../../src/export/studioPdf';
import { studioAttributionPrimitives } from '../../src/export/studioComposition';
import { serializePrintScene } from '../../src/print/scene';
import {
  contrastRatio,
  deriveStudioCredit,
  helveticaTextWidthEm,
  layoutStudioCredit,
  STUDIO_CREDIT_FONT_SIZE_MM,
  STUDIO_CREDIT_INSET_MM,
  STUDIO_CREDIT_MIN_CONTRAST,
  STUDIO_CREDIT_MIN_FONT_SIZE_MM,
  studioCreditPrimitives,
} from '../../src/print/studioCredit';
import { deriveStudioLayout } from '../../src/print/studioLayout';

const PRINTED = '© OpenStreetMap contributors (openstreetmap.org/copyright) · OpenMapTiles · OpenFreeMap';
const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const poster = (bottom: number, overrides: Partial<{ backgroundColor: string; textColor: string }> = {}) => ({
  marginsMm: { top: 10, right: 10, bottom, left: 10 }, backgroundColor: '#ffffff', textColor: '#202020', ...overrides,
});

function posterDocument(bottom: number): ProjectDocument {
  const document = createInitialProjectDocument();
  document.page = { ...document.page, widthMm: 210, heightMm: 297, orientation: 'portrait' };
  document.studio.poster = { ...document.studio.poster, enabled: true, marginsMm: { top: 10, right: 10, bottom, left: 10 } };
  return document;
}

describe('printed map credit text', () => {
  it('prints the OpenStreetMap licence URL while the live map credit stays unchanged', () => {
    const document = createInitialProjectDocument();
    expect(projectPrintAttributionText(document)).toBe(PRINTED);
    expect(projectAttributionText(document)).toBe(BASEMAP_ATTRIBUTION);
  });

  it('adds Mapbox and terrain credits, honouring the filtered-layer Mapbox override', () => {
    const document = createInitialProjectDocument();
    document.studio.terrain.enabled = true;
    const text = projectPrintAttributionText({ ...document, mapboxCredit: true });
    expect(text).toContain(`${PRINTED} · © Mapbox · Elevation: AWS Terrain Tiles`);
    expect(projectPrintAttributionText({ ...document, mapboxCredit: false })).not.toContain('Mapbox');
  });
});

describe('shared credit layout', () => {
  it('sets a quiet single caption in a bottom margin that can hold it, aligned with the poster text inset', () => {
    const layout = layoutStudioCredit({ page: { widthMm: 210, heightMm: 297 }, text: PRINTED, poster: poster(10) });
    expect(layout).toMatchObject({ placement: 'margin', reserveMm: 0, strip: null, fontSizeMm: STUDIO_CREDIT_FONT_SIZE_MM });
    expect(layout.lines).toHaveLength(1);
    const [line] = layout.lines;
    expect(line.text).toBe(PRINTED);
    expect(line.x).toBe(10 + STUDIO_CREDIT_INSET_MM);
    expect(line.baseline).toBeGreaterThan(297 - 10 + layout.fontSizeMm);
    expect(line.baseline).toBeLessThan(297);
    expect(studioCreditPrimitives(layout).some(({ kind }) => kind === 'rect')).toBe(false);
  });

  it('falls back to a minimal paper strip off the map when there is no margin', () => {
    const layout = layoutStudioCredit({ page: { widthMm: 297, heightMm: 210 }, text: PRINTED, poster: null });
    expect(layout.placement).toBe('strip');
    expect(layout.reserveMm).toBeGreaterThan(STUDIO_CREDIT_FONT_SIZE_MM);
    expect(layout.reserveMm).toBeLessThan(6);
    expect(layout.strip).toEqual({ x: 0, y: 210 - layout.reserveMm, width: 297, height: layout.reserveMm });
    expect(layout.paper).toBe('#ffffff');
    expect(layout.lines[0].x).toBe(STUDIO_CREDIT_INSET_MM);
    expect(layout.lines[0].baseline).toBeGreaterThan(layout.strip!.y + layout.fontSizeMm * 0.7);
    expect(studioCreditPrimitives(layout)[0]).toMatchObject({ kind: 'rect', fill: '#ffffff' });
  });

  it('tops up a margin that is too small with only the missing strip height', () => {
    const full = layoutStudioCredit({ page: { widthMm: 210, heightMm: 297 }, text: PRINTED, poster: null });
    const layout = layoutStudioCredit({ page: { widthMm: 210, heightMm: 297 }, text: PRINTED, poster: poster(3, { backgroundColor: '#1d2330', textColor: '#f4efe6' }) });
    expect(layout.placement).toBe('strip');
    expect(layout.reserveMm).toBeCloseTo(full.reserveMm - 3);
    expect(layout.paper).toBe('#1d2330');
  });

  it('shrinks toward the 5 pt floor, then wraps instead of overflowing', () => {
    const textEm = helveticaTextWidthEm(PRINTED);
    const shrinkWidth = textEm * (STUDIO_CREDIT_FONT_SIZE_MM + STUDIO_CREDIT_MIN_FONT_SIZE_MM) / 2 + STUDIO_CREDIT_INSET_MM * 2;
    const shrunk = layoutStudioCredit({ page: { widthMm: shrinkWidth, heightMm: 200 }, text: PRINTED, poster: null });
    expect(shrunk.lines).toHaveLength(1);
    expect(shrunk.fontSizeMm).toBeLessThan(STUDIO_CREDIT_FONT_SIZE_MM);
    expect(shrunk.fontSizeMm).toBeGreaterThanOrEqual(STUDIO_CREDIT_MIN_FONT_SIZE_MM);

    const wrapped = layoutStudioCredit({ page: { widthMm: 70, heightMm: 120 }, text: PRINTED, poster: null });
    expect(wrapped.lines.map(({ text }) => text)).toEqual(['© OpenStreetMap contributors (openstreetmap.org/copyright)', 'OpenMapTiles · OpenFreeMap']);
    expect(wrapped.fontSizeMm).toBeGreaterThanOrEqual(STUDIO_CREDIT_MIN_FONT_SIZE_MM);
    for (const line of wrapped.lines) expect(line.x + line.width).toBeLessThanOrEqual(70 - STUDIO_CREDIT_INSET_MM + 1e-9);
    expect(wrapped.reserveMm).toBeGreaterThan(shrunk.reserveMm);
  });

  it.each([
    ['#ffffff', '#202020'], ['#1d2330', '#f4efe6'], ['#f6efe3', '#f0e8dc'], ['#000000', '#111111'], ['#808080', '#7f7f7f'],
  ])('keeps a muted caption legible on %s paper with %s text', (backgroundColor, textColor) => {
    const layout = layoutStudioCredit({ page: { widthMm: 210, heightMm: 297 }, text: PRINTED, poster: poster(10, { backgroundColor, textColor }) });
    expect(contrastRatio(layout.color, layout.paper)).toBeGreaterThanOrEqual(STUDIO_CREDIT_MIN_CONTRAST);
    expect(layout.color).not.toBe(textColor);
  });
});

describe('poster layout reserves the credit only when it needs a strip', () => {
  it('gives the whole page to a poster whose margin holds the caption', () => {
    const document = posterDocument(10);
    const layout = deriveStudioLayout(document);
    expect(layout.credit.placement).toBe('margin');
    expect(layout.printable.height).toBe(297);
    expect(layout.map.y + layout.map.height).toBe(287);
    expect(layout.credit.lines[0].baseline).toBeGreaterThan(287);
  });

  it('keeps the map above the fallback strip when the poster has no bottom margin', () => {
    const document = posterDocument(0);
    const layout = deriveStudioLayout(document);
    expect(layout.credit.placement).toBe('strip');
    expect(layout.printable.height).toBeCloseTo(297 - layout.credit.reserveMm);
    expect(layout.map.y + layout.map.height).toBeLessThanOrEqual(layout.credit.strip!.y + 1e-9);
  });
});

describe('every export format uses the same credit layout', () => {
  it.each([['margin', 10], ['strip', 0]] as const)('serializes the %s credit as live SVG text identical to the canvas primitives', (placement, bottom) => {
    const document = posterDocument(bottom);
    const credit = deriveStudioCredit(document);
    expect(credit.placement).toBe(placement);
    expect(studioAttributionPrimitives(document)).toEqual(studioCreditPrimitives(credit));
    const svg = new DOMParser().parseFromString(serializePrintScene(document, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      project: () => ({ x: 10, y: 10 }),
    }), 'image/svg+xml');
    const group = svg.querySelector<SVGElement>('#attribution')!;
    expect(group.dataset.layerName).toBe('Attribution');
    expect(group.querySelector('text')?.textContent).toBe(PRINTED);
    expect(Number(group.querySelector('text')?.getAttribute('x'))).toBe(credit.lines[0].x);
    expect(group.querySelectorAll('rect')).toHaveLength(placement === 'strip' ? 1 : 0);
  });

  it('writes the PDF credit as Helvetica live text at the same page position', () => {
    const credit = deriveStudioCredit(posterDocument(0));
    const height = 297 * 72 / 25.4;
    const commands = creditCommands(credit, height);
    expect(commands).toContain(String.raw`(\251 OpenStreetMap contributors \(openstreetmap.org/copyright\) \267 OpenMapTiles \267 OpenFreeMap) Tj`);
    expect(commands).toMatch(/\/F1 6 Tf/);
    expect(commands).toContain(' re f');
    const position = /([\d.]+) ([\d.]+) Td/.exec(commands)!;
    const [x, y] = [Number(position[1]), Number(position[2])];
    expect(x).toBeCloseTo(credit.lines[0].x * 72 / 25.4, 4);
    expect(y).toBeCloseTo(height - credit.lines[0].baseline * 72 / 25.4, 4);
    const marginCredit = deriveStudioCredit(posterDocument(10));
    expect(creditCommands(marginCredit, height)).not.toContain(' re f');
  });
});

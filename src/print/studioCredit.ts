import type { PageSettings } from '../domain/project';
import { projectPrintAttributionText, type AttributionDocument } from '../domain/projectAttributions';
import type { PosterSettings } from '../domain/studio';
import type { StudioBox } from './studioGeometry';
import type { StudioPrimitive } from './studioPrimitives';

/**
 * Shared map-credit layout for every export and for the live print frame.
 *
 * Placement rules:
 * - Margin: when the poster's bottom page margin can hold the caption, the credit is a quiet caption
 *   in that margin, below the map, at the poster-text inset. Nothing is reserved and no box is drawn.
 * - Strip (fallback): with no margin (composition off, poster off, margins 0, full bleed) or a margin
 *   too small for the caption, a minimal paper-coloured strip is reserved at the page bottom so the
 *   credit still sits off the map. The layout removes that strip from the map area and the live print
 *   frame paints it too, so the export stays WYSIWYG.
 *
 * Typography: Helvetica/Arial, 6 pt target. If the line is too long it shrinks to the 5 pt legibility
 * floor (the smallest size commonly accepted for printed fine print), then wraps at the " · " source
 * separators (two lines in practice) instead of overflowing. Colour is the poster text colour muted
 * toward the paper colour while keeping at least 4.5:1 WCAG contrast against the paper.
 */

const MM_PER_POINT = 25.4 / 72;
export const STUDIO_CREDIT_FONT_SIZE_MM = 6 * MM_PER_POINT;
export const STUDIO_CREDIT_MIN_FONT_SIZE_MM = 5 * MM_PER_POINT;
export const STUDIO_CREDIT_MIN_CONTRAST = 4.5;
/**
Same inner inset the poster text uses inside its box, so the caption lines up with left-aligned titles.
*/
export const STUDIO_CREDIT_INSET_MM = 2;
const LINE_HEIGHT = 1.2;
const ASCENT = 0.75;
const PADDING_MM = 1.4;
const MAX_MARGIN_GAP_MM = 4;
const SEPARATOR = ' · ';
const DEFAULT_PAPER = '#ffffff';
const DEFAULT_INK = '#202020';
const MUTE_TOWARD_PAPER = 0.35;

// Helvetica advance widths (Adobe AFM, 1/1000 em) for ASCII 32–126. Arial shares these metrics.
const HELVETICA_ASCII = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_EXTRA: Readonly<Record<string, number>> = { '©': 737, '·': 278, '–': 556, '—': 1000, '’': 222, '‘': 222 };

export function helveticaTextWidthEm(text: string): number {
  let total = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    total += code >= 32 && code <= 126 ? HELVETICA_ASCII[code - 32] : (HELVETICA_EXTRA[character] ?? 600);
  }
  return total / 1000;
}

type Rgb = readonly [number, number, number];

function parseHex(color: string | undefined): Rgb | null {
  if (!color || !/^#[\da-f]{6}$/i.test(color)) return null;
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const a = parseHex(first), b = parseHex(second);
  if (!a || !b) return 1;
  const firstLuminance = luminance(a), secondLuminance = luminance(b);
  const high = Math.max(firstLuminance, secondLuminance), low = Math.min(firstLuminance, secondLuminance);
  return (high + 0.05) / (low + 0.05);
}

function mix(ink: Rgb, paper: Rgb, amount: number): Rgb {
  return ink.map((channel, index) => channel + (paper[index] - channel) * amount) as unknown as Rgb;
}

/**
Mutes the ink toward the paper, but never below the minimum legible contrast.
*/
export function mutedCreditColor(inkColor: string, paperColor: string): string {
  const paper = parseHex(paperColor) ?? parseHex(DEFAULT_PAPER)!;
  let ink = parseHex(inkColor);
  if (!ink || contrastRatio(toHex(ink), toHex(paper)) < STUDIO_CREDIT_MIN_CONTRAST) {
    ink = luminance(paper) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  }
  for (let amount = MUTE_TOWARD_PAPER; amount > 0; amount -= 0.05) {
    const candidate = toHex(mix(ink, paper, amount));
    if (contrastRatio(candidate, toHex(paper)) >= STUDIO_CREDIT_MIN_CONTRAST) return candidate;
  }
  return toHex(ink);
}

export type StudioCreditPoster = Readonly<Pick<PosterSettings, 'marginsMm' | 'backgroundColor'> & { textColor: string }>;
export type StudioCreditInput = Readonly<{
  page: Readonly<Pick<PageSettings, 'widthMm' | 'heightMm'>>;
  text: string;
  /**
  Enabled poster settings, or null when the page has no poster margins (composition or poster off).
  */
  poster: StudioCreditPoster | null;
}>;
export type StudioCreditLine = Readonly<{ text: string; x: number; baseline: number; width: number }>;
export type StudioCreditLayout = Readonly<{
  text: string;
  placement: 'margin' | 'strip';
  /**
  Height removed from the bottom of the poster's printable area; 0 when the caption fits the margin.
  */
  reserveMm: number;
  /**
  Paper-coloured strip painted under the caption in the strip fallback.
  */
  strip: StudioBox | null;
  lines: readonly StudioCreditLine[];
  fontSizeMm: number;
  color: string;
  paper: string;
}>;

function blockHeight(lineCount: number, size: number): number {
  return size * (1 + (lineCount - 1) * LINE_HEIGHT);
}

function splitTokens(text: string, separator: string): string[] {
  const parts = text.split(separator);
  return parts.map((part, index) => (index < parts.length - 1 ? `${part}${separator}` : part));
}

const trimLine = (line: string) => line.trim().replace(/\s*·$/, '').replace(/^·\s*/, '');

function greedyLines(tokens: readonly string[], maxEm: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const token of tokens) {
    if (current && helveticaTextWidthEm(trimLine(`${current}${token}`)) > maxEm) {
      lines.push(trimLine(current));
      current = token;
    } else current += token;
  }
  if (current.trim()) lines.push(trimLine(current));
  return lines;
}

function widestEm(lines: readonly string[]): number {
  return Math.max(...lines.map((line) => helveticaTextWidthEm(line)));
}

function twoLineSplit(text: string): string[] | null {
  const segments = splitTokens(text, SEPARATOR);
  let best: string[] | null = null;
  for (let index = 1; index < segments.length; index += 1) {
    const candidate = [trimLine(segments.slice(0, index).join('')), segments.slice(index).join('')];
    if (!best || widestEm(candidate) < widestEm(best)) best = candidate;
  }
  return best;
}

/**
Fits the caption: one line at 6 pt shrinking to the 5 pt floor, then two lines, then more lines at the floor.
*/
export function fitCreditLines(text: string, availableWidthMm: number): { lines: string[]; size: number } {
  const width = Math.max(availableWidthMm, 1);
  const fit = (lines: string[]) => Math.min(STUDIO_CREDIT_FONT_SIZE_MM, width / Math.max(widestEm(lines), 0.001));
  const single = [text];
  if (fit(single) >= STUDIO_CREDIT_MIN_FONT_SIZE_MM) return { lines: single, size: fit(single) };
  const pair = twoLineSplit(text);
  if (pair && fit(pair) >= STUDIO_CREDIT_MIN_FONT_SIZE_MM) return { lines: pair, size: fit(pair) };
  const maxEm = width / STUDIO_CREDIT_MIN_FONT_SIZE_MM;
  const lines = greedyLines(splitTokens(text, SEPARATOR).flatMap((segment) => (
    helveticaTextWidthEm(segment) > maxEm ? splitTokens(segment, ' ') : [segment]
  )), maxEm);
  return { lines, size: STUDIO_CREDIT_MIN_FONT_SIZE_MM };
}

function validatedText({ page, text }: StudioCreditInput): string {
  const normalized = text.replaceAll(/\s+/g, ' ').trim();
  if (!normalized) throw new Error('Map attribution is required for export.');
  if (!(page.widthMm > 0) || !(page.heightMm > 0)) throw new Error('The map credit needs a page with a positive size.');
  return normalized;
}

function creditColors(poster: StudioCreditPoster | null): { paper: string; color: string } {
  const paper = poster && parseHex(poster.backgroundColor) ? poster.backgroundColor.toLowerCase() : DEFAULT_PAPER;
  return { paper, color: mutedCreditColor(poster?.textColor ?? DEFAULT_INK, paper) };
}

export function layoutStudioCredit(input: StudioCreditInput): StudioCreditLayout {
  const { page, poster } = input;
  const text = validatedText(input);
  const margins = poster?.marginsMm ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const { paper, color } = creditColors(poster);
  const x = Math.max(0, margins.left) + STUDIO_CREDIT_INSET_MM;
  const available = page.widthMm - x - Math.max(0, margins.right) - STUDIO_CREDIT_INSET_MM;
  const { lines, size } = fitCreditLines(text, available);
  const block = blockHeight(lines.length, size);
  const required = block + PADDING_MM * 2;
  const bottomMargin = Math.max(0, margins.bottom);
  const isMargin = bottomMargin >= required;
  const reserveMm = isMargin ? 0 : required - bottomMargin;
  const areaTop = page.heightMm - reserveMm - bottomMargin;
  const gap = isMargin ? Math.min(Math.max((bottomMargin - block) / 2, PADDING_MM), MAX_MARGIN_GAP_MM) : PADDING_MM;
  return {
    text,
    placement: isMargin ? 'margin' : 'strip',
    reserveMm,
    strip: isMargin ? null : { x: 0, y: page.heightMm - reserveMm, width: page.widthMm, height: reserveMm },
    lines: lines.map((line, index) => ({
      text: line,
      x,
      baseline: areaTop + gap + size * (ASCENT + index * LINE_HEIGHT),
      width: Math.min(helveticaTextWidthEm(line) * size, Math.max(available, 1)),
    })),
    fontSizeMm: size,
    color,
    paper,
  };
}

export type StudioCreditDocument = AttributionDocument & Readonly<{
  page: Readonly<Pick<PageSettings, 'widthMm' | 'heightMm'>>;
  studio: Readonly<{
    poster: Readonly<Pick<PosterSettings, 'enabled' | 'marginsMm' | 'backgroundColor' | 'title'>>;
    terrain: NonNullable<AttributionDocument['studio']>['terrain'];
  }>;
}>;

export function studioCreditInput(document: StudioCreditDocument): StudioCreditInput {
  const { poster } = document.studio;
  return {
    page: document.page,
    text: projectPrintAttributionText(document),
    poster: poster.enabled ? { marginsMm: poster.marginsMm, backgroundColor: poster.backgroundColor, textColor: poster.title.color } : null,
  };
}

export function deriveStudioCredit(document: StudioCreditDocument): StudioCreditLayout {
  return layoutStudioCredit(studioCreditInput(document));
}

export function studioCreditPrimitives(layout: StudioCreditLayout): StudioPrimitive[] {
  return [
    ...(layout.strip ? [{ kind: 'rect' as const, box: layout.strip, fill: layout.paper, key: 'credit-strip' }] : []),
    ...layout.lines.map((line, index): StudioPrimitive => ({
      kind: 'text', text: line.text, point: { x: line.x, y: line.baseline }, size: layout.fontSizeMm, width: line.width,
      color: layout.color, font: 'sans', align: 'left', key: `credit-line-${index}`,
    })),
  ];
}

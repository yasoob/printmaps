import type { ElevationProfileFontFamily } from './elevationProfileLayout';
import { measuredProfileTextWidth, type ProfileFontWeight } from './elevationProfileFontMetrics';

export type ProfileTextRole = 'title' | 'distance-axis' | 'elevation-axis' | 'summary' | 'source' | 'marker';
export type ProfileText = Readonly<{
  role: ProfileTextRole;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  anchor?: 'start' | 'middle' | 'end';
}>;
export type ProfileTextBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;

export function profileTextWeight(role: ProfileTextRole): ProfileFontWeight {
  return role === 'title' || role === 'marker' ? 600 : 400;
}

function fallbackAdvance(character: string, family: ElevationProfileFontFamily, weight: ProfileFontWeight): number {
  const code = character.codePointAt(0) ?? 0;
  // Presentation-form ligatures can encode entire phrases in a single glyph.
  if (code >= 0xFB_50 && code <= 0xFD_FF) return 32;
  if (code > 127) return 2;
  if (family === 'mono') return 0.8;
  if (/[A-Z]/.test(character)) return weight === 600 ? 1.25 : 1.15;
  if (/[mw@%&#]/.test(character)) return 1.25;
  if (/[a-z]/.test(character)) return weight === 600 ? 0.95 : 0.85;
  return 0.8;
}

export function profileTextWidth(text: string, fontSize: number, family: ElevationProfileFontFamily, weight: ProfileFontWeight = 400): number {
  const measured = measuredProfileTextWidth(text, family, weight);
  if (measured !== undefined) return measured * fontSize;
  let width = 0;
  for (const character of text) width += fallbackAdvance(character, family, weight);
  return width * fontSize;
}

export function profileTextBounds(text: ProfileText, family: ElevationProfileFontFamily): ProfileTextBounds {
  const width = profileTextWidth(text.text, text.fontSize, family, profileTextWeight(text.role));
  const left = text.x - (text.anchor === 'end' ? width : (text.anchor === 'middle' ? width / 2 : 0));
  return { left, right: left + width, top: text.y - text.fontSize, bottom: text.y + text.fontSize * 0.3 };
}

export function hasProfileTextIntersection(a: ProfileTextBounds, b: ProfileTextBounds, gap = 6): boolean {
  return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
}

export function fitProfileLine(text: string, fontSize: number, width: number, style: Readonly<{ family: ElevationProfileFontFamily; weight: ProfileFontWeight }>): number {
  return Math.min(fontSize, width / Math.max(1, profileTextWidth(text, 1, style.family, style.weight)));
}

function wrapText(text: string, fontSize: number, width: number, family: ElevationProfileFontFamily): string[] {
  const lines: string[] = [];
  let line = '';
  const tokens = text.match(/\s+|\S+/gu) ?? [];
  for (const token of tokens) {
    if (line && profileTextWidth(line + token, fontSize, family, profileTextWeight('title')) > width) { lines.push(line); line = ''; }
    for (const character of token) {
      if (line && profileTextWidth(line + character, fontSize, family, profileTextWeight('title')) > width) { lines.push(line); line = ''; }
      line += character;
    }
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

function canFitTitle(lines: readonly string[], size: number, options: Readonly<{ width: number; height: number; family: ElevationProfileFontFamily }>) {
  return lines.length * size * 1.4 <= options.height
    && lines.every((line) => profileTextWidth(line, size, options.family, profileTextWeight('title')) <= options.width);
}

export function fitProfileTitle(text: string, options: Readonly<{ maximumFontSize: number; width: number; height: number; family: ElevationProfileFontFamily }>) {
  const { maximumFontSize, width, family } = options;
  const fullSizeLines = wrapText(text, maximumFontSize, width, family);
  if (canFitTitle(fullSizeLines, maximumFontSize, options)) {
    return { lines: fullSizeLines, fontSize: maximumFontSize, height: fullSizeLines.length * maximumFontSize * 1.4 };
  }
  let low = 0;
  let high = maximumFontSize;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const size = (low + high) / 2;
    if (canFitTitle(wrapText(text, size, width, family), size, options)) low = size;
    else high = size;
  }
  const fontSize = Math.min(maximumFontSize, Math.floor(low * 1000) / 1000);
  const lines = wrapText(text, fontSize, width, family);
  return { lines, fontSize, height: lines.length * fontSize * 1.4 };
}

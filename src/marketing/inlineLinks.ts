import { marketingPages, pagePath } from './registry';

/**
 * Inline link syntax for marketing copy: `[label](/path/)` or `[label](#anchor)`.
 * Only site-internal targets are allowed so copy can never inject markup or external URLs.
 */
const INLINE_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export type InlineSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string };

const LINKABLE_PATHS = new Set<string>(['/', '/editor/', ...marketingPages.map((entry) => pagePath(entry))]);

export function isLinkablePath(path: string): boolean {
  return LINKABLE_PATHS.has(path);
}

/**
Throws when a link points outside the site or at a page that is not registered.
*/
export function assertInlineTarget(href: string, source: string): void {
  if (href.startsWith('#')) {
    if (!/^#[\w-]+$/.test(href)) throw new Error(`Invalid anchor "${href}" in: ${source}`);
    return;
  }
  if (!href.startsWith('/')) {
    throw new Error(`Inline links must point at a site page or #anchor, got "${href}" in: ${source}`);
  }
  const [path = '', fragment] = href.split('#', 2);
  if (!isLinkablePath(path)) {
    throw new Error(`Inline link "${href}" is not a registered marketing page, "/" or "/editor/". Source: ${source}`);
  }
  if (fragment !== undefined && !/^[\w-]+$/.test(fragment)) throw new Error(`Invalid anchor "${href}" in: ${source}`);
}

export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_LINK)) {
    const [whole, label = '', href = ''] = match;
    const start = match.index ?? 0;
    assertInlineTarget(href, text);
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) });
    segments.push({ kind: 'link', text: label, href });
    cursor = start + whole.length;
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/**
Plain-text form for meta tags, JSON-LD and llms.txt: keeps the label, drops the target.
*/
export function stripInline(text: string): string {
  return text.replaceAll(INLINE_LINK, '$1');
}


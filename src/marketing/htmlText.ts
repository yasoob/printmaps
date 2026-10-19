/** Small helpers for pulling FAQ answers and tables out of rendered marketing pages as plain text. */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function htmlToText(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\s+([.,;:!?)])/g, '$1')
    .trim();
}

export type FaqText = { question: string; answer: string };

export function extractFaq(html: string): FaqText[] {
  const start = html.search(/<section[^>]*id="(?:questions|faq)"/);
  if (start === -1) return [];
  const end = html.indexOf('</section>', start);
  const section = html.slice(start, end === -1 ? undefined : end);
  return [...section.matchAll(/<details[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/details>/g)]
    .map(([, question = '', answer = '']) => ({ question: htmlToText(question), answer: htmlToText(answer) }));
}

/** First table inside <main>, as a Markdown table with its section heading. */
export function extractFirstTable(html: string): { heading: string; markdown: string } | undefined {
  const main = html.slice(Math.max(0, html.indexOf('<main')));
  const tableMatch = /<table[\s\S]*?<\/table>/.exec(main);
  if (!tableMatch) return undefined;
  const before = main.slice(0, tableMatch.index);
  const headings = [...before.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)];
  const heading = htmlToText(headings.at(-1)?.[1] ?? 'Table');
  const rows = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row = '']) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)]
    .map(([, cell = '']) => htmlToText(cell).replaceAll('|', '/')));
  if (rows.length < 2) return undefined;
  const [header = [], ...body] = rows;
  const markdown = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
  return { heading, markdown };
}

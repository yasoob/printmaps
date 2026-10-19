import { stripInline } from './inlineLinks';
import { faqItems, GITHUB_URL, SITE_NAME, SITE_URL } from './product';
import { productFactSections } from './productFacts';
import { HOME_PAGE, navigationGroups, pageUrl } from './registry';

const SUMMARY = `${SITE_NAME} is a free browser-based editor for print-ready maps and map posters. It needs no account and adds no watermark. Exports include 300 dpi PNG, exact-size PDF, layered SVG, layered PSD, MP4 map video and STL terrain relief.`;

function pageLines(): string[] {
  return navigationGroups().flatMap((group) => [
    `## ${group.label}`,
    '',
    ...group.pages.map((entry) => `- [${entry.navLabel}](${pageUrl(entry)}): ${stripInline(entry.summaryForLlms)}`),
    ...(group.id === 'project' ? [`- [Source code](${GITHUB_URL}): Public repository and issue tracker.`] : []),
    '',
  ]);
}

export function llmsText(): string {
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SUMMARY}`,
    '',
    'Projects are designed and exported in the browser and autosave on the device. Map data comes from OpenStreetMap contributors through OpenFreeMap and OpenMapTiles.',
    '',
    '## Start',
    '',
    `- [Homepage](${SITE_URL}/): ${stripInline(HOME_PAGE.description)}`,
    `- [Map editor](${SITE_URL}/editor/): Create and export a map in the browser.`,
    '',
    ...pageLines(),
    '## Optional',
    '',
    `- [Full text for language models](${SITE_URL}/llms-full.txt): Every product fact and FAQ answer on one page.`,
    '',
  ].join('\n');
}

export type PageExtras = {
  faq: readonly { question: string; answer: string }[];
  table?: { heading: string; markdown: string };
};

export function llmsFullText(extras: ReadonlyMap<string, PageExtras> = new Map()): string {
  const facts = productFactSections.flatMap((section) => [
    `### ${section.heading}`,
    '',
    ...section.facts.map((fact) => `- ${stripInline(fact)}`),
    '',
  ]);
  const pages = navigationGroups().flatMap((group) => group.pages.map((entry) => {
    const extra = extras.get(entry.slug);
    return [
      `### ${entry.navLabel}`,
      '',
      `URL: ${pageUrl(entry)}`,
      '',
      stripInline(entry.description),
      '',
      stripInline(entry.summaryForLlms),
      '',
      ...(extra?.table ? [`#### ${extra.table.heading}`, '', extra.table.markdown, ''] : []),
      ...(extra && extra.faq.length > 0 ? ['#### Questions', '', ...extra.faq.flatMap((item) => [`Q: ${item.question}`, `A: ${item.answer}`, ''])] : []),
    ].join('\n');
  }));
  const faq = faqItems.flatMap((item) => [`### ${item.question}`, '', stripInline(item.answer), '']);
  return [
    `# ${SITE_NAME}`,
    '',
    `> ${SUMMARY}`,
    '',
    `Website: ${SITE_URL}/`,
    `Editor: ${SITE_URL}/editor/`,
    `Source code: ${GITHUB_URL}`,
    '',
    '## Product facts',
    '',
    ...facts,
    '## Pages',
    '',
    ...pages,
    '## Frequently asked questions',
    '',
    ...faq,
  ].join('\n');
}

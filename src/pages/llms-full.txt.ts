import type { APIRoute } from 'astro';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { extractFaq, extractFirstTable } from '../marketing/htmlText';
import { llmsFullText, type PageExtras } from '../marketing/llms';
import { SITE_URL } from '../marketing/product';
import { marketingPages } from '../marketing/registry';

type AstroPageModule = { default: Parameters<AstroContainer['renderToString']>[0] };

const pageModules = import.meta.glob<AstroPageModule>('./*.astro');

async function renderPageExtras(): Promise<Map<string, PageExtras>> {
  const container = await AstroContainer.create({ astroConfig: { site: SITE_URL, trailingSlash: 'always' } });
  const extras = new Map<string, PageExtras>();
  for (const entry of marketingPages) {
    const load = pageModules[`./${entry.slug}.astro`];
    if (!load) continue;
    const module = await load();
    const html = await container.renderToString(module.default, {
      request: new Request(`${SITE_URL}/${entry.slug}/`),
      partial: false,
    });
    extras.set(entry.slug, { faq: extractFaq(html), table: extractFirstTable(html) });
  }
  return extras;
}

export const GET: APIRoute = async () => new Response(llmsFullText(await renderPageExtras()), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

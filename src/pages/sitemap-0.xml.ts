import type { APIRoute } from 'astro';
import { sitemapXml } from '../marketing/sitemap';

// Same list as /sitemap.xml, so a previously submitted sitemap-0.xml keeps working.
export const GET: APIRoute = () => new Response(sitemapXml(), {
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});

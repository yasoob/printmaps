import type { APIRoute } from 'astro';
import { sitemapIndexXml } from '../marketing/sitemap';

export const GET: APIRoute = () => new Response(sitemapIndexXml(), {
  headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});

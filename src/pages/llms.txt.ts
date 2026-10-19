import type { APIRoute } from 'astro';
import { llmsText } from '../marketing/llms';

export const GET: APIRoute = () => new Response(llmsText(), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});

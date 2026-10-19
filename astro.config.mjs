import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import path from 'node:path';
import process from 'node:process';
import { HOME_PAGE, marketingPages } from './src/marketing/registry.ts';

const clientEnvironment = Object.fromEntries(
  ['VITE_MAPBOX_PUBLIC_ACCESS', 'VITE_REACT_SCAN', 'VITE_TEST_INITIAL_PROJECT']
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [`import.meta.env.${name}`, JSON.stringify(process.env[name])]),
);
const isEndToEndTest = process.env.VITE_TEST_INITIAL_PROJECT === 'true';
const site = 'https://printmaps.yasoob.me';
const lastModifiedByUrl = new Map([
  [`${site}/`, HOME_PAGE.updated],
  ...marketingPages.map((entry) => [`${site}/${entry.slug}/`, entry.updated]),
]);
const sitemapPriority = (url) => {
  if (url === `${site}/`) return 1;
  if (url === `${site}/editor/`) return 0.9;
  const entry = marketingPages.find((candidate) => url === `${site}/${candidate.slug}/`);
  return entry?.group === 'project' ? 0.3 : 0.7;
};

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: {
    enabled: false,
  },
  integrations: [
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page),
      serialize: (item) => ({
        ...item,
        lastmod: lastModifiedByUrl.get(item.url) ?? item.lastmod,
        priority: sitemapPriority(item.url),
      }),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    define: clientEnvironment,
    optimizeDeps: {
      include: ['maplibre-contour'],
      exclude: ['maplibre-gl'],
    },
    server: {
      ...(isEndToEndTest ? { hmr: false } : {}),
      watch: {
        ignored: isEndToEndTest
          ? ['**/*']
          : ['**/docs/screenshots/**', '**/playwright-report/**', '**/test-results/**'],
      },
    },
  },
});

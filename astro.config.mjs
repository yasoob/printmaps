import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import path from 'node:path';
import process from 'node:process';
import { responsiveImages } from './src/integrations/responsiveImages.ts';

const clientEnvironment = Object.fromEntries(
  ['VITE_MAPBOX_PUBLIC_ACCESS', 'VITE_REACT_SCAN', 'VITE_TEST_INITIAL_PROJECT']
    .filter((name) => process.env[name] !== undefined)
    .map((name) => [`import.meta.env.${name}`, JSON.stringify(process.env[name])]),
);
const isEndToEndTest = process.env.VITE_TEST_INITIAL_PROJECT === 'true';
const site = 'https://printmaps.yasoob.me';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: {
    enabled: false,
  },
  integrations: [responsiveImages()],
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

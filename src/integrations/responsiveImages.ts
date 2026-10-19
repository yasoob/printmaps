import type { AstroIntegration } from 'astro';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const VARIANT_PATH = /\/_img\/(\d{2,4})\/(webp|png|jpe?g)\/([\w./-]+?)\.webp/g;
const ALLOWED_WIDTHS = new Set([480, 800, 1200, 1600]);

type Variant = { width: number; extension: string; imagePath: string };

function parseVariant(url: string): Variant | undefined {
  VARIANT_PATH.lastIndex = 0;
  const match = VARIANT_PATH.exec(url);
  if (!match || match.index !== 0) return undefined;
  const [, width = '', extension = '', imagePath = ''] = match;
  const parsedWidth = Number(width);
  if (!ALLOWED_WIDTHS.has(parsedWidth) || imagePath.split('/').includes('..')) return undefined;
  return { width: parsedWidth, extension, imagePath };
}

async function renderVariant(publicDir: string, variant: Variant): Promise<Buffer> {
  const source = path.join(publicDir, `${variant.imagePath}.${variant.extension}`);
  return sharp(source)
    .resize({ width: variant.width, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();
}

async function htmlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  }));
  return nested.flat();
}

/** Serves and builds resized WebP copies of public/ images referenced as `/_img/<w>/<ext>/<path>.webp`. */
export function responsiveImages(): AstroIntegration {
  let publicDir = '';
  return {
    name: 'print-map-studio:responsive-images',
    hooks: {
      'astro:config:done': ({ config }) => {
        publicDir = path.resolve(new URL(config.publicDir).pathname);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const variant = request.url ? parseVariant(request.url.split('?', 1)[0] ?? '') : undefined;
          if (!variant) {
            next();
            return;
          }
          try {
            const body = await renderVariant(publicDir, variant);
            response.setHeader('Content-Type', 'image/webp');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(body);
          } catch {
            response.statusCode = 404;
            response.end();
          }
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const outDir = path.resolve(dir.pathname);
        const files = await htmlFiles(outDir);
        const urls = new Set<string>();
        for (const file of files) {
          const html = await readFile(file, 'utf8');
          for (const match of html.matchAll(VARIANT_PATH)) urls.add(match[0]);
        }
        let written = 0;
        for (const url of urls) {
          const variant = parseVariant(url);
          if (!variant) throw new Error(`Invalid responsive image URL ${url}`);
          const target = path.join(outDir, url);
          const exists = await stat(target).then(() => true, () => false);
          if (exists) continue;
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, await renderVariant(publicDir, variant));
          written += 1;
        }
        logger.info(`${written} responsive image variants written`);
      },
    },
  };
}

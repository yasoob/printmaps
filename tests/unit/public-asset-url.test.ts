import { readFileSync } from 'node:fs';
import { publicAssetUrl } from '../../src/domain/publicAssetUrl';

describe('public deployment asset paths', () => {
  it('prefixes local assets with the configured Vite base path', () => {
    expect(publicAssetUrl('styles/paper.json', '/printmaps/')).toBe('/printmaps/styles/paper.json');
    expect(publicAssetUrl('/data/administrative/index.json', '/printmaps/')).toBe('/printmaps/data/administrative/index.json');
    expect(publicAssetUrl('style-thumbnails/paper.png', '/')).toBe('/style-thumbnails/paper.png');
    expect(publicAssetUrl('styles/paper.json', './')).toBe('./styles/paper.json');
  });

  it('builds static Pages output for the canonical custom domain', () => {
    const packageDefinition = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const astroConfiguration = readFileSync('astro.config.mjs', 'utf8');
    expect(packageDefinition.scripts['build:pages']).toBe('npm run build');
    expect(astroConfiguration).toContain("site: 'https://printmaps.yasoob.me'");
    expect(astroConfiguration).toContain("output: 'static'");
  });
});

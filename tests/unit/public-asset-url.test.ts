import { publicAssetUrl } from '../../src/domain/publicAssetUrl';

describe('public deployment asset paths', () => {
  it('prefixes local assets with the configured Vite base path', () => {
    expect(publicAssetUrl('styles/paper.json', '/printmaps/')).toBe('/printmaps/styles/paper.json');
    expect(publicAssetUrl('/data/administrative/index.json', '/printmaps/')).toBe('/printmaps/data/administrative/index.json');
    expect(publicAssetUrl('style-thumbnails/paper.png', '/')).toBe('/style-thumbnails/paper.png');
  });
});

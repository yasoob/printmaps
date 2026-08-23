import { mapStyleUrl } from '../../src/map/mapStyles';

describe('open map style registry', () => {
  it('resolves each canonical preset to a same-origin vendored style', () => {
    expect(mapStyleUrl('liberty')).toBe('/styles/liberty.json');
    expect(mapStyleUrl('positron')).toBe('/styles/positron.json');
    expect(mapStyleUrl('bright')).toBe('/styles/bright.json');
  });
});
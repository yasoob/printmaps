import { applyMapLocation } from '../../src/map/MapLocationRequest';

describe('map location requests', () => {
  it('centers at a valid browser position without zooming an already closer map out', () => {
    const easeTo = vi.fn();
    const map = { easeTo, getZoom: () => 15.5 };

    applyMapLocation(map, [16.3725, 48.2084]);

    expect(easeTo).toHaveBeenCalledWith({
      center: [16.3725, 48.2084],
      duration: 0,
      zoom: 15.5,
    });
    applyMapLocation(map, [181, 48.2]);
    expect(easeTo).toHaveBeenCalledOnce();
  });
});

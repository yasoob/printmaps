import { createInitialProjectDocument } from '../../src/domain/project';
import {
  BASEMAP_ATTRIBUTION,
  MAPBOX_ATTRIBUTION,
  projectAttributionText,
} from '../../src/domain/projectAttributions';

describe('project attribution', () => {
  it('adds Mapbox print credit when canonical content uses Isochrone API data', () => {
    const document = createInitialProjectDocument();
    const area = document.layers.find(({ type }) => type === 'shape');
    if (!area) throw new Error('Area fixture is unavailable.');
    area.provenance = {
      provider: 'mapbox',
      service: 'isochrone-v1',
      center: [16.3725, 48.2084],
      profile: 'walking',
      minutes: 15,
    };

    expect(projectAttributionText(document)).toBe(`${BASEMAP_ATTRIBUTION} · ${MAPBOX_ATTRIBUTION}`);
  });

  it('does not claim Mapbox data for provider-independent projects', () => {
    const document = createInitialProjectDocument();

    expect(projectAttributionText(document)).toBe(BASEMAP_ATTRIBUTION);
  });
});

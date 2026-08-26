import { describe, expect, it } from 'vitest';
import { createInitialProjectDocument } from '../../src/domain/project';
import { parseProjectFileText } from '../../src/domain/projectFile';

describe('portable map-matching provenance', () => {
  it('round-trips compact map-matching provenance on a current route', () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find(({ id }) => id === 'route-01');
    if (!route) throw new Error('Route fixture is unavailable.');
    route.provenance = {
      provider: 'mapbox', service: 'map-matching-v5', profile: 'cycling', confidence: 0.84, sourcePointCount: 4,
    };

    expect(parseProjectFileText(JSON.stringify(document))).toEqual(document);
  });
});

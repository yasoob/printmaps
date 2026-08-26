import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type Position = [number, number];
type PolygonGeometry = {
  type: 'Polygon';
  coordinates: Position[][];
};
type MultiPolygonGeometry = {
  type: 'MultiPolygon';
  coordinates: Position[][][];
};
type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;
type BoundaryRecord = {
  id: string;
  name: string;
  sourceId: string;
  geometry: BoundaryGeometry;
};
type CountryIndexEntry = {
  id: string;
  name: string;
  bounds: [number, number, number, number];
  levels: ('country' | 'region')[];
  shard: string;
};
type CatalogueIndex = {
  schemaVersion: 1;
  sourceVersion: string;
  countries: CountryIndexEntry[];
};
type SourceManifest = {
  basename: string;
  bytes: number;
  sha256: string;
  url: string;
  version: string;
};
type CatalogueManifest = {
  schemaVersion: 1;
  sources: {
    admin0: SourceManifest;
    admin1: SourceManifest;
  };
  generated: { admin1Features: number; countries: number };
};
type CountryShard = {
  schemaVersion: 1;
  country: BoundaryRecord;
  regions: BoundaryRecord[];
};

const catalogueDirectory = path.resolve('public/data/administrative');
const expectedSources = {
  admin0: {
    basename: 'ne_10m_admin_0_countries',
    bytes: 4_930_492,
    sha256: 'ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6',
    url: 'https://naturalearth.s3.amazonaws.com/5.1.1/10m_cultural/ne_10m_admin_0_countries.zip',
    version: '5.1.1',
  },
  admin1: {
    basename: 'ne_10m_admin_1_states_provinces',
    bytes: 14_909_524,
    sha256: 'efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05',
    url: 'https://naturalearth.s3.amazonaws.com/5.1.1/10m_cultural/ne_10m_admin_1_states_provinces.zip',
    version: '5.1.1',
  },
} satisfies CatalogueManifest['sources'];

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function polygons(geometry: BoundaryGeometry): Position[][][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

function geometryBounds(geometry: BoundaryGeometry): [number, number, number, number] {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons(geometry)) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        bounds[0] = Math.min(bounds[0], longitude);
        bounds[1] = Math.min(bounds[1], latitude);
        bounds[2] = Math.max(bounds[2], longitude);
        bounds[3] = Math.max(bounds[3], latitude);
      }
    }
  }
  return bounds;
}

function expectValidGeometry(geometry: BoundaryGeometry) {
  const geometryPolygons = polygons(geometry);
  expect(geometryPolygons.length).toBeGreaterThan(0);
  for (const polygon of geometryPolygons) {
    expect(polygon.length).toBeGreaterThan(0);
    for (const ring of polygon) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring.at(-1)).toEqual(ring[0]);
      let doubledArea = 0;
      for (let index = 1; index < ring.length; index += 1) {
        const [longitude, latitude] = ring[index - 1];
        const [nextLongitude, nextLatitude] = ring[index];
        doubledArea += longitude * nextLatitude - nextLongitude * latitude;
      }
      expect(Math.abs(doubledArea)).toBeGreaterThan(0);
      expect(ring.every(([longitude, latitude]) => (
        Number.isFinite(longitude)
        && Number.isFinite(latitude)
        && longitude >= -180
        && longitude <= 180
        && latitude >= -90
        && latitude <= 90
      ))).toBe(true);
    }
  }
}

describe('generated global administrative catalogue', () => {
  it('validates the generated global catalogue and every lazy country shard', async () => {
    const manifest = await readJson<CatalogueManifest>(path.resolve(catalogueDirectory, 'manifest.json'));
    const index = await readJson<CatalogueIndex>(path.resolve(catalogueDirectory, 'index.json'));

    expect(manifest).toMatchObject({
      schemaVersion: 1,
      sources: expectedSources,
      generated: { admin1Features: 4596, countries: 258 },
    });
    expect(index.schemaVersion).toBe(1);
    expect(index.sourceVersion).toBe('Natural Earth 5.1.1');
    expect(index.countries).toHaveLength(258);
    expect(index.countries).toHaveLength(manifest.generated.countries);
    expect(manifest.generated.admin1Features).toBe(4596);

    const countryIds = index.countries.map(({ id }) => id);
    expect(new Set(countryIds).size).toBe(countryIds.length);
    for (let index = 1; index < countryIds.length; index += 1) {
      expect(countryIds[index - 1].localeCompare(countryIds[index])).toBeLessThan(0);
    }

    const expectedShardFiles = index.countries.map(({ shard }) => shard.replace('countries/', ''));
    const actualShardFiles = await readdir(path.resolve(catalogueDirectory, 'countries'));
    expect(actualShardFiles).toHaveLength(expectedShardFiles.length);
    expect(new Set(actualShardFiles)).toEqual(new Set(expectedShardFiles));

    const globalBoundaryIds = new Set<string>();
    const globalSourceIds = new Set<string>();
    let admin1FeatureCount = 0;
    for (const country of index.countries) {
      expect(country.id).toMatch(/^[A-Z0-9]{3}$/);
      expect(country.shard).toBe(`countries/${country.id}.json`);
      expect(country.bounds).toHaveLength(4);
      expect(country.bounds.every((value) => Number.isFinite(value))).toBe(true);
      const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] = country.bounds;
      expect(minimumLongitude).toBeGreaterThanOrEqual(-180);
      expect(minimumLatitude).toBeGreaterThanOrEqual(-90);
      expect(maximumLongitude).toBeLessThanOrEqual(180);
      expect(maximumLatitude).toBeLessThanOrEqual(90);
      expect(minimumLongitude).toBeLessThanOrEqual(maximumLongitude);
      expect(minimumLatitude).toBeLessThanOrEqual(maximumLatitude);
      expect(country.levels[0]).toBe('country');

      const shard = await readJson<CountryShard>(path.resolve(catalogueDirectory, country.shard));
      expect(shard.schemaVersion).toBe(1);
      expect(shard.country).toMatchObject({ id: country.id, name: country.name });
      expectValidGeometry(shard.country.geometry);
      expect(country.bounds).toEqual(geometryBounds(shard.country.geometry));
      expect(country.levels.includes('region')).toBe(shard.regions.length > 0);
      admin1FeatureCount += shard.regions.length;

      for (const boundary of [shard.country, ...shard.regions]) {
        expect(boundary.id.trim()).not.toBe('');
        expect(boundary.name.trim()).not.toBe('');
        expect(boundary.sourceId.trim()).not.toBe('');
        expect(globalBoundaryIds.has(boundary.id)).toBe(false);
        globalBoundaryIds.add(boundary.id);
        expect(globalSourceIds.has(boundary.sourceId)).toBe(false);
        globalSourceIds.add(boundary.sourceId);
        expectValidGeometry(boundary.geometry);
      }
      for (const region of shard.regions) {
        expect(region.id).toMatch(/^(?:[A-Z]{2}-[A-Z0-9]{1,3}|NE-ADM1-.+)$/);
      }
    }
    expect(admin1FeatureCount).toBe(manifest.generated.admin1Features);
  });
});

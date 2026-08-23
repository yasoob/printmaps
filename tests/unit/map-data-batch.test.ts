import type { ContentLayer } from '../../src/domain/project';
import {
  MAX_MAP_DATA_BATCH_BYTES,
  MAX_MAP_DATA_FILES,
  parseMapDataFiles,
} from '../../src/import/mapDataBatch';

const pointFeature = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: 'Shared point' },
    geometry: { type: 'Point', coordinates: [16.37, 48.21] },
  }],
});

function textFile(name: string, text: string, size = 0) {
  const file = new File([], name, { type: 'application/geo+json' });
  Object.defineProperties(file, {
    size: { value: size },
    text: { configurable: true, value: () => Promise.resolve(text) },
  });
  return file;
}

describe('map-data batch import', () => {
  it('parses files sequentially with unique layer IDs', async () => {
    const batch = await parseMapDataFiles([
      textFile('first.geojson', pointFeature),
      textFile('second.geojson', pointFeature),
    ], []);

    expect(batch.files).toEqual([
      { format: 'GeoJSON', layerCount: 1, name: 'first.geojson' },
      { format: 'GeoJSON', layerCount: 1, name: 'second.geojson' },
    ]);
    expect(batch.layers.map(({ id }) => id)).toEqual(['geojson-shared-point', 'geojson-shared-point-2']);
  });

  it('rejects file-count and total-byte limits before reading any file', async () => {
    const tooMany = Array.from({ length: MAX_MAP_DATA_FILES + 1 }, (_, index) => (
      textFile(`point-${index}.geojson`, pointFeature)
    ));
    await expect(parseMapDataFiles(tooMany, [])).rejects.toThrow(`at most ${MAX_MAP_DATA_FILES}`);

    const first = textFile('first.geojson', pointFeature, MAX_MAP_DATA_BATCH_BYTES);
    const second = textFile('second.geojson', pointFeature, 1);
    await expect(parseMapDataFiles([first, second], [])).rejects.toThrow('20 MB or smaller');
  });

  it('preflights every selected file before starting any file read', async () => {
    const readValid = vi.fn().mockResolvedValue(pointFeature);
    const valid = textFile('valid.geojson', pointFeature);
    Object.defineProperty(valid, 'text', { value: readValid });

    await expect(parseMapDataFiles([
      valid,
      textFile('unsupported.txt', '{}'),
    ], [])).rejects.toThrow('unsupported.txt');
    expect(readValid).not.toHaveBeenCalled();
  });

  it('waits for every started read to settle before rejecting a batch', async () => {
    let finishSibling: ((text: string) => void) | undefined;
    const failed = textFile('failed.geojson', pointFeature);
    const sibling = textFile('sibling.geojson', pointFeature);
    Object.defineProperty(failed, 'text', { value: vi.fn().mockRejectedValue(new Error('read failed')) });
    Object.defineProperty(sibling, 'text', {
      value: () => new Promise<string>((resolve) => { finishSibling = resolve; }),
    });
    const batch = parseMapDataFiles([failed, sibling], []);
    const settled = vi.fn();
    void batch.then(settled).catch(settled);

    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finishSibling?.(pointFeature);
    await expect(batch).rejects.toThrow('read failed');
  });

  it('keeps a rejected batch outside an existing canonical project', async () => {
    const existing: ContentLayer[] = [{
      id: 'existing-point',
      name: 'Existing point',
      type: 'poi',
      visible: true,
      locked: false,
      opacity: 100,
      geometry: { type: 'Point', coordinates: [16.3, 48.2] },
    }];

    await expect(parseMapDataFiles([
      textFile('valid.geojson', pointFeature),
      textFile('unsupported.txt', '{}'),
    ], existing)).rejects.toThrow('unsupported.txt');
    expect(existing).toHaveLength(1);
    expect(existing[0].id).toBe('existing-point');
  });
});

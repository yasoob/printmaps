import {
  loadGeneratedAdministrativeIndex,
  loadGeneratedAdministrativeShard,
} from '../../src/domain/generatedAdministrativeCatalogue';

const square = (south: number) => ({
  type: 'Polygon' as const,
  coordinates: [[
    [10, south],
    [11, south],
    [11, south + 0.25],
    [10, south],
  ]],
});

it('cancels an index response stream as soon as it exceeds the byte limit', async () => {
  const cancel = vi.fn().mockResolvedValue(undefined);
  const read = vi.fn()
    .mockResolvedValueOnce({ done: false, value: new Uint8Array(256_000) })
    .mockResolvedValueOnce({ done: false, value: new Uint8Array(1) });
  const text = vi.fn().mockResolvedValue('x'.repeat(256_001));
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    body: { getReader: () => ({ cancel, read, releaseLock: vi.fn() }) },
    headers: new Headers(),
    ok: true,
    status: 200,
    text,
  } as unknown as Response);

  try {
    await expect(loadGeneratedAdministrativeIndex()).rejects.toThrow('Boundary data exceeds the safe size limit.');
    expect(text).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    fetchMock.mockRestore();
  }
});

it('rejects generated boundaries outside the canonical Mercator latitude', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
    schemaVersion: 1,
    country: { id: 'TST', name: 'Testland', sourceId: 'NE-TST', geometry: square(85) },
    regions: [{ id: 'TST-1', name: 'Polar', sourceId: 'NE-TST-1', geometry: square(86) }],
  }));

  try {
    await expect(loadGeneratedAdministrativeShard({
      id: 'TST',
      name: 'Testland',
      bounds: [10, 85, 11, 85.051129],
      levels: ['country', 'region'],
      shard: 'countries/TST.json',
    }, 'Test source')).rejects.toThrow('latitude must be between -85.051129 and 85.051129');
  } finally {
    fetchMock.mockRestore();
  }
});

it('rejects generated catalogue strings beyond the UI-safe limit', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
    schemaVersion: 1,
    sourceVersion: 'Test source',
    countries: [{
      id: 'TST',
      name: 'x'.repeat(201),
      bounds: [10, 40, 11, 41],
      levels: ['country', 'region'],
      shard: 'countries/TST.json',
    }],
  }));

  try {
    await expect(loadGeneratedAdministrativeIndex()).rejects.toThrow('Country TST name must be 200 characters or fewer.');
  } finally {
    fetchMock.mockRestore();
  }
});

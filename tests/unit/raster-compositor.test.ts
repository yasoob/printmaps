import type { ExportTile, ExportTilePlan } from '../../src/export/preflight';
import {
  composeRasterTiles,
  type RenderedRasterTile,
} from '../../src/export/rasterCompositor';

function tile(overrides: Partial<ExportTile> = {}): ExportTile {
  return {
    index: 0,
    column: 0,
    row: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    renderX: 0,
    renderY: 0,
    renderWidth: 100,
    renderHeight: 80,
    cropX: 0,
    cropY: 0,
    ...overrides,
  };
}

function plan(tiles: readonly ExportTile[], overrides: Partial<ExportTilePlan> = {}): ExportTilePlan {
  return {
    mode: 'single',
    stripDirection: null,
    columns: 1,
    rows: 1,
    overlapPx: 0,
    tiles,
    ...overrides,
  };
}

describe('raster tile composition', () => {
  it('maps an overlapped render region to its exact crop and destination', async () => {
    const events: unknown[] = [];
    const resource: RenderedRasterTile<string> = {
      value: 'pixels-0',
      release: () => {
        events.push('release-0');
      },
    };

    await composeRasterTiles(plan([tile({
      index: 3,
      column: 1,
      row: 1,
      x: 100,
      y: 80,
      width: 60,
      height: 40,
      renderX: 84,
      renderY: 64,
      renderWidth: 76,
      renderHeight: 56,
      cropX: 16,
      cropY: 16,
    })]), {
      renderTile: (request) => {
        events.push(['render', request]);
        return resource;
      },
      writeTile: (request) => {
        events.push(['write', request]);
      },
    });

    expect(events).toEqual([
      ['render', {
        tile: { index: 3, column: 1, row: 1 },
        region: { x: 84, y: 64, width: 76, height: 56 },
        signal: undefined,
      }],
      ['write', {
        tile: { index: 3, column: 1, row: 1 },
        resource: 'pixels-0',
        source: { x: 16, y: 16, width: 60, height: 40 },
        destination: { x: 100, y: 80, width: 60, height: 40 },
        signal: undefined,
      }],
      'release-0',
    ]);
  });

  it('reports monotonic progress after each completed tile', async () => {
    const progress: unknown[] = [];
    const tiles = [
      tile(),
      tile({ index: 1, row: 1, y: 80, renderY: 80 }),
      tile({ index: 2, row: 2, y: 160, renderY: 160 }),
    ];

    await composeRasterTiles(plan(tiles, {
      mode: 'strips',
      stripDirection: 'horizontal',
      rows: 3,
    }), {
      renderTile: ({ tile: currentTile }) => ({
        value: `pixels-${currentTile.index}`,
        release: () => { /* Nothing to release in this test. */ },
      }),
      writeTile: () => { /* Progress is the observable behavior in this test. */ },
      onProgress: (value) => {
        progress.push(value);
      },
    });

    expect(progress).toEqual([
      { completedTiles: 1, totalTiles: 3, fraction: 1 / 3, tile: { index: 0, column: 0, row: 0 } },
      { completedTiles: 2, totalTiles: 3, fraction: 2 / 3, tile: { index: 1, column: 0, row: 1 } },
      { completedTiles: 3, totalTiles: 3, fraction: 1, tile: { index: 2, column: 0, row: 2 } },
    ]);
  });
});

describe('raster tile cancellation', () => {
  it('cancels before starting any tile work with a stable abort error', async () => {
    const controller = new AbortController();
    const events: string[] = [];
    controller.abort(new Error('unstable caller reason'));

    const composition = composeRasterTiles(plan([tile()]), {
      renderTile: () => {
        events.push('render');
        return {
          value: 'pixels',
          release: () => {
            events.push('release');
          },
        };
      },
      writeTile: () => {
        events.push('write');
      },
    }, { signal: controller.signal });
    await expect(composition).rejects.toMatchObject({
      name: 'AbortError',
      message: 'Raster composition was cancelled.',
    });
    expect(events).toEqual([]);
  });

  it('releases a rendered tile when cancelled before writing it', async () => {
    const controller = new AbortController();
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile()]), {
      renderTile: () => {
        events.push('render');
        controller.abort();
        return {
          value: 'pixels',
          release: () => {
            events.push('release');
          },
        };
      },
      writeTile: () => {
        events.push('write');
      },
      onProgress: () => {
        events.push('progress');
      },
    }, { signal: controller.signal });
    await expect(composition).rejects.toMatchObject({ name: 'AbortError' });
    expect(events).toEqual(['render', 'release']);
  });

  it('stops between completed writes and progress without retaining the tile', async () => {
    const controller = new AbortController();
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile(), tile({ index: 1, column: 1, x: 100 })]), {
      renderTile: ({ tile: currentTile }) => {
        events.push(`render-${currentTile.index}`);
        return {
          value: `pixels-${currentTile.index}`,
          release: () => {
            events.push(`release-${currentTile.index}`);
          },
        };
      },
      writeTile: ({ tile: currentTile }) => {
        events.push(`write-${currentTile.index}`);
        controller.abort();
      },
      onProgress: () => {
        events.push('progress');
      },
    }, { signal: controller.signal });
    await expect(composition).rejects.toMatchObject({ name: 'AbortError' });
    expect(events).toEqual(['render-0', 'write-0', 'release-0']);
  });

  it('checks cancellation after releasing a completed tile', async () => {
    const controller = new AbortController();
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile()]), {
      renderTile: () => ({
        value: 'pixels',
        release: () => {
          events.push('release');
          controller.abort();
        },
      }),
      writeTile: () => {
        events.push('write');
      },
      onProgress: () => {
        events.push('progress');
      },
    }, { signal: controller.signal });
    await expect(composition).rejects.toMatchObject({ name: 'AbortError' });
    expect(events).toEqual(['write', 'release']);
  });

  it('checks cancellation after progress before rendering the next tile', async () => {
    const controller = new AbortController();
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile(), tile({ index: 1, row: 1, y: 80 })]), {
      renderTile: ({ tile: currentTile }) => {
        events.push(`render-${currentTile.index}`);
        return { value: 'pixels', release: () => { /* Nothing to release. */ } };
      },
      writeTile: ({ tile: currentTile }) => {
        events.push(`write-${currentTile.index}`);
      },
      onProgress: () => {
        events.push('progress');
        controller.abort();
      },
    }, { signal: controller.signal });
    await expect(composition).rejects.toMatchObject({ name: 'AbortError' });
    expect(events).toEqual(['render-0', 'write-0', 'progress']);
  });
});

describe('raster tile resource lifecycle', () => {
  it('holds at most one rendered tile and preserves preflight plan order', async () => {
    const events: string[] = [];
    let activeResources = 0;
    let maximumActiveResources = 0;
    const tiles = [
      tile(),
      tile({ index: 1, column: 1, x: 100, renderX: 100 }),
      tile({ index: 2, row: 1, y: 80, renderY: 80 }),
    ];

    await composeRasterTiles(plan(tiles, { mode: 'tiles', columns: 2, rows: 2 }), {
      renderTile: ({ tile: currentTile }) => {
        events.push(`render-${currentTile.index}`);
        activeResources += 1;
        maximumActiveResources = Math.max(maximumActiveResources, activeResources);
        return {
          value: `pixels-${currentTile.index}`,
          release: () => {
            events.push(`release-${currentTile.index}`);
            activeResources -= 1;
          },
        };
      },
      writeTile: ({ tile: currentTile }) => {
        events.push(`write-${currentTile.index}`);
      },
    });

    expect(events).toEqual([
      'render-0', 'write-0', 'release-0',
      'render-1', 'write-1', 'release-1',
      'render-2', 'write-2', 'release-2',
    ]);
    expect(maximumActiveResources).toBe(1);
    expect(activeResources).toBe(0);
  });

  it('releases the tile and preserves the write failure identity', async () => {
    const failure = new Error('write failed');
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile()]), {
      renderTile: () => ({
        value: 'pixels',
        release: () => {
          events.push('release');
        },
      }),
      writeTile: () => {
        events.push('write');
        throw failure;
      },
      onProgress: () => {
        events.push('progress');
      },
    });
    await expect(composition).rejects.toBe(failure);
    expect(events).toEqual(['write', 'release']);
  });

  it('does not mask a write failure when release also fails', async () => {
    const writeFailure = new Error('write failed');
    const releaseFailure = new Error('release failed');
    const events: string[] = [];

    const composition = composeRasterTiles(plan([tile()]), {
      renderTile: () => ({
        value: 'pixels',
        release: () => {
          events.push('release');
          throw releaseFailure;
        },
      }),
      writeTile: () => {
        events.push('write');
        throw writeFailure;
      },
    });
    await expect(composition).rejects.toBe(writeFailure);
    expect(events).toEqual(['write', 'release']);
  });
});

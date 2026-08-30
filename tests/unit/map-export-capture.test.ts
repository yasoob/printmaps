import type { MapContentAdapter } from '../../src/map/MapContentAdapter';
import { captureBasemapOnly } from '../../src/map/MapExportCapture';

function adapter(events: string[]): MapContentAdapter {
  return {
    destroy: vi.fn(),
    hitTest: vi.fn(),
    setExportVisibility: vi.fn((isVisible: boolean) => {
      events.push(`content:${isVisible}`);
      return true;
    }),
    sync: vi.fn(() => 'synced' as const),
  };
}

describe('basemap-only map capture', () => {
  it('temporarily shows a hidden basemap and restores canonical visibility', async () => {
    const events: string[] = [];
    const surface = document.createElement('canvas');
    surface.width = 20;
    surface.height = 10;
    const controller = new AbortController();

    const result = await captureBasemapOnly(
      adapter(events),
      () => {
        events.push('capture');
        return Promise.resolve({ blob: new Blob(), width: 20, height: 10, surface });
      },
      (signal) => {
        events.push(signal ? 'wait:capture' : 'wait:restore');
        return Promise.resolve();
      },
      {
        onRestoreFailure: vi.fn(),
        setBasemapVisibility: (override) => {
          events.push(`basemap:${String(override)}`);
          return true;
        },
        signal: controller.signal,
      },
    );

    expect(result.surface).toBe(surface);
    expect(events).toEqual([
      'basemap:true',
      'content:false',
      'wait:capture',
      'capture',
      'basemap:null',
      'content:true',
      'wait:restore',
    ]);
  });

  it('withdraws a capture if canonical basemap visibility cannot be restored', async () => {
    const surface = document.createElement('canvas');
    surface.width = 20;
    surface.height = 10;
    const onRestoreFailure = vi.fn();

    await expect(captureBasemapOnly(
      adapter([]),
      () => Promise.resolve({ blob: new Blob(), width: 20, height: 10, surface }),
      () => Promise.resolve(),
      {
        onRestoreFailure,
        setBasemapVisibility: (override) => override !== null,
      },
    )).rejects.toThrow('basemap could not be restored');

    expect(onRestoreFailure).toHaveBeenCalledOnce();
    expect(surface).toMatchObject({ width: 0, height: 0 });
  });
});

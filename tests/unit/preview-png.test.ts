import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturePrintFramePng, startPreviewDownload } from '../../src/export/previewPng';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
});

function installCanvasContext(measuredWidth = 180) {
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: measuredWidth } as TextMetrics)),
    set fillStyle(_value: string) {},
    set font(_value: string) {},
    set textBaseline(_value: CanvasTextBaseline) {},
    set globalAlpha(_value: number) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['png'], { type: 'image/png' }));
  });
  return context;
}

function createFixture(frameRect = rect(50, 40, 300, 200)) {
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 800;
  mapCanvas.height = 600;
  vi.spyOn(mapCanvas, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 400, 300));
  const frame = document.createElement('div');
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(frameRect);
  return { mapCanvas, frame };
}

describe('preview PNG export', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('crops the print frame and writes bounded map attribution into the PNG', async () => {
    const context = installCanvasContext(900);
    const { mapCanvas, frame } = createFixture();
    const attribution = '© OpenStreetMap contributors — long attribution text that must remain inside the image';

    const result = await capturePrintFramePng(mapCanvas, frame, attribution);

    expect(result).toMatchObject({ width: 600, height: 400 });
    expect(context.drawImage).toHaveBeenCalledWith(mapCanvas, 100, 80, 600, 400, 0, 0, 600, 400);
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledWith(attribution, expect.any(Number), expect.any(Number), expect.any(Number));
    const maxWidth = context.fillText.mock.calls[0][3] as number;
    expect(maxWidth).toBeLessThanOrEqual(result.width - 8);
  });

  it('projects map coordinates into normalized print-frame positions', async () => {
    installCanvasContext();
    const { mapCanvas, frame } = createFixture();

    const result = await capturePrintFramePng(
      mapCanvas,
      frame,
      '© OpenStreetMap contributors',
      { projectToCanvas: ([longitude, latitude]) => ({ x: longitude * 10, y: latitude * 10 }) },
    );

    expect(result.projectToFrame?.([20, 14])).toEqual({ x: 0.5, y: 0.5 });
    expect(result.projectToFrame?.([5, 4])).toEqual({ x: 0, y: 0 });
  });

  it('omits the raster attribution strip when the caller will add vector attribution', async () => {
    const context = installCanvasContext();
    const { mapCanvas, frame } = createFixture();

    await capturePrintFramePng(
      mapCanvas,
      frame,
      '© OpenStreetMap contributors',
      { isAttributionIncluded: false },
    );

    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
  });

  it('exports only the actual intersection when the frame is partially outside the canvas', async () => {
    const context = installCanvasContext();
    const { mapCanvas, frame } = createFixture(rect(-10, 20, 100, 40));

    const result = await capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors');

    expect(result).toMatchObject({ width: 180, height: 80 });
    expect(context.drawImage).toHaveBeenCalledWith(mapCanvas, 0, 40, 180, 80, 0, 0, 180, 80);
  });

  it.each([
    ['a frame outside the canvas', rect(450, 20, 60, 40), 800, 600],
    ['a zero-width backing store', rect(10, 10, 60, 40), 0, 600],
  ])('rejects %s', async (_label, frameRect, canvasWidth, canvasHeight) => {
    installCanvasContext();
    const { mapCanvas, frame } = createFixture(frameRect);
    mapCanvas.width = canvasWidth;
    mapCanvas.height = canvasHeight;

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('print frame is not ready');
  });

  it('rejects an unsafe crop before allocating an output canvas', async () => {
    installCanvasContext();
    const { mapCanvas, frame } = createFixture(rect(0, 0, 400, 300));
    mapCanvas.width = 50_000;
    mapCanvas.height = 3000;
    const createElement = vi.spyOn(document, 'createElement');

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('too large to export safely');
    expect(createElement).not.toHaveBeenCalledWith('canvas');
  });

  it('rejects a crop too small to contain map content and attribution', async () => {
    installCanvasContext();
    const { mapCanvas, frame } = createFixture(rect(0, 0, 400, 1));

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('too small');
  });

  it('rejects export when required attribution is missing', async () => {
    installCanvasContext();
    const { mapCanvas, frame } = createFixture();

    await expect(capturePrintFramePng(mapCanvas, frame, ' '.repeat(3))).rejects.toThrow('attribution is unavailable');
  });

  it('reports canvas rendering failures through the exporter promise', async () => {
    const context = installCanvasContext();
    context.drawImage.mockImplementation(() => { throw new DOMException('Tainted canvas', 'SecurityError'); });
    const { mapCanvas, frame } = createFixture();
    const createElement = vi.spyOn(document, 'createElement');

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('could not render the PNG');
    const output = createElement.mock.results[0]?.value as HTMLCanvasElement;
    expect(output).toMatchObject({ width: 0, height: 0 });
  });

  it('releases the allocated output when a canvas context is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { mapCanvas, frame } = createFixture();
    const createElement = vi.spyOn(document, 'createElement');

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('PNG export is unavailable');
    const output = createElement.mock.results[0]?.value as HTMLCanvasElement;
    expect(output).toMatchObject({ width: 0, height: 0 });
  });

  it('reports canvas encoding failures', async () => {
    installCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    const { mapCanvas, frame } = createFixture();
    const createElement = vi.spyOn(document, 'createElement');

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('could not create the PNG');
    const output = createElement.mock.results[0]?.value as HTMLCanvasElement;
    expect(output).toMatchObject({ width: 0, height: 0 });
  });

  it('releases the allocated output when canvas encoding throws', async () => {
    installCanvasContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => { throw new DOMException('Encoding failed'); });
    const { mapCanvas, frame } = createFixture();
    const createElement = vi.spyOn(document, 'createElement');

    await expect(capturePrintFramePng(mapCanvas, frame, '© OpenStreetMap contributors'))
      .rejects.toThrow('could not create the PNG');
    const output = createElement.mock.results[0]?.value as HTMLCanvasElement;
    expect(output).toMatchObject({ width: 0, height: 0 });
  });

  it('sanitizes the suggested filename before starting a download', () => {
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureName(this: HTMLAnchorElement) {
      downloadName = this.download;
    });

    startPreviewDownload(new Blob(['png']), '../Unsafe Project?.png');

    expect(downloadName).toMatch(/^[a-z0-9._-]+\.png$/i);
    expect(downloadName).not.toContain('..');
    expect(downloadName).not.toContain('/');
  });

  it('revokes the object URL even when download initiation throws', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { throw new Error('download blocked'); });

    expect(() => startPreviewDownload(new Blob(['png']), '../Unsafe Project?.png')).toThrow('download blocked');
    expect(createObjectURL).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});

import { createInitialProjectDocument } from '../../src/domain/project';
import { createLayeredPsd } from '../../src/export/layeredPsd';
import {
  LAYERED_PSD_MAX_PIXEL_COUNT,
  LAYERED_PSD_MAX_SIDE_PX,
  planLayeredPsdExport,
} from '../../src/export/layeredPsdPlan';

const psdMocks = vi.hoisted(() => ({
  drawImage: vi.fn(),
  write: vi.fn(),
}));

vi.mock('ag-psd', () => ({
  writePsdUint8Array: psdMocks.write,
}));

function installPsdCanvasMocks(): void {
  psdMocks.drawImage.mockReset();
  psdMocks.write.mockReset();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:psd-layer');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: psdMocks.drawImage,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('Image', class {
    private readonly listeners = new Map<string, EventListener>();

    addEventListener(type: string, listener: EventListener) {
      this.listeners.set(type, listener);
    }

    removeEventListener(type: string) {
      this.listeners.delete(type);
    }

    set src(_value: string) {
      queueMicrotask(() => this.listeners.get('load')?.(new Event('load')));
    }
  });
}

function restorePsdCanvasMocks(): void {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

describe('layered PSD planning', () => {
  it('uses 300 DPI for an A4 page and reduces oversized pages within PSD limits', () => {
    const project = createInitialProjectDocument();
    const a4 = planLayeredPsdExport(project);

    expect(a4.compact).toBe(false);
    expect(a4.effectiveDpi).toBe(300);
    expect(a4.preflight.dimensions).toMatchObject({ widthPx: 3508, heightPx: 2480 });

    project.page.widthMm = 1189;
    project.page.heightMm = 841;
    const compact = planLayeredPsdExport(project);

    expect(compact.compact).toBe(true);
    expect(compact.effectiveDpi).toBeLessThan(300);
    expect(compact.preflight.safe).toBe(true);
    expect(compact.preflight.dimensions?.pixelCount).toBeLessThanOrEqual(LAYERED_PSD_MAX_PIXEL_COUNT);
    expect(Math.max(
      compact.preflight.dimensions?.widthPx ?? Infinity,
      compact.preflight.dimensions?.heightPx ?? Infinity,
    )).toBeLessThanOrEqual(LAYERED_PSD_MAX_SIDE_PX);

    project.page.widthMm = 144.3;
    project.page.heightMm = 500;
    const roundedBoundary = planLayeredPsdExport(project);
    expect(roundedBoundary.effectiveDpi).toBe(298);
    expect(roundedBoundary.preflight.safe).toBe(true);
  });

  it('reports PSD overlays as embedded SVG Smart Objects', () => {
    const project = createInitialProjectDocument();
    const plan = planLayeredPsdExport(project);

    expect(plan.preflight.warnings.map(({ code }) => code)).toContain('PSD_OVERLAYS_SMART_OBJECTS');
    expect(plan.preflight.warnings.map(({ code }) => code)).not.toContain('VECTOR_OVERLAYS_REMAIN_VECTOR');
  });

  it('reduces DPI as the named layer count grows', () => {
    const project = createInitialProjectDocument();
    const template = project.layers[0];
    if (!template) throw new Error('Expected a route fixture.');
    project.layers.unshift(...Array.from({ length: 24 }, (_, index) => ({
      ...structuredClone(template),
      id: `route-copy-${index}`,
      name: `Route copy ${index}`,
    })));

    const plan = planLayeredPsdExport(project);

    expect(plan.compact).toBe(true);
    expect(plan.effectiveDpi).toBeLessThan(300);
    expect(plan.preflight.safe).toBe(true);
  });
});

describe('layered PSD writer', () => {
  beforeEach(installPsdCanvasMocks);
  afterEach(restorePsdCanvasMocks);

  it('packages the basemap, named content, and attribution in Photoshop stacking order', async () => {
    const project = createInitialProjectDocument();
    project.page.widthMm = 25.4;
    project.page.heightMm = 25.4;
    project.layers[0].visible = false;
    project.layers[0].opacity = 37;
    const plan = planLayeredPsdExport(project);
    const sourceSurface = document.createElement('canvas');
    sourceSurface.width = 1;
    sourceSurface.height = 1;
    const capture = {
      blob: new Blob(['preview'], { type: 'image/png' }),
      width: 1,
      height: 1,
      surface: sourceSurface,
      projectToFrame: ([longitude, latitude]: readonly [number, number]) => ({
        x: (longitude - 16.28) / 0.2,
        y: (48.26 - latitude) / 0.12,
      }),
    };
    const renderTile = vi.fn(({ region }: { region: { width: number; height: number } }) => {
      const tile = document.createElement('canvas');
      tile.width = region.width;
      tile.height = region.height;
      return Promise.resolve(tile);
    });
    let written: {
      children: {
        hidden?: boolean;
        name?: string;
        opacity?: number;
        placedLayer?: { id: string; placed?: string; type: string; transform: number[] };
      }[];
      linkedFiles: { data?: Uint8Array; id: string; name: string; type?: string }[];
      resolution?: number;
    } | undefined;
    psdMocks.write.mockImplementation((psd: {
      children?: {
        hidden?: boolean;
        name?: string;
        opacity?: number;
        placedLayer?: { id: string; placed?: string; type: string; transform: number[] };
      }[];
      imageResources?: { resolutionInfo?: { horizontalResolution?: number } };
      linkedFiles?: { data?: Uint8Array; id: string; name: string; type?: string }[];
    }) => {
      written = {
        children: psd.children?.map(({ hidden, name, opacity, placedLayer }) => ({
          hidden,
          name,
          opacity,
          placedLayer,
        })) ?? [],
        linkedFiles: psd.linkedFiles ?? [],
        resolution: psd.imageResources?.resolutionInfo?.horizontalResolution,
      };
      return Uint8Array.from([0x38, 0x42, 0x50, 0x53]);
    });

    const blob = await createLayeredPsd(project, capture, {
      effectiveDpi: plan.effectiveDpi,
      preflight: plan.preflight,
      renderTile,
    });

    expect(renderTile).toHaveBeenCalledOnce();
    expect(written?.children.map(({ name }) => name)).toEqual([
      'Paper basemap',
      'City center',
      'Coffee stop',
      'Route 01',
      'Attribution',
    ]);
    expect(written?.children.find(({ name }) => name === 'Route 01')).toMatchObject({
      hidden: true,
      opacity: 0.37,
      placedLayer: {
        type: 'vector',
        transform: [0, 0, 300, 0, 300, 300, 0, 300],
      },
    });
    expect(written?.children.find(({ name }) => name === 'Paper basemap')?.placedLayer).toBeUndefined();
    const nameByCanvas = new Map((psdMocks.write.mock.calls[0]?.[0].children ?? [])
      .map((layer: { canvas: HTMLCanvasElement; name: string }) => [layer.canvas, layer.name]));
    const compositeOrder = psdMocks.drawImage.mock.calls.flatMap(([source]) => (
      source instanceof HTMLCanvasElement && nameByCanvas.has(source)
        ? [nameByCanvas.get(source)]
        : []
    ));
    expect(compositeOrder).toEqual([
      'Paper basemap',
      'City center',
      'Coffee stop',
      'Attribution',
    ]);
    expect(written?.linkedFiles.map(({ name }) => name)).toEqual([
      '001-route-01.svg',
      '002-coffee-stop.svg',
      '003-city-center.svg',
      '004-attribution.svg',
    ]);
    expect(written?.linkedFiles.every(({ data, id, type }) => (
      type === undefined
      && data
      && new TextDecoder().decode(data).startsWith('<svg')
      && written?.children.some(({ placedLayer }) => placedLayer?.id === id)
    ))).toBe(true);
    expect(written?.resolution).toBe(300);
    expect(psdMocks.write).toHaveBeenCalledWith(expect.any(Object), {
      generateThumbnail: false,
      noBackground: true,
      trimImageData: true,
    });
    expect(blob.type).toBe('image/vnd.adobe.photoshop');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(Uint8Array.from([0x38, 0x42, 0x50, 0x53]));
  });
});

describe('layered PSD permutation order', () => {
  beforeEach(installPsdCanvasMocks);
  afterEach(restorePsdCanvasMocks);

  it.each([
    [['route', 'poi', 'shape'], ['Paper basemap', 'City center', 'Coffee stop', 'Route 01', 'Attribution']],
    [['route', 'shape', 'poi'], ['Paper basemap', 'Coffee stop', 'City center', 'Route 01', 'Attribution']],
    [['poi', 'route', 'shape'], ['Paper basemap', 'City center', 'Route 01', 'Coffee stop', 'Attribution']],
    [['poi', 'shape', 'route'], ['Paper basemap', 'Route 01', 'City center', 'Coffee stop', 'Attribution']],
    [['shape', 'route', 'poi'], ['Paper basemap', 'Coffee stop', 'Route 01', 'City center', 'Attribution']],
    [['shape', 'poi', 'route'], ['Paper basemap', 'Route 01', 'Coffee stop', 'City center', 'Attribution']],
  ] as const)('preserves editor stack permutation %j in PSD and composite order', async (editorOrder, paintOrder) => {
    const project = createInitialProjectDocument();
    project.page.widthMm = 25.4;
    project.page.heightMm = 25.4;
    const byType = new Map(project.layers.map((layer) => [layer.type, layer]));
    project.layers = [
      ...editorOrder.map((type) => {
        const layer = byType.get(type);
        if (!layer) throw new Error(`Missing ${type} fixture.`);
        return layer;
      }),
      byType.get('basemap')!,
    ];
    const plan = planLayeredPsdExport(project);
    const source = document.createElement('canvas');
    source.width = 1;
    source.height = 1;
    let children: { canvas: HTMLCanvasElement; name: string }[] = [];
    psdMocks.write.mockImplementation((psd: {
      children?: { canvas: HTMLCanvasElement; name: string }[];
    }) => {
      children = psd.children ?? [];
      return Uint8Array.from([0x38, 0x42, 0x50, 0x53]);
    });

    await createLayeredPsd(project, {
      blob: new Blob(['preview'], { type: 'image/png' }),
      width: 1,
      height: 1,
      surface: source,
      projectToFrame: () => ({ x: 0.5, y: 0.5 }),
    }, {
      effectiveDpi: plan.effectiveDpi,
      preflight: plan.preflight,
      renderTile: ({ region }) => {
        const tile = document.createElement('canvas');
        tile.width = region.width;
        tile.height = region.height;
        return Promise.resolve(tile);
      },
    });

    const editorNames = editorOrder.map((type) => byType.get(type)?.name);
    expect(children.map(({ name }) => name)).toEqual(paintOrder);
    const photoshopPanelOrder = children.map((_, index) => children.at(-index - 1)?.name);
    expect(photoshopPanelOrder).toEqual([
      'Attribution',
      ...editorNames,
      'Paper basemap',
    ]);
    const nameByCanvas = new Map(children.map(({ canvas, name }) => [canvas, name]));
    const actualPaintOrder = psdMocks.drawImage.mock.calls.flatMap(([painted]) => (
      painted instanceof HTMLCanvasElement && nameByCanvas.has(painted)
        ? [nameByCanvas.get(painted)]
        : []
    ));
    expect(actualPaintOrder).toEqual(paintOrder);
  });
});

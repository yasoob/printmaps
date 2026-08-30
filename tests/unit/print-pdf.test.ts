import { unzlibSync } from 'fflate';
import { createInitialProjectDocument } from '../../src/domain/project';
import { planExportPreflight } from '../../src/export/preflight';
import { createNativePrintPdf, createPrintPdf } from '../../src/export/printPdf';
import type { PreviewPng } from '../../src/export/previewPng';

function jpegCapture(): PreviewPng {
  const surface = document.createElement('canvas');
  surface.width = 2;
  surface.height = 1;
  return {
    blob: new Blob([Uint8Array.from([0xFF, 0xD8, 0xFF, 0xD9])], { type: 'image/jpeg' }),
    width: 2,
    height: 1,
    surface,
    projectToFrame: () => ({ x: 0.5, y: 0.5 }),
  };
}

function linearCapture(): PreviewPng {
  const capture = jpegCapture();
  capture.projectToFrame = ([longitude, latitude]) => ({
    x: (longitude + 180) / 360,
    y: (85 - latitude) / 170,
  });
  return capture;
}

async function pdfText(document = createInitialProjectDocument()): Promise<string> {
  const pdf = await createPrintPdf(document, jpegCapture());
  return new TextDecoder('latin1').decode(await pdf.arrayBuffer());
}

describe('native print PDF raster', () => {
  afterEach(() => vi.restoreAllMocks());

  it('embeds bounded native basemap regions as lossless target-resolution images', async () => {
    const document = createInitialProjectDocument();
    document.page = {
      ...document.page,
      preset: 'Custom',
      widthMm: 25.4,
      heightMm: 25.4,
    };
    const preflight = planExportPreflight({
      format: 'pdf',
      page: { widthMm: 25.4, heightMm: 25.4 },
      dpi: 100,
      attributions: ['© OpenStreetMap contributors'],
      basemap: 'raster',
      vectorOverlays: true,
      cancellationSupported: true,
    }, {
      gpuMaxSidePx: 64,
      preferredTileSidePx: 64,
      tileOverlapPx: 4,
    });
    const renderedRegions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const renderedSurfaces: HTMLCanvasElement[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4).fill(255),
        width,
        height,
      })),
    } as unknown as CanvasRenderingContext2D);

    const pdf = await createNativePrintPdf(document, jpegCapture(), {
      preflight,
      renderTile: async ({ region }) => {
        renderedRegions.push(region);
        const surface = globalThis.document.createElement('canvas');
        surface.width = region.width;
        surface.height = region.height;
        renderedSurfaces.push(surface);
        return surface;
      },
    });
    const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
    const text = new TextDecoder('latin1').decode(pdfBytes);
    const dictionaryOffset = text.indexOf('/Filter /FlateDecode');
    const streamHeaderOffset = text.indexOf('stream\n', dictionaryOffset);
    const streamOffset = streamHeaderOffset + 'stream\n'.length;
    const streamLength = Number(text.slice(dictionaryOffset, streamHeaderOffset).match(/\/Length (\d+)/)?.[1]);
    const decodedImage = unzlibSync(pdfBytes.subarray(streamOffset, streamOffset + streamLength));

    expect(renderedRegions).toEqual(preflight.plan?.tiles.map((tile) => ({
      x: tile.renderX,
      y: tile.renderY,
      width: tile.renderWidth,
      height: tile.renderHeight,
    })));
    expect(text.match(/\/Subtype \/Image/g)).toHaveLength(4);
    expect(text).toContain('/Filter /FlateDecode');
    expect(text).toContain('/Predictor 15');
    expect(text).toContain('/Interpolate false');
    expect(text).not.toContain('/DCTDecode');
    expect(text).toContain('/BasemapImage0 Do');
    expect(text).toContain('/BasemapImage3 Do');
    expect(text).toContain('/MediaBox [0 0 72 72]');
    expect(decodedImage).toHaveLength((56 * 3 + 1) * 56);
    expect([...decodedImage.subarray(0, 7)]).toEqual([2, 255, 255, 255, 255, 255, 255]);
    expect(decodedImage[56 * 3 + 1]).toBe(2);
    expect([...decodedImage.subarray(56 * 3 + 2, 56 * 3 + 8)]).toEqual([0, 0, 0, 0, 0, 0]);
    expect(renderedSurfaces.every(({ width, height }) => width === 0 && height === 0)).toBe(true);
  });
});

describe('print PDF', () => {
  it('fails closed rather than substituting a standard symbol for a custom marker', async () => {
    const document = createInitialProjectDocument();
    const poi = document.layers.find(({ id }) => id === 'poi-cafe');
    if (poi?.appearance?.kind !== 'poi') throw new Error('POI fixture is unavailable');
    poi.appearance.customAssetId = `sha256-${'a'.repeat(64)}`;

    await expect(createPrintPdf(document, jpegCapture())).rejects.toThrow(
      'PDF export does not yet support custom marker images',
    );
  });

  it('embeds hidden vector content while listing its optional layer as initially off', async () => {
    const document = createInitialProjectDocument();
    const route = document.layers.find(({ id }) => id === 'route-01');
    if (!route) throw new Error('Route fixture is unavailable');
    route.visible = false;

    const text = await pdfText(document);

    expect(text).toContain('/OFF [8 0 R]');
    expect(text).toContain('% Vector layer: Route 01');
    expect(text).toContain('/OC /Layer0 BDC');
  });

  it('exports a canonical Arc with the same sampled line path as the map', async () => {
    const document = createInitialProjectDocument();
    document.layers[0].geometry = { type: 'Arc', anchors: [[16.326, 48.194], [16.429, 48.226]], curvatures: [0.35] };

    const pdf = await createPrintPdf(document, linearCapture());
    const text = new TextDecoder('latin1').decode(await pdf.arrayBuffer());
    const routeStart = text.indexOf('% Vector layer: Route 01');
    const routeEnd = text.indexOf('EMC', routeStart);
    const routeCommands = text.slice(routeStart, routeEnd);

    expect(routeCommands).toMatch(/\d+(?:\.\d+)? \d+(?:\.\d+)? l/);
    expect(routeCommands).not.toMatch(/\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)? c/);
  });

  it('applies canonical basemap opacity to the raster image', async () => {
    const document = createInitialProjectDocument();
    const basemap = document.layers.find(({ type }) => type === 'basemap');
    if (!basemap) throw new Error('Basemap fixture is unavailable');
    basemap.opacity = 35;

    const text = await pdfText(document);

    expect(text).toContain('/BasemapGS gs');
    expect(text).toContain('/BasemapGS ');
    expect(text).toContain('/Type /ExtGState /CA 0.35 /ca 0.35');
  });

  it('paints bottom layers first while listing optional layers in editor order', async () => {
    const text = await pdfText();

    const route = text.indexOf('% Vector layer: Route 01');
    const poi = text.indexOf('% Vector layer: Coffee stop');
    const shape = text.indexOf('% Vector layer: City center');
    expect(shape).toBeLessThan(poi);
    expect(poi).toBeLessThan(route);
    expect(text).toContain('/Order [8 0 R 9 0 R 10 0 R 7 0 R 11 0 R]');
  });

  it('uses canonical route, POI, and shape appearance in vector commands', async () => {
    const document = createInitialProjectDocument();
    document.layers[0].appearance = {
      kind: 'route', color: '#010203', width: 8, travelProfile: 'car', showTravelModeIcon: false,
    };
    document.layers[1].appearance = {
      kind: 'poi', color: '#abcdef', size: 21, markerShape: 'circle', markerSymbol: 'none', label: '',
    };
    document.layers[2].appearance = {
      kind: 'shape',
      fillColor: '#112233',
      strokeColor: '#fedcba',
      strokeWidth: 3,
      invert: false,
    };

    const text = await pdfText(document);
    const poiStart = text.indexOf('% Vector layer: Coffee stop');
    const routeStart = text.indexOf('% Vector layer: Route 01');
    const poiCommands = text.slice(poiStart, routeStart);

    expect(text).toContain('0.003922 0.007843 0.011765 RG\n6.80315 w');
    expect(text).toContain('0.670588 0.803922 0.937255 rg');
    expect(text).toContain('429.448819 297.637795 m');
    expect(poiCommands).toContain('1 1 1 RG\n1.133858 w');
    expect(poiCommands).toContain('\nB\n');
    expect(text).toContain('0.066667 0.133333 0.2 rg');
    expect(text).toContain('0.996078 0.862745 0.729412 RG');
    expect(text).toContain('2.125984 w');
  });


  it('prints an enabled route travel-mode marker as vector PDF content', async () => {
    const document = createInitialProjectDocument();
    document.layers[0].appearance = {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: 'air',
      showTravelModeIcon: true,
    };

    const text = await pdfText(document);

    expect(text).toContain('% Route travel profile: air');
    expect(text).toContain('(AIR) Tj');
  });

  it('prints canonical POI marker shape, semantic symbol, and label as vector PDF content', async () => {
    const document = createInitialProjectDocument();
    document.layers[1].appearance = {
      kind: 'poi',
      color: '#0d78b5',
      size: 21,
      markerShape: 'diamond',
      markerSymbol: 'coffee',
      label: 'Café Central',
    };

    const text = await pdfText(document);

    expect(text).toContain('% POI marker shape: diamond');
    expect(text).toContain('(C) Tj');
    expect(text).toContain(String.raw`(Caf\351 Central) Tj`);
  });

  it('rejects a POI label that the current PDF font cannot encode', async () => {
    const document = createInitialProjectDocument();
    document.layers[1].appearance = {
      kind: 'poi',
      color: '#0d78b5',
      size: 21,
      markerShape: 'circle',
      markerSymbol: 'none',
      label: '東京',
    };

    await expect(pdfText(document)).rejects.toThrow(
      'POI label contains characters that the PDF font cannot encode.',
    );
  });
});

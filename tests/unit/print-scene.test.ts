import { describe, expect, it } from 'vitest';
import { createInitialProjectDocument } from '../../src/domain/project';
import { serializePrintScene } from '../../src/print/scene';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const projector = ([longitude, latitude]: readonly [number, number]) => ({
  x: (longitude - 16.3) * 1000,
  y: (48.3 - latitude) * 1000,
});

function parseSvg(svgText: string) {
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  return document;
}

function requiredElement(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);
  expect(element).not.toBeNull();
  if (!element) throw new Error(`Missing test element: ${selector}`);
  return element;
}

describe('layered SVG print scene', () => {
  it('serializes an exact physical page with clipped raster and ordered named vector groups', () => {
    const project = createInitialProjectDocument();

    const svgText = serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors · OpenFreeMap',
      project: projector,
    });
    const svgDocument = parseSvg(svgText);
    const svg = svgDocument.documentElement;

    expect(svg.getAttribute('width')).toBe('297mm');
    expect(svg.getAttribute('height')).toBe('210mm');
    expect(svg.getAttribute('viewBox')).toBe('0 0 297 210');
    expect(svg.dataset.basemapContent).toBe('raster');
    expect(svg.dataset.overlayContent).toBe('vector');
    expect(svg.querySelector(':scope #page-clip rect')?.getAttribute('width')).toBe('297');
    expect(svg.querySelector(':scope #page-clip rect')?.getAttribute('height')).toBe('210');

    const groups = [...svg.children].filter((child) => child.localName === 'g') as SVGElement[];
    expect(groups.map((group) => group.dataset.layerName)).toEqual([
      'Liberty basemap',
      'Route 01',
      'Coffee stop',
      'City center',
      'Attribution',
    ]);
    expect(groups.map((group) => group.dataset.sceneRole)).toEqual([
      'raster-basemap',
      'vector-overlay',
      'vector-overlay',
      'vector-overlay',
      'attribution',
    ]);
    expect(groups.every((group) => group.getAttribute('clip-path') === 'url(#page-clip)')).toBe(true);
    expect(groups[0].querySelectorAll('image')).toHaveLength(1);
    expect(groups[0].querySelector('image')?.getAttribute('href')).toBe(onePixelPng);
    expect(groups[1].querySelector('path')).not.toBeNull();
    expect(groups[2].querySelector('circle')).not.toBeNull();
    expect(groups[3].querySelector('path')).not.toBeNull();
    expect(groups[4].textContent).toContain('© OpenStreetMap contributors · OpenFreeMap');

    const overlayIds = groups.slice(1, 4).map((group) => group.id);
    expect(new Set(overlayIds).size).toBe(3);
    expect(overlayIds.every((id) => id.startsWith('layer-'))).toBe(true);
    expect(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors · OpenFreeMap',
      project: projector,
    })).toBe(svgText);
  });

  it('preserves custom physical dimensions exactly in millimetres and the viewBox', () => {
    const project = createInitialProjectDocument();
    project.page.widthMm = 215.9000001;
    project.page.heightMm = 279.4000001;

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    }));

    expect(svgDocument.documentElement.getAttribute('width')).toBe('215.9000001mm');
    expect(svgDocument.documentElement.getAttribute('height')).toBe('279.4000001mm');
    expect(svgDocument.documentElement.getAttribute('viewBox')).toBe('0 0 215.9000001 279.4000001');
  });

  it('escapes untrusted project, layer, metadata, and attribution text without changing their values', () => {
    const project = createInitialProjectDocument();
    project.id = 'project&"<unsafe>';
    project.title = 'Atlas </title><script>owned()</script> & friends';
    project.layers[0].id = 'route" onload="owned()';
    project.layers[0].name = 'Route </title><script>owned()</script> & "quoted"';
    const attribution = '© Source </text><script>owned()</script> & partners';
    const metadata = 'Created by </metadata><script>owned()</script> & team';

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution,
      metadata,
      project: projector,
    }));
    const routeGroup = svgDocument.querySelector<SVGElement>('[data-scene-role="vector-overlay"]');

    expect(svgDocument.querySelector('script')).toBeNull();
    expect(svgDocument.documentElement.querySelector(':scope > title')?.textContent).toBe(project.title);
    expect(svgDocument.querySelector('metadata')?.textContent).toBe(metadata);
    expect(svgDocument.querySelector('metadata')?.dataset.projectId).toBe(project.id);
    expect(routeGroup?.dataset.layerId).toBe(project.layers[0].id);
    expect(routeGroup?.dataset.layerName).toBe(project.layers[0].name);
    expect(routeGroup?.querySelector('title')?.textContent).toBe(project.layers[0].name);
    expect(svgDocument.documentElement.querySelector(':scope #attribution text')?.textContent).toBe(attribution);
    expect(routeGroup?.id).toMatch(/^layer-[a-z0-9_-]+-[a-z0-9]+$/);
  });

  it('retains hidden layers and applies normalized opacity plus deterministic vector styles', () => {
    const project = createInitialProjectDocument();
    project.layers[0].visible = false;
    project.layers[0].opacity = 37;
    project.layers[0].appearance = {
      kind: 'route', color: '#010203', width: 8, travelProfile: 'car', showTravelModeIcon: false,
    };
    project.layers[1].appearance = { kind: 'poi', color: '#abcdef', size: 21, markerShape: 'circle', markerSymbol: 'none', label: '' };
    project.layers[2].appearance = {
      kind: 'shape',
      fillColor: '#112233',
      strokeColor: '#fedcba',
      strokeWidth: 3,
      invert: false,
    };

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    }));
    const route = requiredElement(svgDocument, '[data-layer-id="route-01"]');
    const poi = requiredElement(svgDocument, '[data-layer-id="poi-cafe"] circle');
    const shape = requiredElement(svgDocument, '[data-layer-id="area-center"] path');

    expect(route.getAttribute('visibility')).toBe('hidden');
    expect(route.getAttribute('opacity')).toBe('0.37');
    const routePath = requiredElement(route, ':scope > path');
    expect(routePath.getAttribute('stroke')).toBe('#010203');
    expect(routePath.getAttribute('stroke-width')).toBe('2.4');
    expect(routePath.getAttribute('d')).toBe('M 26 106 L 53 95 L 91 85 L 129 74');
    expect(poi.getAttribute('fill')).toBe('#abcdef');
    expect(poi.getAttribute('r')).toBe('3');
    expect(shape.getAttribute('fill')).toBe('#112233');
    expect(shape.getAttribute('stroke')).toBe('#fedcba');
    expect(shape.getAttribute('stroke-width')).toBe('0.75');
  });

  it('rejects missing or malformed required raster and attribution assets', () => {
    const project = createInitialProjectDocument();
    const validOptions = {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    };

    expect(() => serializePrintScene(project, { ...validOptions, attribution: ' '.repeat(3) }))
      .toThrow('attribution is required');
    expect(() => serializePrintScene(project, {
      ...validOptions,
      basemap: { dataUri: 'https://tiles.example/map.png', pixelWidth: 100, pixelHeight: 100 },
    })).toThrow('embedded base64');
    expect(() => serializePrintScene(project, {
      ...validOptions,
      basemap: { dataUri: 'data:image/png;base64,ZmFrZQ==', pixelWidth: 1, pixelHeight: 1 },
    })).toThrow('valid PNG signature');
    expect(() => serializePrintScene(project, {
      ...validOptions,
      basemap: { dataUri: onePixelPng, pixelWidth: 0, pixelHeight: 1 },
    })).toThrow('pixel width');
  });

  it('rejects invalid projection output and incomplete vector geometry instead of emitting broken XML', () => {
    const project = createInitialProjectDocument();
    const options = {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: () => ({ x: NaN, y: 10 }),
    };

    expect(() => serializePrintScene(project, options)).toThrow('invalid page point');
    project.layers[0].geometry = undefined;
    expect(() => serializePrintScene(project, { ...options, project: projector }))
      .toThrow('missing valid LineString geometry');
  });

  it('rejects duplicate layer IDs, invalid opacity, unsafe paint, and invalid page dimensions', () => {
    const project = createInitialProjectDocument();
    const options = {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    };

    project.layers[1].id = project.layers[0].id;
    expect(() => serializePrintScene(project, options)).toThrow('unique non-empty ID');

    project.layers[1].id = 'poi-cafe';
    project.layers[0].opacity = 101;
    expect(() => serializePrintScene(project, options)).toThrow('invalid opacity');

    project.layers[0].opacity = 100;
    project.layers[0].appearance = {
      kind: 'route',
      color: 'url(javascript:owned())',
      width: 4,
      travelProfile: 'car',
      showTravelModeIcon: false,
    };
    expect(() => serializePrintScene(project, options)).toThrow('unsafe SVG paint');

    project.page.widthMm = Infinity;
    expect(() => serializePrintScene(project, options)).toThrow('Page width');
  });
});

describe('route travel-mode SVG markers', () => {
  it('prints an enabled marker inside its named vector layer', () => {
    const project = createInitialProjectDocument();
    project.layers[0].appearance = {
      kind: 'route',
      color: '#d9363e',
      width: 4,
      travelProfile: 'air',
      showTravelModeIcon: true,
    };

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    }));
    const marker = requiredElement(svgDocument, '[data-layer-id="route-01"] [data-route-travel-profile="air"]');

    expect(marker.querySelector('circle')).not.toBeNull();
    expect(marker.querySelector('text')?.textContent).toBe('AIR');
  });
});

describe('POI SVG markers and labels', () => {
  it('prints the canonical marker shape, semantic symbol, and label as vector content', () => {
    const project = createInitialProjectDocument();
    project.layers[1].appearance = {
      kind: 'poi',
      color: '#0d78b5',
      size: 21,
      markerShape: 'diamond',
      markerSymbol: 'coffee',
      label: 'Café Central',
    };

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    }));
    const poi = requiredElement(svgDocument, '[data-layer-id="poi-cafe"]');

    expect(poi.querySelector(':scope [data-poi-marker-shape="diamond"] path')).not.toBeNull();
    expect(poi.querySelector(':scope [data-poi-marker-symbol="coffee"]')?.textContent).toBe('C');
    expect(poi.querySelector(':scope [data-poi-label]')?.textContent).toBe('Café Central');
  });

  it('embeds a hash-owned custom marker image in the POI vector layer', () => {
    const project = createInitialProjectDocument();
    const assetId = `sha256-${'a'.repeat(64)}`;
    const dataUri = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEyMCI+PHBhdGggZD0iTTAgMEgxMDBWMTIwSDBaIi8+PC9zdmc+';
    project.assets[assetId] = {
      id: assetId,
      mimeType: 'image/svg+xml',
      width: 100,
      height: 2048,
      dataUri,
    };
    project.layers[1].appearance = {
      kind: 'poi',
      color: '#0d78b5',
      size: 28,
      markerShape: 'circle',
      markerSymbol: 'coffee',
      label: 'Custom café',
      customAssetId: assetId,
    };

    const svgDocument = parseSvg(serializePrintScene(project, {
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      attribution: '© OpenStreetMap contributors',
      project: projector,
    }));
    const poi = requiredElement(svgDocument, '[data-layer-id="poi-cafe"]');
    const image = requiredElement(poi, ':scope image[data-poi-custom-marker]');

    expect(image.getAttribute('href')).toBe(dataUri);
    expect(image.getAttribute('width')).toBe('0.390625');
    expect(image.getAttribute('height')).toBe('8');
    expect(poi.querySelector('[data-poi-marker-shape]')).toBeNull();
    expect(poi.querySelector('[data-poi-label]')?.textContent).toBe('Custom café');
  });
});

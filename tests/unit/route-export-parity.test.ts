import { createInitialProjectDocument } from '../../src/domain/project';
import { pdfVectorCommands } from '../../src/export/pdfVectorCommands';
import { serializePrintScene } from '../../src/print/scene';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function styledRoute() {
  const project = createInitialProjectDocument();
  const route = project.layers[0];
  if (route.appearance?.kind !== 'route') throw new Error('Route fixture unavailable.');
  route.appearance.segmentStyles = [
    { color: '#112233', width: 8, strokeStyle: 'dashed' },
    null,
    { color: '#abcdef', width: 2, strokeStyle: 'solid' },
  ];
  route.appearance.marker = {
    pictogram: 'ship',
    placement: { type: 'repeat', spacing: 0.25 },
    orientToPath: true,
    reverseFacing: true,
  };
  return { project, route };
}

describe('route SVG and PDF parity', () => {
  it('serializes every semantic leg and derived marker with resolved color, width, and dash', () => {
    const { project } = styledRoute();
    const svg = serializePrintScene(project, {
      attribution: '© OpenStreetMap contributors',
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      project: ([longitude, latitude]) => ({ x: longitude, y: latitude }),
    });
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const routeGroup = document.querySelector('[data-layer-id="route-01"]')!;
    const legs = [...routeGroup.querySelectorAll(':scope > path')];
    expect(legs).toHaveLength(3);
    expect(legs[0]).toMatchObject({ dataset: { routeLeg: '0' } });
    expect(legs[0].getAttribute('stroke')).toBe('#112233');
    expect(legs[0].getAttribute('stroke-width')).toBe('2.4');
    expect(legs[0].getAttribute('stroke-dasharray')).toBe('4.8 3.6');
    expect(legs[2].getAttribute('stroke')).toBe('#abcdef');
    expect(routeGroup.querySelectorAll('[data-route-pictogram="ship"]')).toHaveLength(4);
  });

  it('emits matching per-leg PDF strokes, normalized dashes, and vector pictograms', () => {
    const { route } = styledRoute();
    const commands = pdfVectorCommands(route, {
      blob: new Blob(),
      height: 1,
      width: 1,
      surface: document.createElement('canvas'),
      projectToFrame: ([longitude, latitude]) => ({ x: longitude / 100, y: latitude / 100 }),
      referenceLongitude: 0,
    }, 100, 100);
    expect(commands).toContain('% Route leg: 0');
    expect(commands).toContain('0.066667 0.133333 0.2 RG');
    expect(commands).toContain('6.80315 w');
    expect(commands).toContain('[13.606299 10.204724] 0 d');
    expect(commands.match(/% Route pictogram: ship/g)).toHaveLength(4);
    expect(commands).not.toContain('(SHIP) Tj');
  });

  it('orients SVG and PDF pictograms from each output projector tangent', () => {
    const project = createInitialProjectDocument();
    const route = project.layers[0];
    route.geometry = { type: 'LineString', coordinates: [[0, 0], [1, 0]] };
    if (route.appearance?.kind !== 'route') throw new Error('Route fixture unavailable.');
    route.appearance.segmentStyles = [null];
    route.appearance.marker = {
      pictogram: 'air',
      placement: { type: 'center' },
      orientToPath: true,
      reverseFacing: false,
    };
    const svg = serializePrintScene(project, {
      attribution: '© OpenStreetMap contributors',
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      project: ([longitude, latitude]) => ({ x: latitude, y: longitude }),
    });
    expect(svg).toContain('rotate(180)');

    const commands = pdfVectorCommands(route, {
      blob: new Blob(),
      height: 1,
      width: 1,
      surface: document.createElement('canvas'),
      projectToFrame: ([longitude, latitude]) => ({
        x: latitude / 10,
        y: longitude / 10,
      }),
      referenceLongitude: 0,
    }, 100, 100);
    expect(commands).toContain('8.503937 95.944882 m');
  });

  it('rebases dateline routes and markers into the captured world copy', () => {
    const project = createInitialProjectDocument();
    const route = project.layers[0];
    route.geometry = { type: 'LineString', coordinates: [[179, 0], [-179, 0]] };
    if (route.appearance?.kind !== 'route') throw new Error('Route fixture unavailable.');
    route.appearance.segmentStyles = [null];
    route.appearance.marker = {
      pictogram: 'ship',
      placement: { type: 'center' },
      orientToPath: true,
      reverseFacing: false,
    };
    const svgLongitudes: number[] = [];
    serializePrintScene(project, {
      attribution: '© OpenStreetMap contributors',
      basemap: { dataUri: onePixelPng, pixelWidth: 1, pixelHeight: 1 },
      project: ([longitude], context) => {
        if (context.layerId === route.id) svgLongitudes.push(longitude);
        return { x: longitude, y: 0 };
      },
      referenceLongitude: 180,
    });
    expect(svgLongitudes.every((longitude) => longitude >= 179 && longitude <= 181)).toBe(true);

    const pdfLongitudes: number[] = [];
    pdfVectorCommands(route, {
      blob: new Blob(),
      height: 1,
      width: 1,
      surface: document.createElement('canvas'),
      projectToFrame: ([longitude]) => {
        pdfLongitudes.push(longitude);
        return { x: (longitude - 179) / 2, y: 0.5 };
      },
      referenceLongitude: 180,
    }, 100, 100);
    expect(pdfLongitudes.every((longitude) => longitude >= 179 && longitude <= 181)).toBe(true);
  });
});

/**
 * Demo projects for the marketing screenshots. The capture script imports this module in the
 * running editor (through Vite), so every scene is built and validated with the product's own
 * domain code. Geodata comes from ./data (see scripts/marketing-media/fetch-data.mts).
 */
import { createDefaultLayerAppearance, createNewProjectDocument, type ContentLayer, type MapStylePreset, type ProjectDocument } from '../../src/domain/project';
import { createDefaultRouteAppearance } from '../../src/domain/layerAppearance';
import { parseProjectDocument } from '../../src/domain/projectFile';
import { validateCustomMarkerFile } from '../../src/domain/customMarkerAssets';
import { validatePhotoFile } from '../../src/domain/studioPhotoAssets';
import { posterTemplateSettings, POSTER_STARTERS, type PosterTemplate } from '../../src/domain/studioTemplates';
import { createTemplateProject } from '../../src/app/studio/templateProjects';
import routes from './data/routes.json';
import isochrones from './data/isochrones.json';
import places from './data/places.json';

type Position = [number, number];
type PoiStyle = { color: string; size?: number; symbol?: 'none' | 'information' | 'coffee' | 'food' | 'lodging' | 'parking'; label?: string; shape?: 'circle' | 'square' | 'diamond' };

const A3_PORTRAIT = { preset: 'A3', widthMm: 297, heightMm: 420, orientation: 'portrait' } as const;
const A3_LANDSCAPE = { preset: 'A3', widthMm: 420, heightMm: 297, orientation: 'landscape' } as const;
const A4_PORTRAIT = { preset: 'A4', widthMm: 210, heightMm: 297, orientation: 'portrait' } as const;

function poi(id: string, name: string, coordinates: Position, style: PoiStyle): ContentLayer {
  const base = createDefaultLayerAppearance('poi');
  if (base?.kind !== 'poi') throw new Error('POI appearance unavailable.');
  return {
    id, name, type: 'poi', visible: true, locked: false, opacity: 100,
    appearance: { ...base, color: style.color, size: style.size ?? 14, markerSymbol: style.symbol ?? 'none', markerShape: style.shape ?? 'circle', label: style.label ?? '' },
    geometry: { type: 'Point', coordinates },
  };
}

type AreaStyle = { fill: string; stroke: string; opacity: number; provenance?: ContentLayer['provenance'] };

function area(id: string, name: string, coordinates: Position[][], colors: AreaStyle): ContentLayer {
  return {
    id, name, type: 'shape', visible: true, locked: false, opacity: colors.opacity,
    appearance: { kind: 'shape', fillColor: colors.fill, strokeColor: colors.stroke, strokeWidth: 2, invert: false, label: name },
    geometry: { type: 'Polygon', coordinates },
    ...(colors.provenance && { provenance: colors.provenance }),
  };
}

function basemap(preset: MapStylePreset): ContentLayer {
  const label = preset.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
  return { id: 'basemap', name: `${label} basemap`, type: 'basemap', visible: true, locked: true, opacity: 100 };
}

type SceneInput = {
  id: string;
  title: string;
  page: ProjectDocument['page'];
  center: Position;
  zoom: number;
  preset: MapStylePreset;
  layers?: ContentLayer[];
  template?: PosterTemplate['id'];
  subtitle?: string;
};

function scene(input: SceneInput): ProjectDocument {
  const document = createNewProjectDocument();
  document.id = input.id;
  document.title = input.title;
  document.page = { ...input.page };
  document.camera = { ...document.camera, center: input.center, zoom: input.zoom };
  document.style = { ...document.style, preset: input.preset, visibility: { ...document.style.visibility, transit: false } };
  document.layers = [...(input.layers ?? []), basemap(input.preset)];
  if (input.template) {
    document.studio.poster = posterTemplateSettings(input.template, input.title, input.subtitle);
  }
  return document;
}

function validated(document: ProjectDocument): ProjectDocument {
  return parseProjectDocument(structuredClone(document));
}

function starter(id: string) {
  const found = POSTER_STARTERS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Missing starter ${id}.`);
  return found;
}

/**
 * The real "New from template → Start with a place" result, switched to an A3 portrait page.
 */
function starterProject(id: string, zoom: number, templateId?: PosterTemplate['id']): ProjectDocument {
  const start = starter(id);
  const document = structuredClone(createTemplateProject(templateId ?? start.templateId, start));
  document.page = { ...A3_PORTRAIT };
  document.camera = { ...document.camera, zoom };
  document.style.visibility = { ...document.style.visibility, transit: false };
  return document;
}

function lisbon(templateId?: PosterTemplate['id']): ProjectDocument {
  const document = starterProject('lisbon', 12.6, templateId);
  document.camera.center = [-9.1445, 38.7185];
  return document;
}

async function fileFromUrl(url: string, name: string, type: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}.`);
  return new File([await response.blob()], name, { type });
}

const HEART_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 108" width="120" height="108"><path d="M60 104C24 76 4 56 4 32 4 15 17 4 33 4c11 0 21 6 27 16C66 10 76 4 87 4c16 0 29 11 29 28 0 24-20 44-56 72z" fill="#b8475b" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/></svg>';

async function wedding(): Promise<ProjectDocument> {
  const heart = await validateCustomMarkerFile(new File([HEART_SVG], 'heart.svg', { type: 'image/svg+xml' }));
  const met = poi('where-we-met', 'Where we met', [-3.1925, 55.9407], { color: '#b8475b', size: 26, label: 'Where we met' });
  const married = poi('where-we-married', 'Where we married', [-3.1823, 55.9552], { color: '#b8475b', size: 26, label: 'Where we said yes' });
  const arc: ContentLayer = {
    id: 'our-story', name: 'Our story', type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'arc', closed: false },
    appearance: { ...createDefaultRouteAppearance(1), color: '#b8475b', width: 3, strokeStyle: 'dashed' },
    geometry: { type: 'Arc', anchors: [[-3.1925, 55.9407], [-3.1823, 55.9552]], curvatures: [0.3] },
  };
  for (const layer of [met, married]) {
    if (layer.appearance?.kind === 'poi') layer.appearance.customAssetId = heart.id;
  }
  const document = scene({
    id: 'isla-and-james', title: 'Isla & James', page: A3_PORTRAIT, center: [-3.1874, 55.948], zoom: 13.55, preset: 'rosewater',
    layers: [met, married, arc], template: 'classic', subtitle: 'Edinburgh · 14 June 2019',
  });
  document.assets = { [heart.id]: heart };
  const poster = document.studio.poster;
  poster.backgroundColor = '#fbf5f2';
  poster.title = { ...poster.title, color: '#5b2a35', fontSizePt: 40 };
  poster.subtitle = { ...poster.subtitle, color: '#5b2a35' };
  poster.coordinates = { ...poster.coordinates, color: '#5b2a35' };
  return document;
}

const PHOTO_STOPS = [
  { id: 'zion', name: 'Zion', file: 'zion-angels-landing.jpg', caption: 'Zion · Angels Landing' },
  { id: 'bryce', name: 'Bryce Canyon', file: 'bryce-canyon-hoodoos.jpg', caption: 'Bryce Canyon · Thor’s Hammer' },
  { id: 'capitol-reef', name: 'Capitol Reef', file: 'capitol-reef-canyon.jpg', caption: 'Capitol Reef · Grand Wash' },
  { id: 'arches', name: 'Arches', file: 'arches-delicate-arch.jpg', caption: 'Arches · Delicate Arch' },
] as const;

async function roadTrip(): Promise<ProjectDocument> {
  const { utah } = routes;
  const stopLayers = utah.waypoints.map((position, index) => poi(PHOTO_STOPS[index].id, PHOTO_STOPS[index].name, position as Position, { color: '#8a3b1e', size: 12 }));
  const route = roadRoute('utah-drive', 'Scenic drive', utah, { color: '#8a3b1e', width: 4, profile: 'driving', dashed: true });
  const document = scene({
    id: 'southern-utah-road-trip', title: 'Southern Utah', page: A3_LANDSCAPE, center: [-111.2978, 38.1013], zoom: 6.88, preset: 'sandstone',
    layers: [route, ...stopLayers], template: 'journey', subtitle: 'Four parks in nine days · 571 km',
  });
  const photos = document.studio.photos;
  for (const [index, stop] of PHOTO_STOPS.entries()) {
    const asset = await validatePhotoFile(await fileFromUrl(`/tests/marketing-media/photos/${stop.file}`, stop.file, 'image/jpeg'));
    photos.assets[asset.id] = asset;
    photos.stops.push({ id: `stop-${index + 1}`, layerId: stop.id, assetId: asset.id, caption: stop.caption });
  }
  photos.map = { ...photos.map, enabled: true, sizeMm: 22, borderWidthMm: 1.2 };
  photos.strip = { ...photos.strip, enabled: true, heightMm: 64, gapMm: 5 };
  document.studio.decorations.compass = { ...document.studio.decorations.compass, enabled: true, position: 'top-right', sizeMm: 14, color: '#453a2d' };
  return document;
}

function roadRoute(id: string, name: string, data: { waypoints: number[][]; geometry: number[][]; distanceMeters: number; durationSeconds: number }, line: { color: string; width: number; profile: 'driving' | 'cycling' | 'walking'; dashed?: boolean }): ContentLayer {
  const waypoints = data.waypoints as Position[];
  return {
    id, name, type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'road', closed: false },
    appearance: { ...createDefaultRouteAppearance(waypoints.length - 1), color: line.color, width: line.width, strokeStyle: line.dashed ? 'dashed' : 'solid' },
    geometry: { type: 'LineString', coordinates: data.geometry as Position[] },
    provenance: { provider: 'mapbox', service: 'directions-v5', waypoints, profile: line.profile, distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds },
  };
}

function ventoux(): ProjectDocument {
  const { ventoux: ride } = routes;
  const coordinates = ride.geometry as Position[];
  const document = scene({
    id: 'mont-ventoux', title: 'Mont Ventoux', page: A3_PORTRAIT, center: [5.2467, 44.1465], zoom: 11, preset: 'alpine',
    layers: [
      poi('summit', 'Summit', coordinates.at(-1) as Position, { color: '#1f2a30', size: 12, label: 'Sommet · 1,910 m' }),
      poi('bedoin', 'Bédoin', coordinates[0], { color: '#1f2a30', size: 12, label: 'Bédoin' }),
      roadRoute('ventoux-climb', 'Bédoin ascent', ride, { color: '#d9363e', width: 5, profile: 'cycling' }),
    ],
    template: 'minimal', subtitle: 'Bédoin ascent · 19 km · 1,610 m of climbing',
  });
  document.studio.terrain = { ...document.studio.terrain, contours: { enabled: true, intervalMeters: 50, color: '#7c7462', width: 1 } };
  return document;
}

function thames(): ProjectDocument {
  const { thames: run } = routes;
  const coordinates = run.geometry as Position[];
  const document = scene({
    id: 'thames-marathon', title: 'London, 42.3 km', page: A3_PORTRAIT, center: [-0.1253, 51.4862], zoom: 10.27, preset: 'night-ink',
    layers: [
      poi('finish', 'Finish', coordinates.at(-1) as Position, { color: '#ffffff', size: 16, label: 'Finish · Greenwich' }),
      poi('start', 'Start', coordinates[0], { color: '#ffffff', size: 16, label: 'Start · Tower Bridge' }),
      roadRoute('marathon', 'Marathon route', run, { color: '#ff7a2f', width: 7, profile: 'walking' }),
    ],
    template: 'gallery', subtitle: 'My first marathon along the Thames · 3:52:14',
  });
  document.style.visibility = { ...document.style.visibility, transit: false };
  return document;
}

function matterhorn(): ProjectDocument {
  const document = scene({
    id: 'matterhorn', title: 'Matterhorn', page: A3_LANDSCAPE, center: [7.704, 45.998], zoom: 12, preset: 'alpine',
    layers: [poi('summit', 'Matterhorn summit', [7.65861, 45.97639], { color: '#1f2a30', size: 12, label: 'Matterhorn · 4,478 m' })],
    template: 'minimal', subtitle: 'Zermatt and the Matterhorn · contours every 50 m',
  });
  document.studio.terrain = { ...document.studio.terrain, enabled: false, exaggeration: 1.4, contours: { enabled: true, intervalMeters: 50, color: '#6f6656', width: 1 } };
  return document;
}

function amsterdam(): ProjectDocument {
  // Smallest area first so it draws above the larger ones.
  const palette = [
    { minutes: 10, fill: '#d9603b', stroke: '#b8452a' },
    { minutes: 20, fill: '#e3a857', stroke: '#c9862d' },
    { minutes: 30, fill: '#7aa6c2', stroke: '#4d7f9e' },
  ];
  const layers = palette.map(({ minutes, fill, stroke }) => {
    const data = isochrones.amsterdam.find((candidate) => candidate.minutes === minutes);
    if (!data) throw new Error(`Missing ${minutes} minute isochrone.`);
    return area(`bike-${minutes}`, `${minutes} min walk`, data.coordinates as Position[][], {
      fill, stroke, opacity: 30,
      provenance: { provider: 'mapbox', service: 'isochrone-v1', center: data.center as Position, profile: 'walking', minutes },
    });
  });
  return scene({
    id: 'amsterdam-on-foot', title: 'Amsterdam on foot', page: A3_LANDSCAPE, center: [4.892, 52.3722], zoom: 11.95, preset: 'porcelain',
    layers: [poi('dam', 'Dam Square', [4.8932, 52.3731], { color: '#1f2a30', size: 14, label: 'Dam Square' }), ...layers],
    template: 'minimal', subtitle: '10, 20 and 30 minutes on foot from Dam Square',
  });
}

function clifton(): ProjectDocument {
  const { clifton: spots } = places;
  const walk = isochrones.cliftonWalk;
  const layers = [
    poi('home', 'Royal York Crescent', spots.home as Position, { color: '#1f3b57', size: 22, symbol: 'lodging', label: 'Royal York Crescent' }),
    poi('station', 'Clifton Down station', spots.station as Position, { color: '#3d7a6a', size: 16, symbol: 'information', label: 'Clifton Down station' }),
    poi('school', 'Christ Church Primary School', spots.school as Position, { color: '#3d7a6a', size: 16, symbol: 'information', label: 'Christ Church Primary' }),
    poi('park', 'Brandon Hill', spots.park as Position, { color: '#3d7a6a', size: 16, symbol: 'none', label: 'Brandon Hill park' }),
    poi('market', 'Whiteladies Road', spots.market as Position, { color: '#3d7a6a', size: 16, symbol: 'food', label: 'Whiteladies Road shops' }),
    poi('bridge', 'Clifton Suspension Bridge', spots.bridge as Position, { color: '#3d7a6a', size: 16, symbol: 'none', label: 'Suspension Bridge' }),
    area('walk-15', '15 min walk', walk.coordinates as Position[][], {
      fill: '#e2a65b', stroke: '#b9762c', opacity: 20,
      provenance: { provider: 'mapbox', service: 'isochrone-v1', center: walk.center as Position, profile: 'walking', minutes: 15 },
    }),
  ];
  const document = scene({
    id: 'royal-york-crescent', title: 'Royal York Crescent', page: A4_PORTRAIT, center: [-2.6177, 51.4549], zoom: 13.46, preset: 'porcelain',
    layers, template: 'minimal', subtitle: 'Clifton, Bristol · everything within a 15-minute walk',
  });
  const decorations = document.studio.decorations;
  decorations.qr = { ...decorations.qr, enabled: true, position: 'bottom-right', sizeMm: 22, target: 'layer', layerId: 'home' };
  decorations.scale = { ...decorations.scale, enabled: true, position: 'bottom-left', widthMm: 28 };
  decorations.compass = { ...decorations.compass, enabled: true, position: 'top-right', sizeMm: 12 };
  return document;
}

/**
Starting point for the country-outline poster; the outline itself is added through the Layout tab.
*/
function italy(): ProjectDocument {
  const document = scene({ id: 'italy', title: 'Italy', page: A3_PORTRAIT, center: [12.6, 41.9], zoom: 5.2, preset: 'terracotta', template: 'silhouette', subtitle: 'From the Alps to Sicily' });
  document.style.visibility = { ...document.style.visibility, transit: false };
  return document;
}

function matterhorn3d(): ProjectDocument {
  const document = scene({
    id: 'matterhorn-3d', title: 'Matterhorn in 3D', page: A3_LANDSCAPE, center: [7.6905, 45.9875], zoom: 12.9, preset: 'alpine',
    layers: [poi('summit', 'Matterhorn summit', [7.65861, 45.97639], { color: '#1f2a30', size: 12, label: 'Matterhorn · 4,478 m' })],
  });
  document.camera = { ...document.camera, pitch: 60, bearing: -125 };
  document.studio.terrain = { ...document.studio.terrain, enabled: true, exaggeration: 1.6, contours: { enabled: true, intervalMeters: 50, color: '#6f6656', width: 1 } };
  return document;
}

const builders: Record<string, () => ProjectDocument | Promise<ProjectDocument>> = {
  lisbon: () => lisbon(),
  'lisbon-quiet': () => lisbon('minimal'),
  'lisbon-dark': () => lisbon('gallery'),
  italy,
  kyoto: () => starterProject('kyoto', 12.45),
  'new-york': () => starterProject('new-york', 12.45),
  copenhagen: () => starterProject('copenhagen', 12.7),
  wedding,
  'road-trip': roadTrip,
  ventoux,
  thames,
  matterhorn,
  'matterhorn-3d': matterhorn3d,
  amsterdam,
  clifton,
};

export const SCENE_IDS = Object.keys(builders);

export async function buildScene(id: string): Promise<ProjectDocument> {
  const builder = builders[id];
  if (!builder) throw new Error(`Unknown scene ${id}.`);
  return validated(await builder());
}

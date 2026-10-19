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
  document.style = { ...document.style, textScalePercent: 90, visibility: { ...document.style.visibility, transit: false } };
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
  const met = poi('where-we-met', 'Where we met', [-3.1936, 55.9486], { color: '#b8475b', size: 26, label: 'Where we met' });
  const married = poi('where-we-married', 'Where we married', [-3.1802, 55.9559], { color: '#b8475b', size: 26, label: 'Where we said yes' });
  const arc: ContentLayer = {
    id: 'our-story', name: 'Our story', type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'arc', closed: false },
    appearance: { ...createDefaultRouteAppearance(1), color: '#b8475b', width: 3, strokeStyle: 'dashed' },
    geometry: { type: 'Arc', anchors: [[-3.1936, 55.9486], [-3.1802, 55.9559]], curvatures: [0.3] },
  };
  for (const layer of [met, married]) {
    if (layer.appearance?.kind === 'poi') layer.appearance.customAssetId = heart.id;
  }
  const document = scene({
    id: 'isla-and-james', title: 'Isla & James', page: A3_PORTRAIT, center: [-3.1869, 55.952], zoom: 13.55, preset: 'rosewater',
    layers: [met, married, arc], template: 'classic', subtitle: 'Edinburgh · 14 June 2019',
  });
  document.assets = { [heart.id]: heart };
  document.studio.wall = { ...document.studio.wall, frame: 'oak', matWidthMm: 40, matColor: '#ffffff', wallColor: '#e4ddd2' };
  document.style.textScalePercent = 90;
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
  const route = trackRoute('utah-drive', 'Scenic drive', utah.geometry as Position[], { color: '#8a3b1e', width: 4, dashed: true });
  const document = scene({
    id: 'southern-utah-road-trip', title: 'Southern Utah', page: A3_LANDSCAPE, center: [-111.3, 37.94], zoom: 6.2, preset: 'sandstone',
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

/**
 * A recorded track (like an imported GPX). Exact repeat positions are nudged by ~1 m because
 * straight routes need distinct points.
 */
function trackRoute(id: string, name: string, coordinates: Position[], line: { color: string; width: number; dashed?: boolean }): ContentLayer {
  const seen = new Set<string>();
  const distinct = coordinates.map(([longitude, latitude]) => {
    let position: Position = [longitude, latitude];
    while (seen.has(position.join(','))) position = [Number((position[0] + 0.00001).toFixed(5)), position[1]];
    seen.add(position.join(','));
    return position;
  });
  return {
    id, name, type: 'route', visible: true, locked: false, opacity: 100,
    route: { kind: 'straight', closed: false },
    appearance: { ...createDefaultRouteAppearance(distinct.length - 1), color: line.color, width: line.width, strokeStyle: line.dashed ? 'dashed' : 'solid' },
    geometry: { type: 'LineString', coordinates: distinct },
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
      trackRoute('ventoux-climb', 'Bédoin ascent', coordinates, { color: '#d9363e', width: 5 }),
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
    id: 'thames-marathon', title: 'London, 42.3 km', page: A3_PORTRAIT, center: [-0.1175, 51.4885], zoom: 10.05, preset: 'night-ink',
    layers: [
      poi('finish', 'Finish', coordinates.at(-1) as Position, { color: '#ffffff', size: 16, label: 'Finish' }),
      poi('start', 'Start', coordinates[0], { color: '#ffffff', size: 16, label: 'Start' }),
      trackRoute('marathon', 'Marathon route', coordinates, { color: '#ff7a2f', width: 7 }),
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
  document.studio.relief = { ...document.studio.relief, widthMm: 180, heightMm: 127, baseMm: 3, exaggeration: 1.5, detail: 'high' };
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
    });
  });
  return scene({
    id: 'amsterdam-on-foot', title: 'Amsterdam on foot', page: A3_LANDSCAPE, center: [4.892, 52.3722], zoom: 11.95, preset: 'porcelain',
    layers: [poi('dam', 'Dam Square', [4.8932, 52.3731], { color: '#1f2a30', size: 14, label: 'Dam Square' }), ...layers],
    template: 'minimal', subtitle: '10, 20 and 30 minutes on foot from Dam Square',
  });
}

function clifton(isBase = false): ProjectDocument {
  const { clifton: spots } = places;
  const walk = isochrones.cliftonWalk;
  const layers = [
    poi('home', 'Royal York Crescent', spots.home as Position, { color: '#1f3b57', size: 22, symbol: 'lodging', label: 'Royal York Crescent' }),
    poi('station', 'Clifton Down station', spots.station as Position, { color: '#3d7a6a', size: 16, symbol: 'information', label: 'Clifton Down station' }),
    poi('school', 'Christ Church Primary School', spots.school as Position, { color: '#3d7a6a', size: 16, symbol: 'information', label: 'Christ Church Primary' }),
    poi('park', 'Brandon Hill', spots.park as Position, { color: '#3d7a6a', size: 16, symbol: 'none', label: 'Brandon Hill park' }),
    poi('market', 'Whiteladies Road', [spots.market[0] + 0.0016, spots.market[1]] as Position, { color: '#3d7a6a', size: 16, symbol: 'food', label: 'Shops & cafés' }),
    poi('bridge', 'Clifton Suspension Bridge', spots.bridge as Position, { color: '#3d7a6a', size: 16, symbol: 'none', label: 'Suspension Bridge' }),
    area('walk-15', '15 min walk', walk.coordinates as Position[][], {
      fill: '#e2a65b', stroke: '#b9762c', opacity: 20,
    }),
  ];
  const kept = isBase ? layers.filter(({ id }) => id === 'home' || id === 'walk-15') : layers;
  const document = scene({
    id: isBase ? 'royal-york-crescent-draft' : 'royal-york-crescent', title: 'Royal York Crescent', page: A4_PORTRAIT, center: [-2.6177, 51.4549], zoom: 13.46, preset: 'porcelain',
    layers: kept, template: 'minimal', subtitle: 'Clifton, Bristol · everything within a 15-minute walk',
  });
  const decorations = document.studio.decorations;
  decorations.qr = { ...decorations.qr, enabled: true, position: 'bottom-right', sizeMm: 22, target: 'layer', layerId: 'home' };
  decorations.scale = { ...decorations.scale, enabled: true, position: 'bottom-left', widthMm: 28 };
  decorations.compass = { ...decorations.compass, enabled: true, position: 'top-right', sizeMm: 12 };
  return document;
}

/**
 * The country-outline poster, built the way Layout › Map frame › Country / region builds it,
 * but with a hand-tuned camera so the country fills the page and labels off for a shape-first look.
 */
async function italy(): Promise<ProjectDocument> {
  const response = await fetch('/data/administrative/countries/ITA.json');
  const shard = await response.json() as { country: { geometry: ContentLayer['geometry'] } };
  const document = scene({ id: 'italy', title: 'Italy', page: A3_PORTRAIT, center: [12.57, 41.5], zoom: 4.56, preset: 'terracotta', template: 'silhouette', subtitle: 'From the Alps to Sicily' });
  const paper = document.studio.poster.backgroundColor;
  const outline: ContentLayer = {
    id: 'silhouette-italy', name: 'Italy silhouette', type: 'shape', visible: true, locked: false, opacity: 100,
    appearance: { kind: 'shape', fillColor: paper, strokeColor: paper, strokeWidth: 0.5, invert: true },
    geometry: shard.country.geometry,
  };
  document.layers = [outline, ...document.layers];
  document.studio.poster.silhouetteLayerId = outline.id;
  document.style.visibility = { ...document.style.visibility, labels: false, transit: false };
  return document;
}

function matterhorn3d(): ProjectDocument {
  const document = scene({
    id: 'matterhorn-3d', title: 'Matterhorn in 3D', page: A3_LANDSCAPE, center: [7.6672, 45.9818], zoom: 12.15, preset: 'alpine',
    layers: [poi('summit', 'Matterhorn summit', [7.65861, 45.97639], { color: '#1f2a30', size: 12, label: 'Matterhorn · 4,478 m' })],
  });
  document.camera = { ...document.camera, pitch: 60, bearing: -125 };
  document.studio.terrain = { ...document.studio.terrain, enabled: true, exaggeration: 1.6, contours: { enabled: true, intervalMeters: 50, color: '#6f6656', width: 1 } };
  return document;
}

function videoNewYork(): ProjectDocument {
  const document = starterProject('new-york', 12.35);
  document.page = { ...A3_LANDSCAPE };
  document.camera.center = [-73.982, 40.758];
  document.studio.video = { motion: 'orbit', durationSeconds: 10, fps: 30, aspect: 'page', quality: 'standard' };
  return document;
}

function styleSample(): ProjectDocument {
  return scene({ id: 'style-sample', title: 'Copenhagen', page: { preset: 'A4', widthMm: 297, heightMm: 210, orientation: 'landscape' }, center: [12.5795, 55.6805], zoom: 13.1, preset: 'paper' });
}

/**
 * The hero project: the Lisbon starter with a walking day across the centre.
 */
function lisbonWalk(): ProjectDocument {
  const document = lisbon();
  document.title = 'A day in Lisbon';
  document.camera = { ...document.camera, center: [-9.1405, 38.7165], zoom: 13.45 };
  document.studio.poster.subtitle = { ...document.studio.poster.subtitle, text: 'From Marquês de Pombal to the Graça viewpoint' };
  const ink = '#24303a';
  document.layers = [
    poi('graca', 'Miradouro da Graça', [-9.1316, 38.7163], { color: ink, size: 14, label: 'Miradouro da Graça' }),
    poi('castelo', 'Castelo de São Jorge', [-9.1334, 38.7139], { color: ink, size: 14, label: 'Castelo de São Jorge' }),
    poi('comercio', 'Praça do Comércio', [-9.1365, 38.7077], { color: ink, size: 14, label: 'Praça do Comércio' }),
    poi('pombal', 'Marquês de Pombal', [-9.15, 38.7253], { color: ink, size: 14, label: 'Marquês de Pombal' }),
    trackRoute('lisbon-walk', 'Walking route', routes.lisbonWalk.geometry as Position[], { color: '#c8553d', width: 5 }),
    ...document.layers,
  ];
  return document;
}

function lisbonGerman(): ProjectDocument {
  const document = lisbon();
  document.style = { ...document.style, language: 'de', textScalePercent: 110 };
  return document;
}

function lisbonQuietDetails(): ProjectDocument {
  const document = lisbon('minimal');
  document.style.visibility = { ...document.style.visibility, roads: false, buildings: false, transit: false };
  return document;
}

/**
 * Editor-only variants: the same route stored as a road route, so selecting it shows a handle
 * per waypoint instead of one per recorded track point.
 */
function withRoadRoute(document: ProjectDocument, layerId: string, data: { waypoints: number[][]; distanceMeters: number; durationSeconds: number }, profile: 'driving' | 'cycling' | 'walking'): ProjectDocument {
  const waypoints = data.waypoints as Position[];
  document.layers = document.layers.map((layer) => layer.id !== layerId || layer.appearance?.kind !== 'route' ? layer : {
    ...layer,
    route: { kind: 'road', closed: false },
    appearance: { ...layer.appearance, segmentStyles: waypoints.slice(1).map(() => null) },
    provenance: { provider: 'mapbox', service: 'directions-v5', waypoints, profile, distanceMeters: data.distanceMeters, durationSeconds: data.durationSeconds },
  });
  return document;
}

const builders: Record<string, () => ProjectDocument | Promise<ProjectDocument>> = {
  lisbon: () => lisbon(),
  'lisbon-quiet': () => lisbon('minimal'),
  'lisbon-dark': () => lisbon('gallery'),
  'lisbon-german': lisbonGerman,
  'lisbon-walk': lisbonWalk,
  'lisbon-walk-phone': () => {
    const document = lisbonWalk();
    document.camera = { ...document.camera, center: [-9.1415, 38.7165], zoom: 12.45 };
    return document;
  },
  'lisbon-details': lisbonQuietDetails,
  italy,
  'style-sample': styleSample,
  kyoto: () => starterProject('kyoto', 12.45),
  'new-york': () => starterProject('new-york', 12.45),
  'video-new-york': videoNewYork,
  copenhagen: () => starterProject('copenhagen', 12.7),
  wedding,
  'road-trip': roadTrip,
  ventoux,
  'ventoux-editor': () => withRoadRoute(ventoux(), 'ventoux-climb', routes.ventoux, 'cycling'),
  'thames-editor': () => withRoadRoute(thames(), 'marathon', routes.thames, 'walking'),
  'road-trip-editor': async () => withRoadRoute(await roadTrip(), 'utah-drive', routes.utah, 'driving'),
  thames,
  matterhorn,
  'matterhorn-3d': matterhorn3d,
  amsterdam,
  clifton: () => clifton(),
  'clifton-base': () => clifton(true),
};

export const SCENE_IDS = Object.keys(builders);

export async function buildScene(id: string): Promise<ProjectDocument> {
  const builder = builders[id];
  if (!builder) throw new Error(`Unknown scene ${id}.`);
  return validated(await builder());
}

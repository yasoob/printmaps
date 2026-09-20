import type { ContentLayer } from './project';
import type { PhotoAsset, StudioSettings } from './studio';
import { ProjectFileError } from './projectFileError';
import { parseDecorationSettings, parsePosterSettings } from './studioPosterFile';
import { parseReliefSettings, parseTerrainSettings, parseVideoSettings, parseWallSettings } from './studioOutputFile';
import { parsePhotoSettings } from './studioPhotosFile';
import { cachedStudioValue, studioObject } from './studioValidation';

export class StudioValidationCache {
  readonly studio = new WeakMap<object, StudioSettings>();
  readonly poster = new WeakMap<object, StudioSettings['poster']>();
  readonly photos = new WeakMap<object, StudioSettings['photos']>();
  readonly photoAssets = new WeakMap<object, Record<string, PhotoAsset>>();
  readonly decorations = new WeakMap<object, StudioSettings['decorations']>();
  readonly wall = new WeakMap<object, StudioSettings['wall']>();
  readonly terrain = new WeakMap<object, StudioSettings['terrain']>();
  readonly video = new WeakMap<object, StudioSettings['video']>();
  readonly relief = new WeakMap<object, StudioSettings['relief']>();
}

export function parseStudioSettings(value: unknown, layers: readonly ContentLayer[], cache?: StudioValidationCache): StudioSettings {
  const parsed = cachedStudioValue(value, (value) => {
    const studio = studioObject(value, 'Studio', ['poster', 'photos', 'decorations', 'wall', 'terrain', 'video', 'relief']);
    return {
      poster: cachedStudioValue(studio.poster, parsePosterSettings, cache?.poster),
      photos: cachedStudioValue(studio.photos, (value) => parsePhotoSettings(value, cache?.photoAssets), cache?.photos),
      decorations: cachedStudioValue(studio.decorations, parseDecorationSettings, cache?.decorations),
      wall: cachedStudioValue(studio.wall, parseWallSettings, cache?.wall),
      terrain: cachedStudioValue(studio.terrain, parseTerrainSettings, cache?.terrain),
      video: cachedStudioValue(studio.video, parseVideoSettings, cache?.video),
      relief: cachedStudioValue(studio.relief, parseReliefSettings, cache?.relief),
    };
  }, cache?.studio);
  validateStudioReferences(parsed, layers);
  return parsed;
}

function validateSilhouetteReference(id: string | null, byId: ReadonlyMap<string, ContentLayer>) {
  if (id === null) return;
  const layer = byId.get(id);
  if (layer?.type !== 'shape' || !['Polygon', 'MultiPolygon'].includes(layer.geometry?.type ?? '')) {
    throw new ProjectFileError('The poster silhouette must reference a polygon shape layer.');
  }
}

function validateReliefReference(ridge: StudioSettings['relief']['routeRidge'], byId: ReadonlyMap<string, ContentLayer>) {
  const route = ridge.layerId === null ? null : byId.get(ridge.layerId);
  if (!route && ridge.enabled) throw new ProjectFileError('An enabled route ridge needs a route layer.');
  if (ridge.layerId !== null && (route?.type !== 'route' || !route.geometry)) {
    throw new ProjectFileError('The relief ridge must reference an existing route with geometry.');
  }
}

export function validateStudioReferences(studio: StudioSettings, layers: readonly ContentLayer[]) {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  validateSilhouetteReference(studio.poster.silhouetteLayerId, byId);
  validateReliefReference(studio.relief.routeRidge, byId);
  const isPoint = (id: string) => byId.get(id)?.type === 'poi' && byId.get(id)?.geometry?.type === 'Point';
  if (studio.photos.stops.some(({ layerId }) => !isPoint(layerId))) {
    throw new ProjectFileError('Photo stops must reference existing Point POI layers.');
  }
  const qr = studio.decorations.qr;
  if (qr.target === 'layer' ? qr.layerId === null || !isPoint(qr.layerId) : qr.layerId !== null) {
    throw new ProjectFileError('Location QR must reference an existing Point POI or use the map center without a layer ID.');
  }
}

export function removeStudioLayerReferences(studio: StudioSettings, layerId: string): StudioSettings {
  const stops = studio.photos.stops.filter((stop) => stop.layerId !== layerId);
  const assetIds = new Set(stops.map((stop) => stop.assetId));
  const poster = studio.poster.silhouetteLayerId === layerId ? { ...studio.poster, silhouetteLayerId: null } : studio.poster;
  const photos = stops.length === studio.photos.stops.length ? studio.photos : {
    ...studio.photos, stops,
    assets: Object.fromEntries(Object.entries(studio.photos.assets).filter(([id]) => assetIds.has(id))),
  };
  const decorations = studio.decorations.qr.layerId === layerId ? {
    ...studio.decorations, qr: { ...studio.decorations.qr, enabled: false, target: 'map-center' as const, layerId: null },
  } : studio.decorations;
  const relief = studio.relief.routeRidge.layerId === layerId ? {
    ...studio.relief, routeRidge: { ...studio.relief.routeRidge, enabled: false, layerId: null },
  } : studio.relief;
  if (poster === studio.poster && photos === studio.photos && decorations === studio.decorations && relief === studio.relief) return studio;
  return { ...studio, poster, photos, decorations, relief };
}

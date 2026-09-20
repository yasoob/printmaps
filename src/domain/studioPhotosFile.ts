import type { PhotoAsset, PhotoSettings, PhotoStop } from './studio';
import { MAX_PHOTO_STOPS, parsePhotoAssets } from './studioPhotoAssets';
import { ProjectFileError } from './projectFileError';
import { cachedStudioValue, studioBoolean, studioColor, studioEnum, studioId, studioNumber, studioObject, studioString } from './studioValidation';

function photoStops(value: unknown): PhotoStop[] {
  if (!Array.isArray(value) || value.length > MAX_PHOTO_STOPS) {
    throw new ProjectFileError(`Photo stops must be an array of at most ${MAX_PHOTO_STOPS} stops.`);
  }
  const ids = new Set<string>();
  return value.map((candidate) => {
    const stop = studioObject(candidate, 'Photo stop', ['id', 'layerId', 'assetId', 'caption']);
    const id = studioId(stop.id, 'Photo stop ID');
    if (ids.has(id)) throw new ProjectFileError('Photo stop IDs must be unique.');
    ids.add(id);
    return {
      id, layerId: studioId(stop.layerId, 'Photo POI layer ID'),
      assetId: studioId(stop.assetId, 'Photo asset ID'),
      caption: studioString(stop.caption, 'Photo caption', 500),
    };
  });
}

export function parsePhotoSettings(value: unknown, assetsCache?: WeakMap<object, Record<string, PhotoAsset>>): PhotoSettings {
  const photos = studioObject(value, 'Photos', ['assets', 'stops', 'map', 'strip']);
  const map = studioObject(photos.map, 'Map photos', ['enabled', 'sizeMm', 'borderColor', 'borderWidthMm', 'shape']);
  const strip = studioObject(photos.strip, 'Photo strip', ['enabled', 'position', 'heightMm', 'gapMm', 'showCaptions', 'backgroundColor']);
  const assets = cachedStudioValue(photos.assets, parsePhotoAssets, assetsCache);
  const stops = photoStops(photos.stops);
  const referenced = new Set(stops.map(({ assetId }) => assetId));
  if (stops.some(({ assetId }) => !Object.hasOwn(assets, assetId))) throw new ProjectFileError('A photo stop references a missing photo asset.');
  if (Object.keys(assets).some((id) => !referenced.has(id))) throw new ProjectFileError('Photo assets must be referenced by a photo stop.');
  return {
    assets, stops,
    map: {
      enabled: studioBoolean(map.enabled, 'Map photos enabled'),
      sizeMm: studioNumber(map.sizeMm, 'Map photo size', [5, 100]),
      borderColor: studioColor(map.borderColor, 'Map photo border color'),
      borderWidthMm: studioNumber(map.borderWidthMm, 'Map photo border width', [0, 10]),
      shape: studioEnum(map.shape, 'Map photo shape', ['circle', 'square']),
    },
    strip: {
      enabled: studioBoolean(strip.enabled, 'Photo strip enabled'),
      position: studioEnum(strip.position, 'Photo strip position', ['top', 'bottom']),
      heightMm: studioNumber(strip.heightMm, 'Photo strip height', [10, 100]),
      gapMm: studioNumber(strip.gapMm, 'Photo strip gap', [0, 20]),
      showCaptions: studioBoolean(strip.showCaptions, 'Photo captions'),
      backgroundColor: studioColor(strip.backgroundColor, 'Photo strip background'),
    },
  };
}

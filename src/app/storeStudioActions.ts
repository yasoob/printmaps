import { cloneContentLayer, mapStyleBasemapName, type ContentLayer, type ProjectDocument } from '../domain/project';
import { MAP_STYLE_PRESETS } from '../domain/mapStylePresets';
import { mutationRejected } from '../domain/projectMutation';
import type { PhotoSettings, PhotoStopInsertion, StudioTemplateApplication } from '../domain/studio';
import type { ProjectState } from './store';
import { commitDocument, type ProjectSet } from './storeMutation';

type StudioActions = Pick<ProjectState, 'setStudioSection' | 'applyStudioTemplate' | 'addPhotoStop' | 'removePhotoStop'>;
const GENERATED_BASEMAP_NAMES = new Set(MAP_STYLE_PRESETS.map(({ id }) => mapStyleBasemapName(id)));

function areSettingsEqual(current: unknown, candidate: unknown): boolean {
  if (current === candidate) return true;
  if (typeof current !== 'object' || current === null || typeof candidate !== 'object' || candidate === null
    || Array.isArray(current) !== Array.isArray(candidate)) return false;
  if (Array.isArray(candidate)) {
    if (candidate.length !== Reflect.get(current, 'length')) return false;
  } else if (![Object.prototype, null].includes(Object.getPrototypeOf(candidate))) return false;
  const keys = Object.keys(current);
  if (keys.length !== Object.keys(candidate).length) return false;
  return keys.every((key) => Object.hasOwn(candidate, key) && areSettingsEqual(Reflect.get(current, key), Reflect.get(candidate, key)));
}

function insertLayer(layers: ContentLayer[], layer: ContentLayer): ContentLayer[] {
  const result = [...layers];
  result.splice(result.findIndex(({ type }) => type === 'basemap'), 0, cloneContentLayer(layer));
  return result;
}

function templateSetting<T extends object>(current: T, candidate: T | undefined): T {
  return candidate && !areSettingsEqual(current, candidate) ? structuredClone(candidate) : current;
}

function templateDocument(document: ProjectDocument, application: StudioTemplateApplication): ProjectDocument {
  const page = templateSetting(document.page, application.page);
  const style = templateSetting(document.style, application.style);
  const camera = templateSetting(document.camera, application.camera);
  const poster = application.silhouette
    ? { ...application.poster, silhouetteLayerId: application.silhouette.id }
    : application.poster;
  const studio = areSettingsEqual(document.studio.poster, poster) ? document.studio : { ...document.studio, poster };
  let layers = application.silhouette ? insertLayer(document.layers, application.silhouette) : document.layers;
  if (style.preset !== document.style.preset) {
    layers = layers.map((layer) => layer.type === 'basemap' && GENERATED_BASEMAP_NAMES.has(layer.name)
      ? { ...layer, name: mapStyleBasemapName(style.preset) } : layer);
  }
  if (page === document.page && camera === document.camera && style === document.style && studio === document.studio && layers === document.layers) return document;
  return { ...document, page, camera, style, studio, layers };
}

function createTemplateAction(set: ProjectSet): ProjectState['applyStudioTemplate'] {
  return (application) => set((state) => {
    if (application.expectedDocumentEpoch !== undefined && application.expectedDocumentEpoch !== state.documentEpoch) {
      return mutationRejected('The project changed before the template was ready. Choose the template again.', 'stale');
    }
    if (state.document.camera.locked && application.camera !== undefined
      && !areSettingsEqual(state.document.camera, application.camera)) {
      return mutationRejected('Unlock the map area before applying a template that changes its camera.', 'unavailable');
    }
    const shape = application.silhouette;
    if (shape && (shape.type !== 'shape' || state.document.layers.some(({ id }) => id === shape.id))) {
      return mutationRejected('A template silhouette must be a new shape with a unique layer ID.');
    }
    const document = templateDocument(state.document, application);
    return document === state.document ? state : {
      ...commitDocument(state, document),
      ...(shape && { selectedId: shape.id }),
    };
  });
}

function photoInsertionError(state: ProjectState, input: PhotoStopInsertion) {
  if (input.expectedDocumentEpoch !== undefined && input.expectedDocumentEpoch !== state.documentEpoch) {
    return mutationRejected('The project changed before the photo was ready. Choose the photo again.', 'stale');
  }
  const { stop, asset, poi } = input;
  if (state.document.studio.photos.stops.some(({ id }) => id === stop.id)) return mutationRejected('Photo stop IDs must be unique.');
  if (stop.assetId !== asset.id) return mutationRejected('The photo stop must reference the inserted asset.');
  if (poi && (poi.id !== stop.layerId || poi.type !== 'poi' || state.document.layers.some(({ id }) => id === poi.id))) {
    return mutationRejected('A photo insertion needs a new Point POI with a unique layer ID matching its stop.');
  }
  const existing = Object.hasOwn(state.document.studio.photos.assets, asset.id) ? state.document.studio.photos.assets[asset.id] : undefined;
  if (existing && !areSettingsEqual(existing, asset)) return mutationRejected('An existing photo asset cannot be replaced with different image data.');
}

function photoPresentation(photos: PhotoSettings, presentation: PhotoStopInsertion['presentation']): PhotoSettings {
  if (!presentation || photos.map.enabled || photos.strip.enabled) return photos;
  return { ...photos, [presentation]: { ...photos[presentation], enabled: true } };
}

function createPhotoInsertionAction(set: ProjectSet): ProjectState['addPhotoStop'] {
  return (input) => set((state) => {
    if (input.presentation !== undefined && !['map', 'strip'].includes(input.presentation)) {
      return mutationRejected('Photo presentation must be map or strip.');
    }
    const error = photoInsertionError(state, input);
    if (error) return error;
    const { document } = state;
    const photos = photoPresentation(document.studio.photos, input.presentation);
    const { stop, asset, poi } = input;
    const assets = Object.hasOwn(photos.assets, asset.id) ? photos.assets : { ...photos.assets, [asset.id]: asset };
    return {
      ...commitDocument(state, {
        ...document,
        layers: poi ? insertLayer(document.layers, poi) : document.layers,
        studio: { ...document.studio, photos: { ...photos, assets, stops: [...photos.stops, stop] } },
      }),
      ...(poi && { selectedId: poi.id }),
    };
  });
}

export function createStudioActions(set: ProjectSet): StudioActions {
  return {
    setStudioSection: (section, value) => set((state) => {
      if (!Object.hasOwn(state.document.studio, section)) return mutationRejected('The studio section is not supported.');
      if (areSettingsEqual(state.document.studio[section], value)) return state;
      return commitDocument(state, { ...state.document, studio: { ...state.document.studio, [section]: value } });
    }),
    applyStudioTemplate: createTemplateAction(set),
    addPhotoStop: createPhotoInsertionAction(set),
    removePhotoStop: (id) => set((state) => {
      const { document } = state;
      const photos = document.studio.photos;
      if (photos.stops.every((stop) => stop.id !== id)) return mutationRejected('This photo stop no longer exists.', 'unavailable');
      const stops = photos.stops.filter((stop) => stop.id !== id);
      const referenced = new Set(stops.map((stop) => stop.assetId));
      const assets = Object.fromEntries(Object.entries(photos.assets).filter(([assetId]) => referenced.has(assetId)));
      return commitDocument(state, {
        ...document, studio: { ...document.studio, photos: { ...photos, stops, assets } },
      });
    }),
  };
}

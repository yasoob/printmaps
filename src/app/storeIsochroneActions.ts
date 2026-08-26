import { createDefaultLayerAppearance, type ContentLayer, type IsochroneAreaInput, type ShapeGeometry } from '../domain/project';
import { parseLayerGeometry } from '../domain/projectGeometry';
import { isValidPosition } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

const PROFILES = ['driving', 'cycling', 'walking'] as const;
const MAX_LABEL_CHARACTERS = 120;
const MAX_POSITIONS = 50_000;

function canonicalInput(input: IsochroneAreaInput) {
  if (!isValidPosition(input.center[0], input.center[1])) return null;
  if (!PROFILES.includes(input.profile)) return null;
  if (!Number.isSafeInteger(input.minutes) || input.minutes < 5 || input.minutes > 60) return null;
  if (!input.label || input.label.trim() !== input.label || [...input.label].length > MAX_LABEL_CHARACTERS) return null;
  try {
    const geometry = parseLayerGeometry(
      input.geometry,
      'Travel-time area',
      { value: 0 },
      { fail: (message) => { throw new Error(message); }, maximumCoordinates: MAX_POSITIONS },
    );
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null;
    return { ...input, center: [...input.center] as [number, number], geometry };
  } catch {
    return null;
  }
}

function nextIsochroneId(layers: readonly ContentLayer[]) {
  const usedIds = new Set(layers.map(({ id }) => id));
  let number = 1;
  while (usedIds.has(`isochrone-${String(number).padStart(2, '0')}`)) number += 1;
  return `isochrone-${String(number).padStart(2, '0')}`;
}

function isochroneLayer(id: string, input: ReturnType<typeof canonicalInput>): ContentLayer | null {
  if (!input) return null;
  const appearance = createDefaultLayerAppearance('shape');
  if (appearance?.kind !== 'shape') return null;
  return {
    id,
    name: input.label,
    type: 'shape',
    visible: true,
    locked: false,
    opacity: 28,
    appearance: { ...appearance, label: input.label },
    geometry: input.geometry as ShapeGeometry,
    provenance: {
      provider: 'mapbox',
      service: 'isochrone-v1',
      center: input.center,
      profile: input.profile,
      minutes: input.minutes,
    },
  };
}

export function createIsochroneActions(set: ProjectSet): Pick<ProjectState, 'createIsochroneArea'> {
  return {
    createIsochroneArea: (candidate, expectedDocumentEpoch) => {
      let createdId: string | null = null;
      set((state) => {
        if (state.documentEpoch !== expectedDocumentEpoch) return state;
        const input = canonicalInput(candidate);
        const id = nextIsochroneId(state.document.layers);
        const layer = isochroneLayer(id, input);
        if (!layer) return state;
        createdId = id;
        const layers = [...state.document.layers];
        const basemapIndex = layers.findIndex(({ type }) => type === 'basemap');
        layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, layer);
        return {
          ...commitDocument(state, replaceLayers(state.document, layers)),
          selectedId: id,
        };
      });
      return createdId;
    },
  };
}

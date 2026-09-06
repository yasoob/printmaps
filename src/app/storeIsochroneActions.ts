import { createDefaultLayerAppearance, type ContentLayer, type IsochroneAreaInput, type ShapeGeometry } from '../domain/project';
import { parseLayerGeometry } from '../domain/projectGeometry';
import { isValidPosition } from '../domain/routeGeometry';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';
import { mutationRejected } from '../domain/projectMutation';
import { ProjectFileError } from '../domain/projectFileError';
import { MAX_POI_LABEL_CHARACTERS } from '../domain/poiMarkers';

const PROFILES = ['driving', 'cycling', 'walking'] as const;
const MAX_POSITIONS = 50_000;
const isValidLabel = (label: string) => Boolean(label) && label.trim() === label && [...label].length <= MAX_POI_LABEL_CHARACTERS;

function canonicalInput(input: IsochroneAreaInput) {
  if (!isValidPosition(input.center[0], input.center[1])) return null;
  if (!PROFILES.includes(input.profile)) return null;
  if (!Number.isSafeInteger(input.minutes) || input.minutes < 5 || input.minutes > 60) return null;
  if (!isValidLabel(input.label)) return null;
  try {
    const geometry = parseLayerGeometry(
      input.geometry,
      'Travel-time area',
      { value: 0 },
      { fail: (message) => { throw new ProjectFileError(message); }, maximumCoordinates: MAX_POSITIONS },
    );
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null;
    return { ...input, center: [...input.center] as [number, number], geometry };
  } catch (error) {
    if (!(error instanceof ProjectFileError)) throw error;
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
      const admission = set((state) => {
        if (state.documentEpoch !== expectedDocumentEpoch) return mutationRejected('The project changed before the area was ready. Generate the area again.', 'stale');
        const input = canonicalInput(candidate);
        const id = nextIsochroneId(state.document.layers);
        const layer = isochroneLayer(id, input);
        if (!layer) return mutationRejected('The travel-time area is invalid. Check its location and options and try again.');
        createdId = id;
        const layers = [...state.document.layers];
        const basemapIndex = layers.findIndex(({ type }) => type === 'basemap');
        layers.splice(basemapIndex === -1 ? layers.length : basemapIndex, 0, layer);
        return {
          ...commitDocument(state, replaceLayers(state.document, layers)),
          selectedId: id,
        };
      });
      if (!admission.ok) return admission;
      return createdId ? { ok: true, layerId: createdId } : mutationRejected('The area could not be added. Nothing was changed.');
    },
  };
}

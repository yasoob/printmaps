import { createDefaultLayerAppearance, type ContentLayer } from '../domain/project';
import { boundedGeneratedName } from '../domain/projectLimits';
import { mutationRejected } from '../domain/projectMutation';
import type { ProjectState } from './store';
import { commitDocument, replaceLayers, type ProjectSet } from './storeDocument';

export function createAdministrativeAreaActions(
  set: ProjectSet,
): Pick<ProjectState, 'createAdministrativeArea'> {
  return {
    createAdministrativeArea: (area) => {
      let createdId: string | null = null;
      const admission = set((state) => {
        if (!area.id.trim()) return mutationRejected('Choose an administrative boundary before adding an area.');
        const usedIds = new Set(state.document.layers.map(({ id }) => id));
        const baseId = `admin-${area.id.toLowerCase().replaceAll('+', '-')}`;
        let id = boundedGeneratedName(baseId, '');
        let suffix = 2;
        while (usedIds.has(id)) id = boundedGeneratedName(baseId, `-${suffix++}`);
        const layer: ContentLayer = {
          id,
          name: area.name,
          type: 'shape',
          visible: true,
          locked: false,
          opacity: 28,
          appearance: createDefaultLayerAppearance('shape'),
          geometry: structuredClone(area.geometry),
        };
        const layers = [...state.document.layers];
        layers.splice(layers.findIndex(({ type }) => type === 'basemap'), 0, layer);
        createdId = id;
        return { ...commitDocument(state, replaceLayers(state.document, layers)), selectedId: id };
      });
      if (!admission.ok) return admission;
      return createdId ? { ok: true, layerId: createdId } : mutationRejected('The area could not be added. Nothing was changed.');
    },
  };
}

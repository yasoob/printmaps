import type { StoreApi } from 'zustand/vanilla';
import type { ProjectDocument } from '../domain/project';
import { parseProjectDocument, ProjectFileError, ProjectValidationCache } from '../domain/projectFile';
import { MAX_PROJECT_LAYERS } from '../domain/projectLimits';
import { ProjectSizeError } from '../domain/projectSerialization';
import { mutationRejected, type ProjectMutationFailure, type ProjectMutationResult } from '../domain/projectMutation';
import type { ProjectState } from './store';
import { pushHistoryEntry } from './storeDocument';

const RECORD_HISTORY = Symbol('record project history');
type ProjectPatch = Partial<ProjectState> & { [RECORD_HISTORY]?: true };
export type ProjectSet = (
  update: ProjectPatch | ((state: ProjectState) => ProjectPatch | ProjectMutationFailure),
) => ProjectMutationResult;

export function commitDocument(_state: ProjectState, document: ProjectDocument): ProjectPatch {
  return { document, [RECORD_HISTORY]: true };
}

function admissionFailure(document: ProjectDocument, current: ProjectDocument, cache: ProjectValidationCache) {
  if (document.layers.length > MAX_PROJECT_LAYERS) {
    const available = Math.max(0, MAX_PROJECT_LAYERS - current.layers.length);
    return mutationRejected(
      `This project has room for ${available} more ${available === 1 ? 'layer' : 'layers'} (maximum ${MAX_PROJECT_LAYERS}, including the basemap). Nothing was added. Reduce this batch or remove layers and try again.`,
      'capacity',
    );
  }
  try {
    parseProjectDocument(document, cache);
    return null;
  } catch (error) {
    if (!(error instanceof ProjectFileError)) throw error;
    return mutationRejected(`${error.message} Nothing was changed.`, error instanceof ProjectSizeError || /positions|project limit|at most \d+ custom marker assets|Custom marker assets exceed/.test(error.message) ? 'capacity' : 'invalid');
  }
}

export function createProjectSetter(
  set: StoreApi<ProjectState>['setState'],
  cache: ProjectValidationCache,
): ProjectSet {
  return (update) => {
    let result: ProjectMutationResult = { ok: true, changed: false };
    set((state) => {
      const proposed = typeof update === 'function' ? update(state) : update;
      if ('ok' in proposed && proposed.ok === false) {
        result = proposed;
        return state;
      }
      if (proposed === state) return state;
      const { [RECORD_HISTORY]: recordHistory, ...patch } = proposed as ProjectPatch;
      if (patch.document && patch.document !== state.document) {
        const failure = admissionFailure(patch.document, state.document, cache);
        if (failure) {
          result = failure;
          return state;
        }
        if (recordHistory) {
          const previous = cache.snapshots.get(state.document) ?? parseProjectDocument(state.document, cache);
          patch.past = pushHistoryEntry(state.past, previous);
          patch.future = [];
          patch.canUndo = true;
          patch.canRedo = false;
        }
      }
      result = { ok: true, changed: true };
      return patch;
    });
    return result;
  };
}

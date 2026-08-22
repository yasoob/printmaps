import type { StoreApi } from 'zustand/vanilla';
import {
  cloneContentLayer,
  migrateProjectDocument,
  type ContentLayer,
  type ProjectDocument,
} from '../domain/project';
import type { ProjectState } from './store';

export type ProjectSet = StoreApi<ProjectState>['setState'];

export function copyDocument(document: ProjectDocument): ProjectDocument {
  return {
    ...document,
    page: { ...document.page },
    camera: { ...document.camera },
    layers: document.layers.map((layer) => cloneContentLayer(layer)),
  };
}

export function replaceLayers(document: ProjectDocument, layers: ContentLayer[]): ProjectDocument {
  return { ...document, layers };
}

export function commitDocument(state: ProjectState, document: ProjectDocument) {
  return {
    document,
    past: [...state.past, copyDocument(state.document)],
    future: [],
    canUndo: true,
    canRedo: false,
  };
}

export function createDocumentActions(set: ProjectSet): Pick<ProjectState, 'openDocument' | 'undo' | 'redo'> {
  return {
    openDocument: (storedDocument) => {
      const openedDocument = copyDocument(migrateProjectDocument(storedDocument));
      set((state) => ({
        document: openedDocument,
        documentEpoch: state.documentEpoch + 1,
        selectedId: null,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      }));
    },
    undo: () => set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;
      const past = state.past.slice(0, -1);

      return {
        document: copyDocument(previous),
        selectedId: state.selectedId && previous.layers.some((layer) => layer.id === state.selectedId)
          ? state.selectedId
          : null,
        past,
        future: [copyDocument(state.document), ...state.future],
        canUndo: past.length > 0,
        canRedo: true,
      };
    }),
    redo: () => set((state) => {
      const next = state.future[0];
      if (!next) return state;
      const future = state.future.slice(1);

      return {
        document: copyDocument(next),
        selectedId: state.selectedId && next.layers.some((layer) => layer.id === state.selectedId)
          ? state.selectedId
          : null,
        past: [...state.past, copyDocument(state.document)],
        future,
        canUndo: true,
        canRedo: future.length > 0,
      };
    }),
  };
}

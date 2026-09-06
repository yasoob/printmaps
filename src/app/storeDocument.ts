import {
  cloneContentLayer,
  type ContentLayer,
  type ProjectDocument,
} from '../domain/project';
import { hasExactlyOneBottomBasemap } from '../domain/projectLayerStructure';
import type { ProjectState } from './store';
import { commitDocument, type ProjectSet } from './storeMutation';

export { commitDocument, type ProjectSet } from './storeMutation';

/**
 * Bound retained undo steps. Admission provides detached snapshots with shared
 * validated immutable fragments, so camera-only commits do not recopy geometry.
 * Content changes still retain older geometry until their history entries expire.
 */
export const MAX_HISTORY_ENTRIES = 100;

export function pushHistoryEntry(past: readonly ProjectDocument[], entry: ProjectDocument): ProjectDocument[] {
  return past.length >= MAX_HISTORY_ENTRIES
    ? [...past.slice(past.length - MAX_HISTORY_ENTRIES + 1), entry]
    : [...past, entry];
}

export function copyDocument(document: ProjectDocument): ProjectDocument {  return {
    ...document,
    page: { ...document.page },
    camera: { ...document.camera, center: [...document.camera.center] },
    style: {
      ...document.style,
      visibility: { ...document.style.visibility },
      customization: {
        ...document.style.customization,
        colors: { ...document.style.customization.colors },
      },
    },
    assets: Object.fromEntries(Object.entries(document.assets).map(([id, asset]) => [id, { ...asset }])),
    layers: document.layers.map((layer) => cloneContentLayer(layer)),
  };
}

/**
 * Optimistic-concurrency key for imports staged against a snapshot. Every writer
 * replaces the fields it touches, so identity per field is as strict as a deep
 * compare. The camera is excluded deliberately: panning writes a new document at
 * pointer rate without altering content, and it must not discard a batch that is
 * still being read or reviewed.
 */
export function hasSameDocumentContent(a: ProjectDocument, b: ProjectDocument): boolean {
  if (a === b) return true;
  const keys = Object.keys(a) as (keyof ProjectDocument)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => key === 'camera' || a[key] === b[key]);
}

export function replaceLayers(document: ProjectDocument, layers: ContentLayer[]): ProjectDocument {
  return { ...document, layers };
}

export function createDocumentActions(set: ProjectSet): Pick<ProjectState, 'openDocument' | 'setProjectTitle' | 'undo' | 'redo'> {
  return {
    openDocument: (storedDocument) => {
      if (!hasExactlyOneBottomBasemap(storedDocument.layers)) {
        throw new Error('Opened projects must contain exactly one basemap as the final layer.');
      }
      const openedDocument = copyDocument(storedDocument);
      return set((state) => ({
        document: openedDocument,
        documentEpoch: state.documentEpoch + 1,
        hasUnfinishedDrawing: false,
        selectedId: null,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      }));
    },
    setProjectTitle: (title) => set((state) => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle || normalizedTitle === state.document.title) return state;
      return commitDocument(state, { ...state.document, title: normalizedTitle });
    }),
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
        past: pushHistoryEntry(state.past, copyDocument(state.document)),
        future,
        canUndo: true,
        canRedo: future.length > 0,
      };
    }),
  };
}

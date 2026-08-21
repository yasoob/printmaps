import { createStore } from 'zustand/vanilla';
import {
  cloneContentLayer,
  createInitialProjectDocument,
  migrateProjectDocument,
  type ContentLayer,
  type PageOrientation,
  type PageSettings,
  type StandardPagePreset,
  type ProjectDocument,
  type StoredProjectDocument,
} from '../domain/project';

export type ProjectState = {
  document: ProjectDocument;
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  canUndo: boolean;
  canRedo: boolean;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, toIndex: number) => void;
  renameLayer: (id: string, name: string) => void;
  selectLayer: (id: string | null) => void;
  setPageDimension: (dimension: 'widthMm' | 'heightMm', value: number) => void;
  setPageOrientation: (orientation: PageOrientation) => void;
  setPagePreset: (preset: StandardPagePreset) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
};

function copyDocument(document: ProjectDocument): ProjectDocument {
  return {
    ...document,
    page: { ...document.page },
    layers: document.layers.map(cloneContentLayer),
  };
}

function replaceLayers(document: ProjectDocument, layers: ContentLayer[]): ProjectDocument {
  return { ...document, layers };
}

function commitDocument(state: ProjectState, document: ProjectDocument) {
  return {
    document,
    past: [...state.past, copyDocument(state.document)],
    future: [],
    canUndo: true,
    canRedo: false,
  };
}

export function createProjectStore(
  initialDocument: StoredProjectDocument = createInitialProjectDocument(),
) {
  const document = migrateProjectDocument(initialDocument);
  return createStore<ProjectState>((set) => ({
    document: copyDocument(document),
    selectedId: null,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    deleteLayer: (id) => set((state) => {
      if (!state.document.layers.some((layer) => layer.id === id)) return state;

      return {
        ...commitDocument(
          state,
          replaceLayers(state.document, state.document.layers.filter((layer) => layer.id !== id)),
        ),
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    }),
    duplicateLayer: (id) => set((state) => {
      const sourceIndex = state.document.layers.findIndex((layer) => layer.id === id);
      if (sourceIndex < 0) return state;

      const source = state.document.layers[sourceIndex];
      const usedIds = new Set(state.document.layers.map((layer) => layer.id));
      let suffix = 1;
      let duplicateId = `${id}-copy`;
      while (usedIds.has(duplicateId)) {
        suffix += 1;
        duplicateId = `${id}-copy-${suffix}`;
      }

      const duplicate = { ...cloneContentLayer(source), id: duplicateId, name: `${source.name} copy` };
      const layers = [...state.document.layers];
      layers.splice(sourceIndex + 1, 0, duplicate);
      return {
        ...commitDocument(state, replaceLayers(state.document, layers)),
        selectedId: duplicateId,
      };
    }),
    moveLayer: (id, toIndex) => set((state) => {
      if (!Number.isFinite(toIndex)) return state;
      const fromIndex = state.document.layers.findIndex((layer) => layer.id === id);
      const targetIndex = Math.max(0, Math.min(Math.trunc(toIndex), state.document.layers.length - 1));
      if (fromIndex < 0 || fromIndex === targetIndex) return state;

      const layers = [...state.document.layers];
      const [layer] = layers.splice(fromIndex, 1);
      layers.splice(targetIndex, 0, layer);
      return commitDocument(state, replaceLayers(state.document, layers));
    }),
    renameLayer: (id, name) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer || !name.trim() || layer.name === name) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, name } : candidate
        )),
      ));
    }),
    selectLayer: (id) => set((state) => ({
      selectedId: id === null || state.document.layers.some((layer) => layer.id === id)
        ? id
        : state.selectedId,
    })),
    setPageDimension: (dimension, value) => set((state) => {
      if (
        !Number.isFinite(value)
        || value <= 0
        || (state.document.page[dimension] === value && state.document.page.preset === 'Custom')
      ) return state;
      const nextPage: PageSettings = { ...state.document.page, preset: 'Custom', [dimension]: value };
      nextPage.orientation = nextPage.widthMm >= nextPage.heightMm ? 'landscape' : 'portrait';
      return commitDocument(state, {
        ...state.document,
        page: nextPage,
      });
    }),
    setPageOrientation: (orientation) => set((state) => {
      const shortEdge = Math.min(state.document.page.widthMm, state.document.page.heightMm);
      const longEdge = Math.max(state.document.page.widthMm, state.document.page.heightMm);
      const widthMm = orientation === 'landscape' ? longEdge : shortEdge;
      const heightMm = orientation === 'landscape' ? shortEdge : longEdge;
      if (
        state.document.page.orientation === orientation
        && state.document.page.widthMm === widthMm
        && state.document.page.heightMm === heightMm
      ) return state;
      return commitDocument(state, {
        ...state.document,
        page: {
          ...state.document.page,
          widthMm,
          heightMm,
          orientation,
        },
      });
    }),
    setPagePreset: (preset) => set((state) => {
      const dimensions = {
        A4: [297, 210],
        A3: [420, 297],
        Letter: [279.4, 215.9],
      } satisfies Record<StandardPagePreset, [number, number]>;
      const [longEdge, shortEdge] = dimensions[preset];
      const widthMm = state.document.page.orientation === 'landscape' ? longEdge : shortEdge;
      const heightMm = state.document.page.orientation === 'landscape' ? shortEdge : longEdge;
      if (
        state.document.page.preset === preset
        && state.document.page.widthMm === widthMm
        && state.document.page.heightMm === heightMm
      ) return state;
      return commitDocument(state, {
        ...state.document,
        page: { ...state.document.page, preset, widthMm, heightMm },
      });
    }),
    setLayerOpacity: (id, opacity) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      const nextOpacity = Math.max(0, Math.min(100, opacity));
      if (!layer || !Number.isFinite(opacity) || layer.opacity === nextOpacity) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, opacity: nextOpacity } : candidate
        )),
      ));
    }),
    toggleLayerVisibility: (id) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, visible: !candidate.visible } : candidate
        )),
      ));
    }),
    toggleLayerLock: (id) => set((state) => {
      const layer = state.document.layers.find((candidate) => candidate.id === id);
      if (!layer) return state;

      return commitDocument(state, replaceLayers(
        state.document,
        state.document.layers.map((candidate) => (
          candidate.id === id ? { ...candidate, locked: !candidate.locked } : candidate
        )),
      ));
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
        past: [...state.past, copyDocument(state.document)],
        future,
        canUndo: true,
        canRedo: future.length > 0,
      };
    }),
  }));
}

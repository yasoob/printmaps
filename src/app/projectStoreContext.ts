import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { ProjectState } from './store';

type ProjectDataKey =
  | 'document'
  | 'documentEpoch'
  | 'hasUnfinishedDrawing'
  | 'pageBoundaryVisible'
  | 'selectedId'
  | 'past'
  | 'future'
  | 'canUndo'
  | 'canRedo';

/**
 * The action half of the store. Actions are created once by `createProjectStore`
 * and keep a stable identity for the store's lifetime, so components may read
 * them without subscribing to state.
 */
export type ProjectActions = Omit<ProjectState, ProjectDataKey>;

export const ProjectStoreContext = createContext<StoreApi<ProjectState> | null>(null);

export function useProjectStoreApi(): StoreApi<ProjectState> {
  const store = useContext(ProjectStoreContext);
  if (!store) throw new Error('Project store components must render inside a ProjectStoreContext provider.');
  return store;
}

/**
 * Subscribes to one slice of project state. Selectors must return a stable
 * reference for unchanged state; returning a fresh object each call re-renders
 * on every store write.
 */
export function useProject<Slice>(selector: (state: ProjectState) => Slice): Slice {
  return useStore(useProjectStoreApi(), selector);
}

/**
 * Reads store actions without subscribing, so callers never re-render on state
 * changes.
 */
export function useProjectActions(): ProjectActions {
  return useProjectStoreApi().getState();
}


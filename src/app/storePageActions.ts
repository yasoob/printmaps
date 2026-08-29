import type { PageSettings } from '../domain/project';
import { pagePresetDimensions } from '../domain/pagePresets';
import type { ProjectState } from './store';
import { commitDocument, type ProjectSet } from './storeDocument';

type PageActions = Pick<ProjectState, 'setPageDimension' | 'setPageOrientation' | 'setPagePreset'>;

export function createPageActions(set: ProjectSet): PageActions {
  return {
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
      if (preset === 'Custom') {
        if (state.document.page.preset === preset) return state;
        return commitDocument(state, {
          ...state.document,
          page: { ...state.document.page, preset },
        });
      }
      const [longEdge, shortEdge] = pagePresetDimensions(preset);
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
  };
}

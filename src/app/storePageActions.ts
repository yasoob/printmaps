import type { PageSettings, StandardPagePreset } from '../domain/project';
import type { ProjectState } from './store';
import { commitDocument, type ProjectSet } from './storeDocument';

const PAGE_DIMENSIONS = {
  A4: [297, 210],
  A3: [420, 297],
  Letter: [279.4, 215.9],
} satisfies Record<StandardPagePreset, [number, number]>;

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
      const [longEdge, shortEdge] = PAGE_DIMENSIONS[preset];
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

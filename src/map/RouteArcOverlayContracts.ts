import type { ContentLayer } from '../domain/project';
import type { RouteArcDatum } from './RouteArcRendering';

export const ARC_LAYER_ID = 'studio-route-arcs';

export type RouteArcState = {
  layers: readonly ContentLayer[];
  selectedId: string | null;
  previewedId: string | null;
};

export type ArcOverlay = {
  finalize: () => void;
  pickObject: (options: { x: number; y: number; radius: number; layerIds: string[] }) => { object?: unknown } | null;
  setProps: (props: { layers: unknown[] }) => void;
};

export type OverlayOptions = { interleaved: boolean };
export type OverlayFactory = (options: OverlayOptions) => ArcOverlay;

export type ArcDeckLayers = {
  arcLayer: (data: RouteArcDatum[], widthScale: number, isVisible: boolean) => unknown;
  defaultOverlayFactory: OverlayFactory;
};

export type ArcDeckLayersLoader = () => Promise<ArcDeckLayers>;

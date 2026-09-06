import type { StoreApi } from 'zustand/vanilla';
import type { ContentLayer } from '../../domain/project';
import type { ProjectState } from '../store';
import { ElevationProfileSession } from './ElevationProfileSession';
import type { ProfileRouteBinding } from './profileSessionTypes';

function binding(layer: ContentLayer): ProfileRouteBinding {
  return {
    coordinates: layer.geometry?.type === 'LineString' ? layer.geometry.coordinates : null,
    kind: layer.route?.kind ?? (layer.geometry?.type === 'Arc' ? 'arc' : 'straight'),
    name: layer.name, color: layer.appearance?.kind === 'route' ? layer.appearance.color : '#0d79c7',
  };
}

export class ElevationProfileRegistry {
  private sessions = new Map<string, { layer: ContentLayer; session: ElevationProfileSession }>();
  private epoch: number;
  private layers: ContentLayer[];
  private sync = () => {
    const state = this.store.getState();
    if (this.epoch !== state.documentEpoch) {
      this.clear();
      this.epoch = state.documentEpoch;
    }
    if (this.layers === state.document.layers) return;
    this.layers = state.document.layers;
    if (this.sessions.size === 0) return;
    const routes = new Map(this.layers.filter((layer) => layer.type === 'route').map((layer) => [layer.id, layer]));
    for (const [id, entry] of this.sessions) {
      const layer = routes.get(id);
      if (!layer) { entry.session.dispose(); this.sessions.delete(id); }
      else if (entry.layer !== layer) {
        entry.layer = layer;
        entry.session.syncRoute(binding(layer));
      }
    }
  };
  constructor(private readonly store: StoreApi<ProjectState>) {
    const state = store.getState();
    this.epoch = state.documentEpoch;
    this.layers = state.document.layers;
  }
  private clear() { for (const { session } of this.sessions.values()) session.dispose(); this.sessions.clear(); }
  get(routeId: string, epoch: number): ElevationProfileSession | null {
    this.sync();
    if (epoch !== this.epoch) return null;
    const existing = this.sessions.get(routeId);
    if (existing) return existing.session;
    const layer = this.layers.find((candidate) => candidate.id === routeId && candidate.type === 'route');
    if (!layer) return null;
    const session = new ElevationProfileSession(binding(layer));
    this.sessions.set(routeId, { layer, session });
    return session;
  }
  attach() {
    for (const { session } of this.sessions.values()) session.resume();
    this.sync();
    const unsubscribe = this.store.subscribe(this.sync);
    return () => { unsubscribe(); for (const { session } of this.sessions.values()) session.suspend(); };
  }
}

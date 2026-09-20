import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type { PreviewPngExporter } from '../export/previewPng';

export function createMapExporterChannel() {
  let current: PreviewPngExporter | null = null;
  const listeners = new Set<() => void>();
  return {
    read: () => current,
    publish(next: PreviewPngExporter | null) {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const MapExporterContext = createContext<ReturnType<typeof createMapExporterChannel> | null>(null);

export function usePublishMapExporter() {
  const channel = useContext(MapExporterContext);
  if (!channel) throw new Error('The map renderer needs a MapExporterContext.');
  return channel.publish;
}

export function useReadMapExporter(explicit?: PreviewPngExporter | null) {
  const channel = useContext(MapExporterContext);
  return useCallback(() => explicit === undefined ? channel?.read() ?? null : explicit, [channel, explicit]);
}

const unsubscribeFromNothing = () => {};
const subscribeToNothing = () => unsubscribeFromNothing;
export function useAvailableMapExporter(explicit?: PreviewPngExporter | null) {
  const channel = useContext(MapExporterContext);
  const read = useReadMapExporter(explicit);
  return useSyncExternalStore(channel?.subscribe ?? subscribeToNothing, read, read);
}

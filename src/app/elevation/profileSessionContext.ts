import { createContext, useContext } from 'react';
import type { ElevationProfileRegistry } from './ElevationProfileRegistry';

export const ProfileRegistryContext = createContext<ElevationProfileRegistry | null>(null);
export function useRouteElevationSession(routeId: string, epoch: number) {
  const registry = useContext(ProfileRegistryContext);
  if (!registry) throw new Error('Elevation profile controls require an ElevationProfileProvider.');
  return registry.get(routeId, epoch);
}

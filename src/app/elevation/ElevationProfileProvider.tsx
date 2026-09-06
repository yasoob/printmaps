import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useProjectStoreApi } from '../projectStoreContext';
import { ElevationProfileRegistry } from './ElevationProfileRegistry';

import { ProfileRegistryContext } from './profileSessionContext';

export function ElevationProfileProvider({ children }: { children: ReactNode }) {
  const store = useProjectStoreApi();
  const [registry] = useState(() => new ElevationProfileRegistry(store));
  useLayoutEffect(() => registry.attach(), [registry]);
  return <ProfileRegistryContext value={registry}>{children}</ProfileRegistryContext>;
}

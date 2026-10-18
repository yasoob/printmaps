import { createContext } from 'react';

/**
 * Why Layout editing is currently blocked (an active drawing tool or a damaged
 * draft). Provided by the project inspector so only the composition controls
 * that read it re-render when a tool is activated, not the whole inspector.
 */
export const StudioBlockedReasonContext = createContext<string | undefined>(undefined);

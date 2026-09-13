import type { LayerType, MapFeatureVisibilityCategory, MapLanguage, PageOrientation } from '../domain/project';
import { MAP_STYLE_PRESETS, type MapStylePreset } from '../domain/mapStylePresets';
import { PAGE_PRESET_DEFINITIONS, type PagePreset } from '../domain/pagePresets';
import { PROJECT_ACTIONS } from './projectActions';
import { UI_ACTIONS } from './uiActions';
import { WORKFLOW_ACTIONS } from './workflowActions';
import { ROUTE_KINDS, type RouteKind } from '../domain/routeMetadata';

export const CORE_ACTIONS = [
  'editorOpened', 'exportDialogOpened', 'routeExtensionStarted',
  'mapMatchingStarted', 'mapMatchingCompleted', 'mapMatchingFailed', 'mapMatchingCancelled', 'mapMatchingModeSelected',
  'poiListModeSelected', 'poiListEdited', 'poiListRowEdited', 'poiListReviewOpened', 'poiListReviewClosed',
  'poiListDiscarded', 'poiListCommitStarted', 'poiListCommitCompleted', 'poiListCommitFailed', 'poiListValidationFailed',
  'boundaryCountrySelected', 'boundarySelected', 'boundaryAddRequested', 'boundaryPickerCancelled',
] as const;
export type EditorAction =
  | typeof CORE_ACTIONS[number]
  | typeof PROJECT_ACTIONS[number]
  | typeof UI_ACTIONS[number]
  | typeof WORKFLOW_ACTIONS[number];

export type EditorEventParameters = {
  format?: 'png' | 'pdf' | 'svg' | 'psd' | 'project' | 'gpx' | 'kml' | 'geojson' | 'csv' | 'mixed' | 'unknown';
  source?: 'file' | 'drop' | 'search' | 'geolocation' | 'toolbar' | 'keyboard' | 'map' | 'inspector';
  enabled?: boolean;
  layer_type?: LayerType;
  map_style?: MapStylePreset;
  page_preset?: PagePreset;
  orientation?: PageOrientation;
  feature?: MapFeatureVisibilityCategory;
  language?: MapLanguage;
  route_kind?: RouteKind;
  operation?: 'convert' | 'reverse' | 'close' | 'open';
  setting?: typeof SETTING_NAMES[number];
};

const SETTING_NAMES = [
  'widthMm', 'heightMm', 'contrast', 'detail', 'tone', 'canvas', 'land', 'water',
  'park', 'building', 'majorRoad', 'minorRoad', 'boundary', 'transit', 'label',
  'labelHalo', 'color', 'width', 'strokeStyle', 'marker', 'segmentStyles', 'size',
  'markerShape', 'markerSymbol', 'customAssetId', 'fillColor', 'strokeColor',
  'strokeWidth', 'invert', 'multiple',
] as const;

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      name: 'editor_action',
      parameters: EditorEventParameters & { action: EditorAction },
    ) => void;
  }
}

const ACTIONS = new Set<string>([...CORE_ACTIONS, ...PROJECT_ACTIONS, ...UI_ACTIONS, ...WORKFLOW_ACTIONS]);
const PARAMETER_VALUES: Record<Exclude<keyof EditorEventParameters, 'enabled'>, readonly string[]> = {
  format: ['png', 'pdf', 'svg', 'psd', 'project', 'gpx', 'kml', 'geojson', 'csv', 'mixed', 'unknown'],
  source: ['file', 'drop', 'search', 'geolocation', 'toolbar', 'keyboard', 'map', 'inspector'],
  layer_type: ['route', 'poi', 'shape', 'basemap'],
  map_style: MAP_STYLE_PRESETS.map(({ id }) => id),
  page_preset: [...PAGE_PRESET_DEFINITIONS.map(({ id }) => id), 'Custom'],
  orientation: ['landscape', 'portrait'],
  feature: ['roads', 'buildings', 'labels', 'water', 'parks', 'landuse', 'transit'],
  language: ['local', 'en', 'de', 'fr', 'it', 'es', 'zh'],
  route_kind: ROUTE_KINDS,
  operation: ['convert', 'reverse', 'close', 'open'],
  setting: SETTING_NAMES,
};

function safeParameters(parameters: EditorEventParameters): EditorEventParameters {
  const entries = Object.entries(parameters).filter(([key, value]) => (
    key === 'enabled' ? typeof value === 'boolean'
      : Object.hasOwn(PARAMETER_VALUES, key)
        && typeof value === 'string'
        && PARAMETER_VALUES[key as keyof typeof PARAMETER_VALUES].includes(value)
  ));
  return Object.fromEntries(entries);
}

function send(action: EditorAction, parameters: EditorEventParameters) {
  try {
    const gtag = window.gtag;
    if (typeof gtag === 'function') gtag('event', 'editor_action', { ...parameters, action });
  } catch {
    // Analytics must not interrupt an edit or change a successful download into a failure.
    console.warn('Editor analytics could not queue an event.');
  }
}

const pending = new Map<string, {
  action: EditorAction;
  parameters: EditorEventParameters;
  timer: ReturnType<typeof setTimeout>;
}>();
const lifecycle = { hasListeners: false };

export function flushEditorAnalytics() {
  for (const [key, event] of pending) {
    clearTimeout(event.timer);
    pending.delete(key);
    send(event.action, event.parameters);
  }
}

function installLifecycleListeners() {
  if (lifecycle.hasListeners) return;
  lifecycle.hasListeners = true;
  window.addEventListener('pagehide', flushEditorAnalytics);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEditorAnalytics();
  });
}

export function trackEditorAction(
  action: EditorAction,
  parameters: EditorEventParameters = {},
  options: { debounce?: boolean } = {},
): void {
  // Reuse the production Astro shell's GA setup and dataLayer queue.
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  if (!ACTIONS.has(action)) {
    console.warn('Editor analytics rejected an unknown action.');
    return;
  }
  const safe = safeParameters(parameters);
  if (!options.debounce) {
    flushEditorAnalytics();
    send(action, safe);
    return;
  }
  installLifecycleListeners();
  const key = `${action}:${safe.layer_type ?? ''}:${safe.setting ?? ''}`;
  clearTimeout(pending.get(key)?.timer);
  pending.set(key, {
    action,
    parameters: safe,
    timer: setTimeout(() => {
      pending.delete(key);
      send(action, safe);
    }, 500),
  });
}

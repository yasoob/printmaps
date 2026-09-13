import type { ProjectActions } from '../app/projectStoreContext';
import type { ProjectState } from '../app/store';
import { trackEditorAction, type EditorEventParameters } from './editorAnalytics';
import type { ProjectAnalyticsAction } from './projectActions';

const APPEARANCE_SETTINGS = [
  'color', 'width', 'strokeStyle', 'marker', 'segmentStyles', 'size', 'markerShape',
  'markerSymbol', 'label', 'customAssetId', 'fillColor', 'strokeColor', 'strokeWidth', 'invert',
] as const;

type ActionOptions<Args extends unknown[]> = {
  debounce?: boolean;
  shouldTrack?: (args: Args) => boolean;
  parameters?: (args: Args, after: ProjectState, before: ProjectState) => EditorEventParameters;
};

function createActionTracker(getState: () => ProjectState) {
  function track<Args extends unknown[], Result>(
    name: ProjectAnalyticsAction,
    action: (...args: Args) => Result,
    options: ActionOptions<Args> = {},
  ): (...args: Args) => Result {
    return (...args) => {
      const before = getState();
      const result = action(...args);
      const after = getState();
      const hasChanged = before.document !== after.document
        || before.selectedId !== after.selectedId
        || before.pageBoundaryVisible !== after.pageBoundaryVisible;
      if (hasChanged && (options.shouldTrack?.(args) ?? true)) {
        trackEditorAction(name, options.parameters?.(args, after, before), options);
      }
      return result;
    };
  }

  function trackLayer<Args extends [string, ...unknown[]], Result>(
    name: ProjectAnalyticsAction,
    action: (...args: Args) => Result,
    shouldDebounce = false,
  ) {
    return track(name, action, {
      debounce: shouldDebounce,
      parameters: ([id], after, before) => ({
        layer_type: (after.document.layers.find((layer) => layer.id === id)
          ?? before.document.layers.find((layer) => layer.id === id))?.type,
      }),
    });
  }
  return { track, trackLayer };
}

type ActionTracker = ReturnType<typeof createActionTracker>;

function trackAppearanceAction(actions: ProjectActions, { track }: ActionTracker) {
  return track('setLayerAppearance', actions.setLayerAppearance, {
    debounce: true,
    parameters: ([id], after, before) => {
      const previous = before.document.layers.find((layer) => layer.id === id)?.appearance;
      const layer = after.document.layers.find((layer) => layer.id === id);
      const next = layer?.appearance;
      const changed = APPEARANCE_SETTINGS.filter((key) => (
        JSON.stringify(previous && Reflect.get(previous, key)) !== JSON.stringify(next && Reflect.get(next, key))
      ));
      return { layer_type: layer?.type, setting: changed.length === 1 ? changed[0] : 'multiple' };
    },
  });
}

function trackStyleActions(actions: ProjectActions, { track }: ActionTracker) {
  return {
    setMapStyle: track('setMapStyle', actions.setMapStyle, {
      parameters: ([map_style]) => ({ map_style }),
    }),
    setMapStyleAdjustment: track('setMapStyleAdjustment', actions.setMapStyleAdjustment, {
      debounce: true,
      parameters: ([setting]) => ({ setting }),
    }),
    setMapStyleColor: track('setMapStyleColor', actions.setMapStyleColor, {
      debounce: true,
      parameters: ([setting]) => ({ setting }),
    }),
    setMapStyleTone: track('setMapStyleTone', actions.setMapStyleTone, {
      parameters: () => ({ setting: 'tone' }),
    }),
    resetMapStyle: track('resetMapStyle', actions.resetMapStyle),
    resetMapStyleCustomization: track('resetMapStyleCustomization', actions.resetMapStyleCustomization),
    setMapLanguage: track('setMapLanguage', actions.setMapLanguage, {
      parameters: ([language]) => ({ language }),
    }),
    setMapTextScale: track('setMapTextScale', actions.setMapTextScale, { debounce: true }),
    setMapFeatureVisibility: track('setMapFeatureVisibility', actions.setMapFeatureVisibility, {
      parameters: ([feature, enabled]) => ({ feature, enabled }),
    }),
  };
}

export function trackProjectActions(actions: ProjectActions, getState: () => ProjectState): ProjectActions {
  const tracker = createActionTracker(getState);
  const { track, trackLayer } = tracker;
  return {
    // Rehydration/recovery and render-driven draft status are not user actions.
    openDocument: actions.openDocument,
    setHasUnfinishedDrawing: actions.setHasUnfinishedDrawing,
    applyMapMatching: trackLayer('applyMapMatching', actions.applyMapMatching),
    createAdministrativeArea: track('createAdministrativeArea', actions.createAdministrativeArea),
    createIsochroneArea: track('createIsochroneArea', actions.createIsochroneArea),
    createDirectionsRoute: track('createDirectionsRoute', actions.createDirectionsRoute),
    replaceDirectionsRoute: track('replaceDirectionsRoute', actions.replaceDirectionsRoute),
    replaceRouteDraft: track('replaceRouteDraft', actions.replaceRouteDraft),
    transformRoute: track('transformRoute', actions.transformRoute, {
      parameters: ([{ operation }]) => ({
        operation: operation.type,
        ...(operation.type === 'convert' && { route_kind: operation.targetKind }),
      }),
    }),
    createPoi: track('createPoi', actions.createPoi),
    createPoiBatch: track('createPoiBatch', actions.createPoiBatch),
    createSearchPoi: track('createSearchPoi', actions.createSearchPoi),
    createRoute: track('createRoute', actions.createRoute, {
      parameters: (_, after) => ({ route_kind: after.document.layers.find((layer) => layer.id === after.selectedId)?.route?.kind }),
    }),
    replaceAuthoredRoute: trackLayer('replaceAuthoredRoute', actions.replaceAuthoredRoute),
    createShape: track('createShape', actions.createShape),
    deleteLayer: trackLayer('deleteLayer', actions.deleteLayer),
    duplicateLayer: trackLayer('duplicateLayer', actions.duplicateLayer),
    importLayers: track('importLayers', actions.importLayers),
    insertRouteVertex: trackLayer('insertRouteVertex', actions.insertRouteVertex),
    moveLayer: trackLayer('moveLayer', actions.moveLayer),
    setProjectTitle: track('setProjectTitle', actions.setProjectTitle, { debounce: true }),
    renameLayer: trackLayer('renameLayer', actions.renameLayer, true),
    replaceLayerFromImport: trackLayer('replaceLayerFromImport', actions.replaceLayerFromImport),
    selectLayer: track('selectLayer', actions.selectLayer, {
      parameters: ([id], after) => ({ layer_type: after.document.layers.find((layer) => layer.id === id)?.type }),
    }),
    setCameraBearing: track('setCameraBearing', actions.setCameraBearing, { debounce: true }),
    setCameraViewport: track('setCameraViewport', actions.setCameraViewport, {
      shouldTrack: (args) => args[2] !== 'amend',
    }),
    setMapAreaLocked: track('setMapAreaLocked', actions.setMapAreaLocked, {
      parameters: ([enabled]) => ({ enabled }),
    }),
    setCameraPitch: track('setCameraPitch', actions.setCameraPitch, { debounce: true }),
    setPageDimension: track('setPageDimension', actions.setPageDimension, {
      debounce: true,
      parameters: ([setting]) => ({ setting }),
    }),
    setPageBoundaryVisible: track('setPageBoundaryVisible', actions.setPageBoundaryVisible, {
      parameters: ([enabled]) => ({ enabled }),
    }),
    setPageOrientation: track('setPageOrientation', actions.setPageOrientation, {
      parameters: ([orientation]) => ({ orientation }),
    }),
    setPagePreset: track('setPagePreset', actions.setPagePreset, {
      parameters: ([page_preset]) => ({ page_preset }),
    }),
    setLayerAppearance: trackAppearanceAction(actions, tracker),
    setRouteMarker: trackLayer('setRouteMarker', actions.setRouteMarker),
    setRouteSegmentStyle: trackLayer('setRouteSegmentStyle', actions.setRouteSegmentStyle, true),
    setPoiCoordinates: trackLayer('setPoiCoordinates', actions.setPoiCoordinates, true),
    setPoiCustomMarker: trackLayer('setPoiCustomMarker', actions.setPoiCustomMarker),
    setRouteVertex: trackLayer('setRouteVertex', actions.setRouteVertex, true),
    setArcSegmentCurvature: trackLayer('setArcSegmentCurvature', actions.setArcSegmentCurvature, true),
    setShapeGeometry: trackLayer('setShapeGeometry', actions.setShapeGeometry, true),
    setShapeVertex: trackLayer('setShapeVertex', actions.setShapeVertex, true),
    setLayerOpacity: trackLayer('setLayerOpacity', actions.setLayerOpacity, true),
    ...trackStyleActions(actions, tracker),
    toggleLayerVisibility: trackLayer('toggleLayerVisibility', actions.toggleLayerVisibility),
    toggleLayerLock: trackLayer('toggleLayerLock', actions.toggleLayerLock),
    undo: track('undo', actions.undo),
    redo: track('redo', actions.redo),
    removeRouteVertex: trackLayer('removeRouteVertex', actions.removeRouteVertex),
    replaceRouteGeometry: trackLayer('replaceRouteGeometry', actions.replaceRouteGeometry, true),
  };
}

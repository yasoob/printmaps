import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawModeUndoRedo,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RouteLineShape } from '../domain/routeProfiles';
import type { TerraRouteDrawLike } from './TerraDrawRouteEditing';

const HANDLE_COLOR = '#d9363e';
const HANDLE_OUTLINE = '#ffffff';
const ROUTE_EDITOR_PREFIX = 'studio-route-editor';

export type TerraRouteHandleOrder = 'absent' | 'failed' | 'moved';

export function bringTerraRouteHandlesToFront(
  map: Pick<MapLibreMap, 'getLayer' | 'moveLayer'>,
): TerraRouteHandleOrder {
  let didFail = false;
  let didMove = false;
  for (const id of [`${ROUTE_EDITOR_PREFIX}-point`, `${ROUTE_EDITOR_PREFIX}-point-marker`]) {
    try {
      if (!map.getLayer(id)) continue;
      map.moveLayer(id);
      didMove = true;
    } catch {
      didFail = true;
    }
  }
  if (didFail) return 'failed';
  return didMove ? 'moved' : 'absent';
}

function lineStringMode(lineShape: RouteLineShape) {
  return new TerraDrawLineStringMode({
    finishOnNthCoordinate: lineShape === 'arc' ? 2 : undefined,
    pointerDistance: 22,
    projection: 'web-mercator',
    showCoordinatePoints: true,
    styles: {
      lineStringColor: HANDLE_COLOR,
      lineStringOpacity: 0,
      lineStringWidth: 1,
      coordinatePointColor: HANDLE_COLOR,
      coordinatePointOpacity: 1,
      coordinatePointOutlineColor: HANDLE_OUTLINE,
      coordinatePointOutlineOpacity: 1,
      coordinatePointOutlineWidth: 2,
      coordinatePointWidth: 10,
    },
  });
}

function selectMode(lineShape: RouteLineShape) {
  const coordinates = lineShape === 'arc'
    ? { draggable: true }
    : { deletable: true, draggable: true, midpoints: { draggable: true } };
  return new TerraDrawSelectMode({
    dragEventThrottle: 1,
    pointerDistance: 22,
    projection: 'web-mercator',
    flags: {
      linestring: {
        feature: {
          coordinates,
        },
      },
    },
    styles: {
      selectedLineStringOpacity: 0,
      selectedPointColor: HANDLE_COLOR,
      selectedPointOpacity: 1,
      selectedPointOutlineColor: HANDLE_OUTLINE,
      selectedPointOutlineOpacity: 1,
      selectedPointOutlineWidth: 2,
      selectedPointWidth: 10,
      midPointColor: HANDLE_OUTLINE,
      midPointOpacity: 1,
      midPointOutlineColor: HANDLE_COLOR,
      midPointOutlineOpacity: 1,
      midPointOutlineWidth: 2,
      midPointWidth: 8,
    },
  });
}

export function createTerraRouteDraw(
  map: MapLibreMap,
  lineShape: RouteLineShape,
  shouldEnableUndo = true,
): TerraRouteDrawLike {
  const adapter = new TerraDrawMapLibreGLAdapter({
    map,
    coordinatePrecision: 6,
    ignoreMismatchedPointerEvents: true,
    minPixelDragDistance: 3,
    minPixelDragDistanceDrawing: 3,
    minPixelDragDistanceSelecting: 3,
    prefixId: ROUTE_EDITOR_PREFIX,
  });
  return new TerraDraw({
    adapter,
    modes: [lineStringMode(lineShape), selectMode(lineShape)],
    ...(shouldEnableUndo && {
      undoRedo: { modeLevel: new TerraDrawModeUndoRedo({ maxStackSize: 100 }) },
    }),
  }) as unknown as TerraRouteDrawLike;
}

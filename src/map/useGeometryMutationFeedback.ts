import { useMemo, useState } from 'react';
import type { ContentLayer, ShapeGeometry } from '../domain/project';
import type { GeometryEditResult, ProjectMutationResult } from '../domain/projectMutation';

type Options = {
  layers: ContentLayer[];
  onPoiCoordinatesChange?: (id: string, coordinate: readonly [number, number]) => ProjectMutationResult;
  onRouteGeometryChange?: (id: string, coordinates: readonly (readonly [number, number])[]) => ProjectMutationResult;
  onRouteVertexChange?: (id: string, index: number, coordinate: readonly [number, number]) => GeometryEditResult;
  onRouteVertexInsert?: (id: string, index: number) => ProjectMutationResult;
  onShapeGeometryChange?: (id: string, geometry: ShapeGeometry) => ProjectMutationResult;
};

export function useGeometryMutationFeedback(options: Options) {
  const [error, setError] = useState<{ source: ContentLayer[]; message: string } | null>(null);
  const { layers, onPoiCoordinatesChange, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert, onShapeGeometryChange } = options;
  const callbacks = useMemo(() => {
    const track = <T extends GeometryEditResult>(result: T): T => {
      setError('ok' in result && !result.ok ? { source: layers, message: result.error } : null);
      return result;
    };
    return {
      onPoiCoordinatesChange: onPoiCoordinatesChange
        ? (id: string, coordinate: readonly [number, number]) => track(onPoiCoordinatesChange(id, coordinate)) : undefined,
      onRouteGeometryChange: onRouteGeometryChange
        ? (id: string, coordinates: readonly (readonly [number, number])[]) => track(onRouteGeometryChange(id, coordinates)) : undefined,
      onRouteVertexChange: onRouteVertexChange
        ? (id: string, index: number, coordinate: readonly [number, number]) => track(onRouteVertexChange(id, index, coordinate)) : undefined,
      onRouteVertexInsert: onRouteVertexInsert
        ? (id: string, index: number) => track(onRouteVertexInsert(id, index)) : undefined,
      onShapeGeometryChange: onShapeGeometryChange
        ? (id: string, geometry: ShapeGeometry) => track(onShapeGeometryChange(id, geometry)) : undefined,
    };
  }, [layers, onPoiCoordinatesChange, onRouteGeometryChange, onRouteVertexChange, onRouteVertexInsert, onShapeGeometryChange]);
  return { callbacks, error: error?.source === layers ? error.message : null };
}

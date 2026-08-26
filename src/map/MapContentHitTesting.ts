import type { Map as MapLibreMap, PointLike } from 'maplibre-gl';

const HIT_TEST_RADIUS = 12;
type HitTestMap = Pick<MapLibreMap, 'queryRenderedFeatures'>;

function hitTestBounds(point: PointLike): [[number, number], [number, number]] {
  const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
  return [
    [x - HIT_TEST_RADIUS, y - HIT_TEST_RADIUS],
    [x + HIT_TEST_RADIUS, y + HIT_TEST_RADIUS],
  ];
}

export function queryMapContentFeature(map: HitTestMap, layerIds: string[], point: PointLike) {
  const queryOptions = { layers: layerIds };
  const exactFeatures = map.queryRenderedFeatures(point, queryOptions);
  return exactFeatures[0] ?? map.queryRenderedFeatures(hitTestBounds(point), queryOptions)[0];
}

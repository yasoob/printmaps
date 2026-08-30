import { cloneLayerAppearance } from './layerAppearance';
import type {
  ArcGeometry,
  ContentLayer,
  ProviderProvenance,
} from './project';

function cloneProviderProvenance(
  provenance: ProviderProvenance | undefined,
): ProviderProvenance | undefined {
  if (provenance?.service === 'isochrone-v1') {
    return { ...provenance, center: [...provenance.center] as [number, number] };
  }
  if (provenance?.service === 'directions-v5') {
    return {
      ...provenance,
      waypoints: provenance.waypoints.map((position) => [...position] as [number, number]),
    };
  }
  if (provenance?.service === 'geocoding-v6') return { ...provenance };
  if (provenance?.service === 'map-matching-v5') return { ...provenance };
}

export function cloneContentLayer(layer: ContentLayer): ContentLayer {
  const appearance = layer.appearance ? cloneLayerAppearance(layer.appearance) : undefined;
  const provenance = cloneProviderProvenance(layer.provenance);
  const route = layer.route ? { ...layer.route } : undefined;
  const base = { ...layer };
  delete base.appearance;
  delete base.provenance;
  delete base.route;
  const copy = {
    ...base,
    ...(route && { route }),
    ...(appearance && { appearance }),
    ...(provenance && { provenance }),
  };
  if (!layer.geometry) return copy;
  if (layer.geometry.type === 'Arc') {
    return {
      ...copy,
      geometry: {
        type: 'Arc',
        anchors: layer.geometry.anchors.map((position) => [...position]) as ArcGeometry['anchors'],
        curvatures: [...layer.geometry.curvatures] as ArcGeometry['curvatures'],
      },
    };
  }
  if (layer.geometry.type === 'Point') {
    return { ...copy, geometry: { ...layer.geometry, coordinates: [...layer.geometry.coordinates] } };
  }
  if (layer.geometry.type === 'LineString') {
    return {
      ...copy,
      geometry: {
        ...layer.geometry,
        coordinates: layer.geometry.coordinates.map((position) => (
          [position[0], position[1]] as [number, number]
        )),
      },
    };
  }
  if (layer.geometry.type === 'Polygon') return {
    ...copy,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((ring) => ring.map((position) => (
        [position[0], position[1]] as [number, number]
      ))),
    },
  };
  return {
    ...copy,
    geometry: {
      ...layer.geometry,
      coordinates: layer.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map((position) => (
        [position[0], position[1]] as [number, number]
      )))),
    },
  };
}


import type { ContentLayer } from '../domain/project';
import { mapContentLayerId } from './MapContentLayerIds';
import type { MapLayerDescriptor } from './MapContentLayerRendering';

const DEFAULT_APPEARANCE = {
  kind: 'shape', fillColor: '#d18b25', strokeColor: '#d18b25', strokeWidth: 2, invert: false,
} as const;
const HIGHLIGHT_COLOR = '#006fc9';

export function shapeLayerDescriptors(
  layer: ContentLayer,
  isSelected: boolean,
  isPreviewed: boolean,
): MapLayerDescriptor[] {
  const appearance = layer.appearance?.kind === 'shape' ? layer.appearance : DEFAULT_APPEARANCE;
  const outlineSource = appearance.invert ? 'outline' as const : undefined;
  return [{
    id: mapContentLayerId(layer.id, 'fill'),
    type: 'fill',
    hitTest: !appearance.invert,
    paint: {
      'fill-color': appearance.fillColor,
      'fill-opacity': layer.opacity / 100,
    },
  }, {
    id: mapContentLayerId(layer.id, 'hover-halo'),
    type: 'line',
    hitTest: false,
    sourceRole: outlineSource,
    paint: {
      'line-color': HIGHLIGHT_COLOR,
      'line-opacity': isPreviewed ? 0.9 : 0,
      'line-width': appearance.strokeWidth + 6,
    },
  }, {
    id: mapContentLayerId(layer.id, 'line'),
    type: 'line',
    sourceRole: outlineSource,
    paint: {
      'line-color': appearance.strokeColor,
      'line-opacity': layer.opacity / 100,
      'line-width': isSelected ? appearance.strokeWidth + 1 : appearance.strokeWidth,
    },
  }];
}

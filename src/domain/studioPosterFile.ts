import type { DecorationPosition, DecorationSettings, PosterSettings, PosterText } from './studio';
import { studioBoolean, studioColor, studioEnum, studioNumber, studioObject, studioReference, studioString } from './studioValidation';

const FONT_VALUES = ['sans', 'serif', 'mono'] as const;

function textStyle(text: Record<string, unknown>, label: string): Omit<PosterText, 'text'> {
  return {
    enabled: studioBoolean(text.enabled, `${label} enabled`),
    font: studioEnum(text.font, `${label} font`, FONT_VALUES),
    fontSizePt: studioNumber(text.fontSizePt, `${label} font size`, [6, 144]),
    color: studioColor(text.color, `${label} color`),
  };
}

function posterText(value: unknown, label: string, maximum: number): PosterText {
  const text = studioObject(value, label, ['enabled', 'text', 'font', 'fontSizePt', 'color']);
  return { ...textStyle(text, label), text: studioString(text.text, label, maximum) };
}

export function parsePosterSettings(value: unknown): PosterSettings {
  const poster = studioObject(value, 'Poster', [
    'enabled', 'templateId', 'layout', 'align', 'title', 'subtitle', 'caption', 'coordinates',
    'marginsMm', 'backgroundColor', 'silhouetteLayerId',
  ]);
  const coordinates = studioObject(poster.coordinates, 'Poster coordinates', ['enabled', 'font', 'fontSizePt', 'color', 'format']);
  const margins = studioObject(poster.marginsMm, 'Poster margins', ['top', 'right', 'bottom', 'left']);
  return {
    enabled: studioBoolean(poster.enabled, 'Poster enabled'),
    templateId: studioEnum(poster.templateId, 'Poster template', ['none', 'classic', 'minimal', 'gallery', 'silhouette', 'journey']),
    layout: studioEnum(poster.layout, 'Poster layout', ['top', 'bottom', 'overlay']),
    align: studioEnum(poster.align, 'Poster alignment', ['left', 'center', 'right']),
    title: posterText(poster.title, 'Poster title', 200),
    subtitle: posterText(poster.subtitle, 'Poster subtitle', 400),
    caption: posterText(poster.caption, 'Poster caption', 2000),
    coordinates: {
      ...textStyle(coordinates, 'Poster coordinates'),
      format: studioEnum(coordinates.format, 'Coordinate format', ['decimal', 'dms']),
    },
    marginsMm: {
      top: studioNumber(margins.top, 'Poster top margin', [0, 100]),
      right: studioNumber(margins.right, 'Poster right margin', [0, 100]),
      bottom: studioNumber(margins.bottom, 'Poster bottom margin', [0, 100]),
      left: studioNumber(margins.left, 'Poster left margin', [0, 100]),
    },
    backgroundColor: studioColor(poster.backgroundColor, 'Poster background'),
    silhouetteLayerId: studioReference(poster.silhouetteLayerId, 'Silhouette layer ID'),
  };
}

function position(value: unknown): DecorationPosition {
  return studioEnum(value, 'Decoration position', ['top-left', 'top-right', 'bottom-left', 'bottom-right']);
}

export function parseDecorationSettings(value: unknown): DecorationSettings {
  const decorations = studioObject(value, 'Decorations', ['scale', 'compass', 'grid', 'qr']);
  const scale = studioObject(decorations.scale, 'Scale bar', ['enabled', 'position', 'units', 'widthMm', 'color']);
  const compass = studioObject(decorations.compass, 'Compass', ['enabled', 'position', 'sizeMm', 'style', 'color']);
  const grid = studioObject(decorations.grid, 'Coordinate grid', ['enabled', 'intervalDegrees', 'color', 'opacity', 'showLabels']);
  const qr = studioObject(decorations.qr, 'Location QR', ['enabled', 'position', 'sizeMm', 'target', 'layerId']);
  return {
    scale: {
      enabled: studioBoolean(scale.enabled, 'Scale enabled'), position: position(scale.position),
      units: studioEnum(scale.units, 'Scale units', ['metric', 'imperial']),
      widthMm: studioNumber(scale.widthMm, 'Scale width', [5, 200]), color: studioColor(scale.color, 'Scale color'),
    },
    compass: {
      enabled: studioBoolean(compass.enabled, 'Compass enabled'), position: position(compass.position),
      sizeMm: studioNumber(compass.sizeMm, 'Compass size', [5, 100]),
      style: studioEnum(compass.style, 'Compass style', ['arrow', 'rose']), color: studioColor(compass.color, 'Compass color'),
    },
    grid: {
      enabled: studioBoolean(grid.enabled, 'Grid enabled'),
      intervalDegrees: studioNumber(grid.intervalDegrees, 'Grid interval', [0.01, 90]),
      color: studioColor(grid.color, 'Grid color'), opacity: studioNumber(grid.opacity, 'Grid opacity', [0, 100]),
      showLabels: studioBoolean(grid.showLabels, 'Grid labels'),
    },
    qr: {
      enabled: studioBoolean(qr.enabled, 'QR enabled'), position: position(qr.position),
      sizeMm: studioNumber(qr.sizeMm, 'QR size', [10, 100]),
      target: studioEnum(qr.target, 'QR target', ['map-center', 'layer']), layerId: studioReference(qr.layerId, 'QR layer ID'),
    },
  };
}

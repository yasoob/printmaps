/**
Hand-drawn icons rendered inline by FeatureIconGrid.
*/
export const CUSTOM_FEATURE_ICONS = [
  'a-series',
  'browser',
  'color-edit',
  'dimensions',
  'download',
  'fit',
  'geojson',
  'gpx',
  'import',
  'kml',
  'language',
  'layer-labels',
  'layers',
  'layout',
  'marker',
  'no-account',
  'orientation',
  'palette',
  'pdf-reader',
  'pixels',
  'print',
  'psd-file',
  'region',
  'route',
  'save',
  'separate-elements',
  'share',
  'smart-object',
  'svg-editor',
  'text-scale',
  'tiles',
  'transform',
  'us-letter',
  'validation',
  'visibility',
] as const;

/**
Icons rendered from Lucide (see LUCIDE_FEATURE_ICONS in FeatureIconGrid).
*/
export const LUCIDE_FEATURE_ICON_NAMES = [
  'calendar',
  'compass',
  'contours',
  'country-shape',
  'elevation',
  'embed',
  'grid',
  'heart',
  'home',
  'isochrone',
  'link',
  'photos',
  'qr-code',
  'relief-3d',
  'scale-bar',
  'spreadsheet',
  'template',
  'terrain',
  'title',
  'video',
  'wall-frame',
] as const;

export type FeatureIcon = (typeof CUSTOM_FEATURE_ICONS)[number] | (typeof LUCIDE_FEATURE_ICON_NAMES)[number];

export type FeatureHighlight = {
  icon: FeatureIcon;
  label: string;
};

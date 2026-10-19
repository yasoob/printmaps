/**
Hand-drawn icons rendered inline by FeatureIconGrid.
*/
type CustomFeatureIcon =
  | 'a-series'
  | 'browser'
  | 'color-edit'
  | 'dimensions'
  | 'download'
  | 'fit'
  | 'geojson'
  | 'gpx'
  | 'import'
  | 'kml'
  | 'language'
  | 'layer-labels'
  | 'layers'
  | 'layout'
  | 'marker'
  | 'no-account'
  | 'orientation'
  | 'palette'
  | 'pdf-reader'
  | 'pixels'
  | 'print'
  | 'psd-file'
  | 'region'
  | 'route'
  | 'save'
  | 'separate-elements'
  | 'share'
  | 'smart-object'
  | 'svg-editor'
  | 'text-scale'
  | 'tiles'
  | 'transform'
  | 'us-letter'
  | 'validation'
  | 'visibility';

/**
Icons rendered from Lucide (see the LUCIDE_FEATURE_ICONS map in FeatureIconGrid).
*/
type LucideFeatureIcon =
  | 'calendar'
  | 'compass'
  | 'contours'
  | 'country-shape'
  | 'elevation'
  | 'embed'
  | 'grid'
  | 'heart'
  | 'home'
  | 'isochrone'
  | 'link'
  | 'photos'
  | 'qr-code'
  | 'relief-3d'
  | 'scale-bar'
  | 'spreadsheet'
  | 'template'
  | 'terrain'
  | 'title'
  | 'video'
  | 'wall-frame';

export type FeatureIcon = CustomFeatureIcon | LucideFeatureIcon;

export type FeatureHighlight = {
  icon: FeatureIcon;
  label: string;
};

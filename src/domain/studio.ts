import type { CameraSettings, ContentLayer, MapStyleSettings, PageSettings } from './project';

export type StudioFont = 'sans' | 'serif' | 'mono';
export type PosterTemplateId = 'none' | 'classic' | 'minimal' | 'gallery' | 'silhouette' | 'journey';
export type DecorationPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type PosterText = {
  enabled: boolean;
  text: string;
  font: StudioFont;
  fontSizePt: number;
  color: string;
};

export type PosterSettings = {
  enabled: boolean;
  templateId: PosterTemplateId;
  layout: 'top' | 'bottom' | 'overlay';
  align: 'left' | 'center' | 'right';
  title: PosterText;
  subtitle: PosterText;
  caption: PosterText;
  coordinates: Omit<PosterText, 'text'> & { format: 'decimal' | 'dms' };
  marginsMm: { top: number; right: number; bottom: number; left: number };
  backgroundColor: string;
  silhouetteLayerId: string | null;
};

export type PhotoAsset = Readonly<{
  id: string;
  mimeType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  dataUri: string;
}>;

// Geography lives only in the referenced Point POI, not in the photo attachment.
export type PhotoStop = { id: string; layerId: string; assetId: string; caption: string };
export type PhotoSettings = {
  assets: Record<string, PhotoAsset>;
  stops: PhotoStop[];
  map: { enabled: boolean; sizeMm: number; borderColor: string; borderWidthMm: number; shape: 'circle' | 'square' };
  strip: { enabled: boolean; position: 'top' | 'bottom'; heightMm: number; gapMm: number; showCaptions: boolean; backgroundColor: string };
};

export type DecorationSettings = {
  scale: { enabled: boolean; position: DecorationPosition; units: 'metric' | 'imperial'; widthMm: number; color: string };
  compass: { enabled: boolean; position: DecorationPosition; sizeMm: number; style: 'arrow' | 'rose'; color: string };
  grid: { enabled: boolean; intervalDegrees: number; color: string; opacity: number; showLabels: boolean };
  // A QR target is derived from the canonical camera center or a Point POI.
  qr: { enabled: boolean; position: DecorationPosition; sizeMm: number; target: 'map-center' | 'layer'; layerId: string | null };
};

export type WallSettings = {
  enabled: boolean;
  wallColor: string;
  frame: 'none' | 'black' | 'white' | 'oak' | 'walnut';
  matWidthMm: number;
  matColor: string;
  shadow: boolean;
};

export type TerrainSettings = {
  enabled: boolean;
  exaggeration: number;
  contours: { enabled: boolean; intervalMeters: number; color: string; width: number };
  buildings: { enabled: boolean; exaggeration: number; opacity: number };
};

export type VideoSettings = {
  motion: 'orbit' | 'sway';
  durationSeconds: 5 | 10 | 15;
  fps: 30 | 60;
  aspect: 'page' | '16:9' | '9:16' | '1:1' | '4:5';
  quality: 'standard' | 'high';
};

export type ReliefSettings = {
  widthMm: number;
  heightMm: number;
  baseMm: number;
  exaggeration: number;
  detail: 'low' | 'medium' | 'high';
  routeRidge: { enabled: boolean; layerId: string | null; heightMm: number; widthMm: number };
};

export type StudioSettings = {
  poster: PosterSettings;
  photos: PhotoSettings;
  decorations: DecorationSettings;
  wall: WallSettings;
  terrain: TerrainSettings;
  video: VideoSettings;
  relief: ReliefSettings;
};

export type StudioTemplateApplication = {
  poster: PosterSettings;
  page?: PageSettings;
  style?: MapStyleSettings;
  camera?: CameraSettings;
  silhouette?: ContentLayer;
  expectedDocumentEpoch?: number;
};

export type PhotoStopInsertion = {
  stop: PhotoStop;
  asset: PhotoAsset;
  // Optional new POI; omit when attaching to an existing Point layer.
  poi?: ContentLayer;
  presentation?: 'map' | 'strip';
  expectedDocumentEpoch?: number;
};

const text = (fontSizePt: number): PosterText => ({
  enabled: false, text: '', font: 'sans', fontSizePt, color: '#202020',
});

export function createDefaultStudioSettings(): StudioSettings {
  return {
    poster: {
      enabled: false, templateId: 'none', layout: 'bottom', align: 'center',
      title: text(32), subtitle: text(16), caption: text(10),
      coordinates: { enabled: false, font: 'mono', fontSizePt: 10, color: '#202020', format: 'decimal' },
      marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
      backgroundColor: '#ffffff', silhouetteLayerId: null,
    },
    photos: {
      assets: {}, stops: [],
      map: { enabled: false, sizeMm: 12, borderColor: '#ffffff', borderWidthMm: 1, shape: 'circle' },
      strip: { enabled: false, position: 'bottom', heightMm: 30, gapMm: 3, showCaptions: true, backgroundColor: '#ffffff' },
    },
    decorations: {
      scale: { enabled: false, position: 'bottom-left', units: 'metric', widthMm: 30, color: '#202020' },
      compass: { enabled: false, position: 'top-right', sizeMm: 15, style: 'arrow', color: '#202020' },
      grid: { enabled: false, intervalDegrees: 1, color: '#808080', opacity: 40, showLabels: true },
      qr: { enabled: false, position: 'bottom-right', sizeMm: 20, target: 'map-center', layerId: null },
    },
    wall: { enabled: false, wallColor: '#e8e5df', frame: 'none', matWidthMm: 0, matColor: '#ffffff', shadow: true },
    terrain: {
      enabled: false, exaggeration: 1,
      contours: { enabled: false, intervalMeters: 100, color: '#807868', width: 1 },
      buildings: { enabled: false, exaggeration: 1, opacity: 100 },
    },
    video: { motion: 'orbit', durationSeconds: 10, fps: 30, aspect: 'page', quality: 'standard' },
    relief: {
      widthMm: 150, heightMm: 100, baseMm: 2, exaggeration: 1, detail: 'medium',
      routeRidge: { enabled: false, layerId: null, heightMm: 1, widthMm: 1 },
    },
  };
}

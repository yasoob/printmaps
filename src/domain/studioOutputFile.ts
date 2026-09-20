import type { ReliefSettings, TerrainSettings, VideoSettings, WallSettings } from './studio';
import { studioBoolean, studioColor, studioEnum, studioNumber, studioObject, studioReference } from './studioValidation';

export function parseWallSettings(value: unknown): WallSettings {
  const wall = studioObject(value, 'Wall preview', ['enabled', 'wallColor', 'frame', 'matWidthMm', 'matColor', 'shadow']);
  return {
    enabled: studioBoolean(wall.enabled, 'Wall preview enabled'),
    wallColor: studioColor(wall.wallColor, 'Wall color'),
    frame: studioEnum(wall.frame, 'Frame', ['none', 'black', 'white', 'oak', 'walnut']),
    matWidthMm: studioNumber(wall.matWidthMm, 'Mat width', [0, 100]),
    matColor: studioColor(wall.matColor, 'Mat color'),
    shadow: studioBoolean(wall.shadow, 'Wall shadow'),
  };
}

export function parseTerrainSettings(value: unknown): TerrainSettings {
  const terrain = studioObject(value, 'Terrain', ['enabled', 'exaggeration', 'contours', 'buildings']);
  const contours = studioObject(terrain.contours, 'Contours', ['enabled', 'intervalMeters', 'color', 'width']);
  const buildings = studioObject(terrain.buildings, 'Buildings', ['enabled', 'exaggeration', 'opacity']);
  return {
    enabled: studioBoolean(terrain.enabled, 'Terrain enabled'),
    exaggeration: studioNumber(terrain.exaggeration, 'Terrain exaggeration', [0, 10]),
    contours: {
      enabled: studioBoolean(contours.enabled, 'Contours enabled'),
      intervalMeters: studioNumber(contours.intervalMeters, 'Contour interval', [1, 10_000]),
      color: studioColor(contours.color, 'Contour color'),
      width: studioNumber(contours.width, 'Contour width', [0.1, 10]),
    },
    buildings: {
      enabled: studioBoolean(buildings.enabled, 'Buildings enabled'),
      exaggeration: studioNumber(buildings.exaggeration, 'Building exaggeration', [0.1, 10]),
      opacity: studioNumber(buildings.opacity, 'Building opacity', [0, 100]),
    },
  };
}

export function parseVideoSettings(value: unknown): VideoSettings {
  const video = studioObject(value, 'Video', ['motion', 'durationSeconds', 'fps', 'aspect', 'quality']);
  return {
    motion: studioEnum(video.motion, 'Video motion', ['orbit', 'sway']),
    durationSeconds: studioEnum(video.durationSeconds, 'Video duration', [5, 10, 15]),
    fps: studioEnum(video.fps, 'Video frame rate', [30, 60]),
    aspect: studioEnum(video.aspect, 'Video aspect', ['page', '16:9', '9:16', '1:1', '4:5']),
    quality: studioEnum(video.quality, 'Video quality', ['standard', 'high']),
  };
}

export function parseReliefSettings(value: unknown): ReliefSettings {
  const relief = studioObject(value, 'Relief', ['widthMm', 'heightMm', 'baseMm', 'exaggeration', 'detail', 'routeRidge']);
  const ridge = studioObject(relief.routeRidge, 'Route ridge', ['enabled', 'layerId', 'heightMm', 'widthMm']);
  return {
    widthMm: studioNumber(relief.widthMm, 'Relief width', [10, 1000]),
    heightMm: studioNumber(relief.heightMm, 'Relief height', [10, 1000]),
    baseMm: studioNumber(relief.baseMm, 'Relief base', [0.2, 100]),
    exaggeration: studioNumber(relief.exaggeration, 'Relief exaggeration', [0.1, 50]),
    detail: studioEnum(relief.detail, 'Relief detail', ['low', 'medium', 'high']),
    routeRidge: {
      enabled: studioBoolean(ridge.enabled, 'Route ridge enabled'), layerId: studioReference(ridge.layerId, 'Route ridge layer ID'),
      heightMm: studioNumber(ridge.heightMm, 'Route ridge height', [0.1, 20]),
      widthMm: studioNumber(ridge.widthMm, 'Route ridge width', [0.1, 20]),
    },
  };
}

import { createDefaultLayerAppearance, createInitialProjectDocument, type ContentLayer } from '../../src/domain/project';
import type { PhotoAsset } from '../../src/domain/studio';
import { sha256Hex } from '../../src/domain/sha256';

export function photoAsset(padding = 0, width = 1, height = 1): PhotoAsset {
  const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='), (character) => character.codePointAt(0)!);
  const bytes = new Uint8Array(png.length + padding);
  bytes.set(png);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) binary += String.fromCodePoint(...bytes.subarray(offset, offset + 32_768));
  return { id: `sha256-${sha256Hex(bytes)}`, mimeType: 'image/png', width, height, dataUri: `data:image/png;base64,${btoa(binary)}` };
}

export function photoPoi(id = 'photo-place'): ContentLayer {
  return {
    id, name: 'Photo place', type: 'poi', visible: true, locked: false, opacity: 100,
    appearance: createDefaultLayerAppearance('poi'),
    geometry: { type: 'Point', coordinates: [12, 48] },
  };
}

export function studioProject() {
  const project = createInitialProjectDocument();
  const studio = project.studio;
  studio.poster.enabled = true;
  studio.poster.templateId = 'silhouette';
  studio.poster.silhouetteLayerId = 'area-center';
  studio.poster.title = { ...studio.poster.title, enabled: true, text: 'Display title, not the project title', font: 'serif' };
  studio.poster.subtitle = { ...studio.poster.subtitle, enabled: true, text: 'A subtitle' };
  studio.poster.caption = { ...studio.poster.caption, enabled: true, text: 'A caption' };
  studio.poster.coordinates.enabled = true;
  const asset = photoAsset();
  studio.photos.assets[asset.id] = asset;
  studio.photos.stops.push({ id: 'photo-1', assetId: asset.id, layerId: 'poi-cafe', caption: 'A photo' });
  studio.photos.map.enabled = true;
  studio.photos.strip.enabled = true;
  studio.decorations.scale.enabled = true;
  studio.decorations.compass.enabled = true;
  studio.decorations.grid.enabled = true;
  studio.decorations.qr = { ...studio.decorations.qr, enabled: true, target: 'layer', layerId: 'poi-cafe' };
  studio.wall = { ...studio.wall, enabled: true, frame: 'walnut' };
  studio.terrain = { ...studio.terrain, enabled: true, exaggeration: 2, contours: { ...studio.terrain.contours, enabled: true }, buildings: { ...studio.terrain.buildings, enabled: true } };
  studio.video = { motion: 'sway', durationSeconds: 15, fps: 60, aspect: '4:5', quality: 'high' };
  studio.relief.routeRidge = { ...studio.relief.routeRidge, enabled: true, layerId: 'route-01' };
  return project;
}

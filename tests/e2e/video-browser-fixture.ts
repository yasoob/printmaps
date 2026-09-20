import { Map } from 'maplibre-gl';
import { createProjectStore } from '../../src/app/store';
import { createInitialProjectDocument, createDefaultLayerAppearance } from '../../src/domain/project';
import { validatePhotoFile } from '../../src/domain/studioPhotoAssets';
import { addContentLayer } from '../../src/map/MapContentLayerRendering';
import { captureMapRenderSnapshot } from '../../src/map/MapRenderSnapshot';

export async function createVideoBrowserFixture() {
  const project = createInitialProjectDocument();
  project.camera = { ...project.camera, center: [16.37, 48.21], zoom: 10, bearing: 0, pitch: 0 };
  project.layers = [{
    id: 'video-photo-poi', name: 'Photo stop', type: 'poi', visible: true, locked: false, opacity: 100,
    geometry: { type: 'Point', coordinates: [...project.camera.center] },
    appearance: createDefaultLayerAppearance('poi'),
  }, ...project.layers.filter((layer) => layer.type === 'basemap')];
  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = photoCanvas.height = 32;
  const photoContext = photoCanvas.getContext('2d');
  if (!photoContext) throw new Error('Photo fixture cannot be created.');
  photoContext.fillStyle = '#ff0000';
  photoContext.fillRect(0, 0, 32, 32);
  const photoBlob = await new Promise<Blob>((resolve, reject) => photoCanvas.toBlob((blob) => {
    if (blob) resolve(blob); else reject(new Error('Photo fixture cannot be encoded.'));
  }));
  photoCanvas.width = photoCanvas.height = 0;
  const asset = await validatePhotoFile(new File([photoBlob], 'stop.png', { type: 'image/png' }));
  const { studio } = project;
  studio.poster.enabled = true;
  studio.poster.title = { ...studio.poster.title, enabled: true, text: 'An orbit worth keeping' };
  studio.poster.subtitle = { ...studio.poster.subtitle, enabled: true, text: 'A complete composed map' };
  studio.photos.assets[asset.id] = asset;
  studio.photos.stops = [{ id: 'video-photo', assetId: asset.id, layerId: project.layers[0].id, caption: 'A real embedded photo' }];
  studio.photos.map.enabled = true;
  studio.photos.strip.enabled = true;
  studio.decorations.compass = { ...studio.decorations.compass, enabled: true, color: '#00aa00' };
  studio.decorations.scale.enabled = true;
  studio.decorations.grid = { ...studio.decorations.grid, enabled: true, intervalDegrees: 0.05 };
  studio.decorations.qr.enabled = true;
  studio.video = { motion: 'orbit', durationSeconds: 5, fps: 30, aspect: '16:9', quality: 'standard' };
  const store = createProjectStore(project);
  const container = document.createElement('div');
  container.style.width = '600px';
  container.style.height = `${Math.round(600 * project.page.heightMm / project.page.widthMm)}px`;
  document.body.append(container);
  const map = new Map({
    container, style: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#d9ebf4' } }] },
    center: [...project.camera.center], zoom: project.camera.zoom, bearing: 0, pitch: 0,
    interactive: false, attributionControl: false, fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  const dispose = () => {
    try { map.remove(); } finally { container.remove(); }
  };
  try {
    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve());
      map.once('error', (event) => reject(new Error(event.error.message)));
    });
    addContentLayer(map, project.layers[0], {
      assets: {}, highlight: { selectedId: null, previewedId: null },
      rendered: { mapLayerIds: [], hitTestLayerIds: [], sourceIds: [], structure: '' },
    });
    await new Promise<void>((resolve) => { map.once('idle', () => resolve()); map.triggerRepaint(); });
    const state = { layers: store.getState().document.layers, assets: {} };
    const capture = () => captureMapRenderSnapshot(map, {
      isSourceReady: () => true, resolveStyle: () => map.getStyle(),
      resolvePrintFrame: () => container, resolveContent: () => state,
    });
    return { store, map, capture, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

function matchesColor(rgb: number[], expected: number[], tolerance: number) {
  return rgb.every((value, index) => Math.abs(value - expected[index]) < tolerance);
}

export function countVideoCompositionPixels(frame: ImageData, pageHeightMm: number) {
  let red = 0, green = 0, basemap = 0, attribution = 0;
  const pixels = frame.data;
  const attributionY = Math.floor(frame.height * (1 - 5 / pageHeightMm));
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const rgb = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    if (matchesColor(rgb, [255, 0, 0], 30)) red++;
    if (matchesColor(rgb, [0, 170, 0], 30)) green++;
    if (matchesColor(rgb, [217, 235, 244], 2)) basemap++;
    if (offset / 4 / frame.width > attributionY && Math.max(...rgb) < 100) attribution++;
  }
  return { red, green, basemap, attribution };
}

import { sha256Hex, type CustomMarkerAsset } from '../../src/domain/customMarkerAssets';
import { createDefaultLayerAppearance, createNewProjectDocument, type ContentLayer, type ProjectDocument } from '../../src/domain/project';
import { parseGeoJsonText } from '../../src/import/geojson';
import { MAX_PROJECT_FILE_BYTES, utf8Bytes } from '../../src/domain/projectSerialization';

export function largeBoundaryGeoJson() {
  const features = Array.from({ length: 200 }, (_, index) => {
    const x = 16.3 + (index % 20) * 0.005, y = 48.2 + Math.floor(index / 20) * 0.005;
    const ring = Array.from({ length: 800 }, (_, point) => {
      const angle = point / 800 * 2 * Math.PI;
      return [Number((x + 0.002 * Math.cos(angle)).toFixed(6)), Number((y + 0.002 * Math.sin(angle)).toFixed(6))];
    });
    ring.push([...ring[0]]);
    return { type: 'Feature', properties: { name: `Boundary ${index}` }, geometry: { type: 'Polygon', coordinates: [ring] } };
  });
  return { type: 'FeatureCollection', features };
}

export function boundaryProject() {
  const document = createNewProjectDocument();
  document.id = 'portable-budget';
  document.title = 'Budget X';
  const text = JSON.stringify(largeBoundaryGeoJson());
  document.layers.unshift(...parseGeoJsonText(text));
  return document;
}

export function paddedMarker(index: number, bytes: number): CustomMarkerAsset {
  const prefix = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><desc>${index}:`;
  const suffix = '</desc><rect width="100" height="100" fill="#123456"/></svg>';
  const source = prefix + 'x'.repeat(bytes - prefix.length - suffix.length) + suffix;
  const contents = new TextEncoder().encode(source);
  return {
    id: `sha256-${sha256Hex(contents)}`, mimeType: 'image/svg+xml', width: 100, height: 100,
    dataUri: `data:image/svg+xml;base64,${btoa(source)}`,
  };
}

function markerLayer(index: number, asset: CustomMarkerAsset): ContentLayer {
  const appearance = createDefaultLayerAppearance('poi');
  if (appearance?.kind !== 'poi') throw new Error('POI appearance unavailable');
  return {
    id: `marker-${index}`, name: `Marker ${index}`, type: 'poi', visible: true, locked: false, opacity: 1,
    geometry: { type: 'Point', coordinates: [16.35 + index * 0.001, 48.22] },
    appearance: { ...appearance, label: 'x', customAssetId: asset.id },
  };
}

function attachMarker(document: ProjectDocument, index: number, bytes: number) {
  const asset = paddedMarker(index, bytes);
  document.assets[asset.id] = asset;
  document.layers.unshift(markerLayer(index, asset));
  return asset;
}

export function byteBudgetProject(target = MAX_PROJECT_FILE_BYTES) {
  const document = boundaryProject();
  for (let index = 0; index < 5; index += 1) attachMarker(document, index, 850_000);
  const initial = attachMarker(document, 5, 200);
  const available = target - utf8Bytes(JSON.stringify(document));
  if (available < 0) throw new Error('Requested fixture budget is too small');
  const extraBytes = Math.floor(available / 4) * 3;
  delete document.assets[initial.id];
  document.layers.shift();
  attachMarker(document, 5, 200 + extraBytes);
  const remainder = target - utf8Bytes(JSON.stringify(document));
  document.title += 'x'.repeat(remainder);
  if (utf8Bytes(JSON.stringify(document)) !== target) throw new Error('Fixture does not meet the exact target');
  return document;
}

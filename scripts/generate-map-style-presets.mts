import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MAP_STYLE_PRESETS } from '../src/domain/mapStylePresets.ts';

const root = resolve(import.meta.dirname, '..');
const baseStyle = JSON.parse(await readFile(resolve(root, 'public/styles/bright.json'), 'utf8'));

function setExistingPaint(layer, properties, value) {
  for (const property of properties) {
    if (property in (layer.paint ?? {})) layer.paint[property] = value;
  }
}

function styleLayer(layer, tokens) {
  const id = layer.id.toLowerCase();
  const sourceLayer = layer['source-layer'];
  if (layer.type === 'background') {
    layer.paint = { ...layer.paint, 'background-color': tokens.canvas };
    return;
  }
  if (layer.type === 'symbol') {
    setExistingPaint(layer, ['text-color'], tokens.label);
    setExistingPaint(layer, ['text-halo-color'], tokens.labelHalo);
    setExistingPaint(layer, ['icon-color'], id.includes('rail') ? tokens.transit : tokens.label);
    setExistingPaint(layer, ['icon-halo-color'], tokens.labelHalo);
    return;
  }
  if (layer.type === 'fill') {
    let color = tokens.land;
    if (sourceLayer === 'water' || sourceLayer === 'waterway' || id.includes('water')) color = tokens.water;
    else if (sourceLayer === 'park' || id.includes('park') || sourceLayer === 'landcover' || sourceLayer === 'landuse') color = tokens.park;
    else if (sourceLayer === 'building') color = tokens.building;
    setExistingPaint(layer, ['fill-color', 'fill-outline-color'], color);
    return;
  }
  if (layer.type !== 'line') return;
  let color = tokens.boundary;
  if (sourceLayer === 'water' || sourceLayer === 'waterway' || id.includes('water')) color = tokens.water;
  else if (id.includes('rail') || id.includes('transit')) color = tokens.transit;
  else if (sourceLayer === 'transportation') {
    color = /motorway|trunk|primary|secondary|major/.test(id) ? tokens.majorRoad : tokens.minorRoad;
  }
  setExistingPaint(layer, ['line-color'], color);
}

for (const preset of MAP_STYLE_PRESETS) {
  const style = structuredClone(baseStyle);
  style.name = `Print Map Studio — ${preset.label}`;
  style.metadata = {
    ...style.metadata,
    'print-map-studio:preset': preset.id,
    'print-map-studio:family': preset.family,
    'print-map-studio:semantic-tokens': preset.tokens,
    'print-map-studio:generated-from': 'OpenFreeMap Bright',
  };
  for (const layer of style.layers) styleLayer(layer, preset.tokens);
  await writeFile(resolve(root, 'public/styles', `${preset.id}.json`), `${JSON.stringify(style)}\n`);
}

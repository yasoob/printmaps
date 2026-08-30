import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MAP_STYLE_PRESETS } from '../src/domain/mapStylePresets.ts';
import { applySemanticTokensToStyle } from '../src/map/MapStyleSemantic.ts';

const root = resolve(import.meta.dirname, '..');
const baseStyle = JSON.parse(await readFile(resolve(root, 'public/styles/bright.json'), 'utf8'));

for (const preset of MAP_STYLE_PRESETS) {
  const style = applySemanticTokensToStyle(baseStyle, preset.tokens);
  style.name = `Print Map Studio — ${preset.label}`;
  style.metadata = {
    ...style.metadata,
    'print-map-studio:preset': preset.id,
    'print-map-studio:family': preset.family,
    'print-map-studio:semantic-tokens': preset.tokens,
    'print-map-studio:generated-from': 'OpenFreeMap Bright',
  };
  await writeFile(resolve(root, 'public/styles', `${preset.id}.json`), `${JSON.stringify(style)}\n`);
}

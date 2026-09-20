import { readFileSync } from 'node:fs';

it('uses defined shared color tokens throughout the new studio and sharing surfaces', () => {
  const definitions = readFileSync('src/theme.css', 'utf8') + readFileSync('src/styles.css', 'utf8');
  for (const path of [
    'src/app/studio/studioComposition.css',
    'src/sharing/sharing.css',
    'src/app/components/terrainControls.css',
    'src/app/components/videoExport.css',
  ]) {
    const styles = readFileSync(path, 'utf8');
    expect(styles, path).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    for (const [, token] of styles.matchAll(/var\((--studio-[\w-]+)/g)) {
      expect(definitions, `${path}: ${token}`).toContain(`${token}:`);
    }
  }
});

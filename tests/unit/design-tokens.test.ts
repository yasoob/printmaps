import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (filePath: string) => readFileSync(path.resolve(process.cwd(), filePath), 'utf8');

describe('design token discipline', () => {
  it('routes component styling through Tailwind and global color tokens', () => {
    const theme = read('src/theme.css');
    const styles = read('src/styles.css');
    const components = [read('src/app/App.tsx'), read('src/map/MapCanvas.tsx')].join('\n');

    expect(theme).toContain('@theme inline');
    expect(theme).toContain('--color-surface: var(--studio-surface)');
    expect(theme).toContain('--studio-focus: #005fb8');
    expect(theme).toContain('--studio-text-muted: #6b6b6b');
    expect(theme).toContain('--studio-text-subtle: #6b6b6b');
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain('@apply');
    expect(styles).toContain('.maplibregl-ctrl-attrib');
    expect(styles).toMatch(/\.maplibregl-ctrl-attrib[^}]*font-size:\s*var\(--studio-font-micro\)/s);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(components).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});

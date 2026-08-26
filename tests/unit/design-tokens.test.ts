import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (filePath: string) => readFileSync(path.resolve(process.cwd(), filePath), 'utf8');

describe('design token discipline', () => {
  it('routes component styling through Tailwind and global color tokens', () => {
    const theme = read('src/theme.css');
    const styles = read('src/styles.css');
    const components = [read('src/app/App.tsx'), read('src/map/MapCanvas.tsx')].join('\n');
    const iconComponents = [
      read('src/app/components/ElevationProfilePanel.tsx'),
      read('src/app/components/LayerMenu.tsx'),
    ].join('\n');

    expect(theme).toContain('@theme inline');
    expect(theme).toContain('--color-surface: var(--studio-surface)');
    expect(theme).toContain('--studio-focus: #005fb8');
    expect(theme).toContain('--studio-text-muted: #6b6b6b');
    expect(theme).toContain('--studio-text-subtle: #6b6b6b');
    expect(theme).toContain('--studio-control-height: 2rem');
    expect(theme).toContain('--studio-font-control: 0.8125rem');
    expect(theme).toContain('--studio-font-label: 0.75rem');
    expect(theme).toContain('--studio-font-meta: 0.6875rem');
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain('@apply');
    expect(styles).toContain('.inspector-accordion');
    expect(styles).toContain('.inspector-section-summary');
    expect(styles).toContain('.maplibregl-ctrl-attrib');
    expect(styles).toMatch(/\.maplibregl-ctrl-attrib[^}]*font-size:\s*var\(--studio-font-micro\)/s);
    expect(styles).toMatch(/\.studio-checkbox-box[^}]*pointer-events:\s*none/s);
    expect(styles).toMatch(/\.studio-switch-track[^}]*pointer-events:\s*none/s);
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(components).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(iconComponents).not.toMatch(/[↑↓←→▲▼▶◀‹›]|•••/);
  });

  it('keeps search results and map scale flat without decorative shadows', () => {
    const styles = read('src/styles.css');
    const flatSelectors = [
      '.location-search-form',
      '.location-search-results',
      '.map-scale',
      '.map-scale span',
    ];
    const flatRules = flatSelectors.map((selector) => {
      const start = styles.indexOf(`${selector} {`);
      expect(start, `missing ${selector} rule`).toBeGreaterThanOrEqual(0);
      const end = styles.indexOf('}', start);
      return styles.slice(start, end + 1);
    }).join('\n');

    expect(flatRules).not.toMatch(/box-shadow|drop-shadow|text-shadow/);
  });
});

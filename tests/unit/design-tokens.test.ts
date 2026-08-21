import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('design token discipline', () => {
  it('routes component styling through Tailwind and global color tokens', () => {
    const theme = read('src/theme.css');
    const styles = read('src/styles.css');

    expect(theme).toContain('@theme inline');
    expect(theme).toContain('--color-surface: var(--studio-surface)');
    expect(styles).toContain('@import "tailwindcss"');
    expect(styles).toContain('@apply');
    expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});

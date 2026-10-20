import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { homeUpdated, pageSourceFiles, pageUpdated } from '../../src/marketing/contentDates';
import { HOME_PAGE, marketingPages } from '../../src/marketing/registry';

const root = path.resolve(import.meta.dirname, '../..');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Routes that are not marketing pages and so are not in the registry.
const NON_MARKETING_ROUTES = new Set(['index', 'editor', '404']);

function gitDate(files: readonly string[]): string {
  return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { cwd: root, encoding: 'utf8' }).trim();
}

describe('marketing content dates', () => {
  it('registers every marketing route, so the sitemap cannot miss one', () => {
    const routes = readdirSync(path.join(root, 'src/pages'))
      .filter((file) => file.endsWith('.astro'))
      .map((file) => file.replace(/\.astro$/, ''))
      .filter((slug) => !NON_MARKETING_ROUTES.has(slug));
    const registered = new Set(marketingPages.map((entry) => entry.slug));
    expect(routes.filter((slug) => !registered.has(slug))).toEqual([]);
  });

  it.each(marketingPages.map((entry) => [entry.slug, entry] as const))('%s is dated by its newest commit or its manual floor', (_slug, entry) => {
    const date = pageUpdated(entry);
    expect(date).toMatch(DATE);
    expect(date >= entry.updated).toBe(true);
    const committed = gitDate(pageSourceFiles(entry.slug).filter((file) => {
      try {
        execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: root, stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }));
    if (DATE.test(committed)) expect(date).toBe(committed.localeCompare(entry.updated) > 0 ? committed : entry.updated);
  });

  it('dates the homepage no earlier than its manual floor', () => {
    expect(homeUpdated()).toMatch(DATE);
    expect(homeUpdated() >= HOME_PAGE.updated).toBe(true);
  });
});

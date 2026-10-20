import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { HOME_PAGE } from './registry';
import type { MarketingPageEntry } from './pages/types';

/*
Build-time "last updated" dates for marketing pages, taken from git: the newest commit that
touched the page's route or its registry entry. The manual `updated` field is a floor, so a
deliberate bump still wins, and it is the fallback when git history is missing (for example a
shallow CI checkout, which would otherwise stamp every page with the latest commit date).
*/

const ROOT = process.cwd();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cache = new Map<string, string>();

function git(args: readonly string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

const historyState = { checked: false, available: false };

function hasFullHistory(): boolean {
  if (!historyState.checked) {
    historyState.available = git(['rev-parse', '--is-shallow-repository']) === 'false';
    historyState.checked = true;
  }
  return historyState.available;
}

function lastCommitDate(files: readonly string[]): string | undefined {
  const tracked = files.filter((file) => existsSync(path.join(ROOT, file)));
  if (tracked.length === 0 || !hasFullHistory()) return undefined;
  const date = git(['log', '-1', '--format=%cs', '--', ...tracked]);
  return date && DATE.test(date) ? date : undefined;
}

function laterOf(manual: string, fromGit: string | undefined): string {
  return fromGit && fromGit > manual ? fromGit : manual;
}

function remember(key: string, compute: () => string): string {
  let value = cache.get(key);
  if (value === undefined) {
    value = compute();
    cache.set(key, value);
  }
  return value;
}

export function pageSourceFiles(slug: string): string[] {
  return [`src/pages/${slug}.astro`, `src/pages/${slug}/index.astro`, `src/marketing/pages/${slug}.ts`];
}

function homeSourceFiles(): string[] {
  const files = ['src/pages/index.astro', 'src/marketing/product.ts'];
  const marketingFiles = readdirSync(path.join(ROOT, 'src/marketing'));
  for (const file of marketingFiles) {
    if (/^(Home|MarketingHero|MapCapabilityStrip|HeroEditorPreview).*\.astro$/.test(file)) files.push(`src/marketing/${file}`);
  }
  return files;
}

/**
Last content change for a registry page, `YYYY-MM-DD`.
*/
export function pageUpdated(entry: Pick<MarketingPageEntry, 'slug' | 'updated'>): string {
  return remember(entry.slug, () => laterOf(entry.updated, lastCommitDate(pageSourceFiles(entry.slug))));
}

/**
Last content change for the homepage, `YYYY-MM-DD`.
*/
export function homeUpdated(): string {
  return remember('', () => laterOf(HOME_PAGE.updated, lastCommitDate(homeSourceFiles())));
}

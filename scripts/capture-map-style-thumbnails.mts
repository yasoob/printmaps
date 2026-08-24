import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { MAP_STYLE_PRESETS, type MapStylePreset } from '../src/domain/mapStylePresets.ts';

const outputDirectory = new URL('../public/style-thumbnails/', import.meta.url).pathname;
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'print-map-style-thumbnails-'));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const manifest: Partial<Record<MapStylePreset, string>> = {};
try {
  await mkdir(outputDirectory, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4178/');
  const map = page.getByTestId('map-canvas');
  await map.waitFor({ state: 'visible' });
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 });

  for (const preset of MAP_STYLE_PRESETS) {
    await page.getByRole('radio', { name: new RegExp(`^${preset.label}:`) }).click();
    await map.waitFor({ state: 'visible' });
    await page.locator(`[data-style-preset="${preset.id}"][data-map-ready="true"]`).waitFor({ timeout: 30_000 });
    const rawPath = `${temporaryDirectory}/${preset.id}.png`;
    await page.locator('.print-frame').screenshot({ animations: 'disabled', path: rawPath });
    const outputPath = `${outputDirectory}/${preset.id}.png`;
    execFileSync('magick', [rawPath, '-resize', '216x144^', '-gravity', 'center', '-extent', '216x144', '-strip', outputPath]);
    manifest[preset.id] = createHash('sha256').update(await readFile(outputPath)).digest('hex');
  }
  await writeFile(`${outputDirectory}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
} finally {
  try {
    await browser?.close();
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

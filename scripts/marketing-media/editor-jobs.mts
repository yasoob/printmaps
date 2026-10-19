import type { Page } from 'playwright';
import type { Context, Job } from './capture.mts';
import { loadScene } from './editor.mts';
import { encode, presentPoster } from './compose.mts';
import { accordion, box, capture, collapseAll, openExport, openTab, pad, selectLayer, settle, useProductionOrigin, type Box } from './ui.mts';

export const PANEL_TITLES = ['Style', 'Labels & details', 'Terrain', 'View', 'Page', 'Map frame', 'Text', 'Photos', 'Map elements'];

/** Map canvas plus the inspector: the standard framing for feature shots. */
export const INSPECTOR_VIEW: Box = { x: 240, y: 44, width: 1200, height: 856 };

export async function rawShot(context: Context, page: Page, name: string, clip?: Box) {
  const file = context.raw(`${name}.png`);
  await capture(page, file, clip);
  return file;
}

export async function dialogBox(page: Page, padding = 0) {
  return pad(await box(page.getByRole('dialog').first()), padding);
}

async function sceneShot(context: Context, scene: string, prepare: (page: Page) => Promise<void>) {
  const page = await context.page();
  await loadScene(page, scene);
  await prepare(page);
  return page;
}

export const editorJobs: Job[] = [
  {
    id: 'country',
    async run(context) {
      const controls = context.raw('country-controls.png');
      const poster = await context.poster('italy', async (page) => {
        await openTab(page, 'Layout');
        await collapseAll(page, PANEL_TITLES);
        await accordion(page, 'Map frame');
        await capture(page, controls, INSPECTOR_VIEW);
      });
      await presentPoster(poster, context.out('marketing/country/italy-country-shaped-map-poster.webp'));
      await encode(controls, context.out('marketing/country/country-outline-map-frame-controls.webp'), { width: 1600 });
    },
  },
  {
    id: 'photos-controls',
    async run(context) {
      const page = await sceneShot(context, 'road-trip', async (current) => {
        await openTab(current, 'Layout');
        await collapseAll(current, PANEL_TITLES);
        await accordion(current, 'Photos');
      });
      const raw = await rawShot(context, page, 'photos-controls', INSPECTOR_VIEW);
      await encode(raw, context.out('marketing/photos/photo-story-controls.webp'), { width: 1600 });
    },
  },
  {
    id: 'templates-gallery',
    async run(context) {
      const page = await sceneShot(context, 'lisbon', async (current) => {
        await current.getByRole('button', { name: 'Project', exact: true }).click();
        await current.getByRole('menuitem', { name: 'New from template' }).click();
        await current.waitForTimeout(2500);
      });
      const raw = await rawShot(context, page, 'templates-gallery', await dialogBox(page));
      await encode(raw, context.out('marketing/templates/new-from-template-gallery.webp'), { width: 1600 });
    },
  },
  {
    id: 'topo-3d',
    async run(context) {
      const page = await sceneShot(context, 'matterhorn-3d', async (current) => {
        await collapseAll(current, PANEL_TITLES);
        await accordion(current, 'Terrain');
        await settle(current, 6000);
      });
      const raw = await rawShot(context, page, 'topo-3d', { x: 240, y: 44, width: 1200, height: 856 });
      await encode(raw, context.out('marketing/topo/matterhorn-3d-terrain-with-contours.webp'), { width: 1600 });
    },
  },
  {
    id: 'route-elevation',
    async run(context) {
      const page = await sceneShot(context, 'ventoux-editor', async (current) => {
        await selectLayer(current, 'Bédoin ascent');
        await current.getByRole('button', { name: /^Advanced/ }).click();
        await current.getByRole('button', { name: /elevation profile/ }).first().click();
        const chart = current.getByRole('img', { name: /elevation profile/ }).first();
        await chart.waitFor({ timeout: 60_000 });
        await chart.scrollIntoViewIfNeeded();
        await settle(current, 2000);
      });
      const raw = await rawShot(context, page, 'route-elevation', INSPECTOR_VIEW);
      await encode(raw, context.out('marketing/route/mont-ventoux-elevation-panel.webp'), { width: 1600 });
      const profile = context.raw('ventoux-elevation-profile.png');
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download elevation PNG' }).click();
      await (await pending).saveAs(profile);
      await presentPoster(profile, context.out('marketing/route/mont-ventoux-elevation-profile.webp'), { width: 1600, height: 900 });
    },
  },
  {
    id: 'isochrone-controls',
    async run(context) {
      const page = await sceneShot(context, 'amsterdam', async (current) => {
        await current.getByRole('button', { name: 'Area (S)' }).click();
        await current.getByRole('tab', { name: 'Travel time' }).click();
        const search = current.getByRole('combobox', { name: 'Search places and addresses' });
        await search.fill('Dam Square');
        await search.press('Enter');
        await current.getByRole('option', { name: /Dam Square/ }).first().click();
        await current.getByRole('radio', { name: 'Walking' }).click();
        const duration = current.getByRole('slider', { name: 'Travel time in minutes' });
        await duration.focus();
        await duration.waitFor();
        await settle(current, 1500);
      });
      const raw = await rawShot(context, page, 'isochrone-controls', INSPECTOR_VIEW);
      await encode(raw, context.out('marketing/travel-time/travel-time-area-controls.webp'), { width: 1600 });
    },
  },
  {
    id: 'realestate-places',
    async run(context) {
      const page = await sceneShot(context, 'clifton-base', async (current) => {
        await current.getByRole('button', { name: 'Place (P)' }).click();
        await current.getByRole('button', { name: 'Paste POI list' }).click();
        await current.getByRole('radio', { name: 'Addresses' }).check();
        await current.getByRole('textbox', { name: 'POI spreadsheet rows' }).fill([
          'Clifton Down station\tClifton Down station, Bristol',
          'Christ Church Primary\tChrist Church Primary School, Clifton',
          'Brandon Hill park\tBrandon Hill, Bristol',
          'Shops & cafés\tWhiteladies Road, Bristol',
          'Suspension Bridge\tClifton Suspension Bridge, Bristol',
        ].join('\n'));
        await current.getByRole('button', { name: 'Look up addresses' }).click();
        await current.getByRole('button', { name: 'Stop lookup' }).waitFor({ state: 'detached', timeout: 30_000 });
        await settle(current, 1500);
      });
      const raw = await rawShot(context, page, 'realestate-places', INSPECTOR_VIEW);
      await encode(raw, context.out('marketing/real-estate/bulk-places-address-lookup.webp'), { width: 1600 });
    },
  },
  {
    id: 'share',
    async run(context) {
      const page = await sceneShot(context, 'lisbon', async (current) => {
        await current.getByRole('button', { name: 'Share', exact: true }).click();
        await current.waitForTimeout(1500);
        await useProductionOrigin(current);
      });
      const raw = await rawShot(context, page, 'share-dialog', await dialogBox(page));
      await encode(raw, context.out('marketing/share/share-link-and-embed-dialog.webp'), { width: 1200 });
      const full = await rawShot(context, page, 'share-dialog-editor');
      await encode(full, context.out('marketing/editor/share-dialog-over-editor.webp'), { width: 1600 });
    },
  },
  {
    id: 'wall',
    async run(context) {
      const page = await sceneShot(context, 'wedding', async (current) => {
        await openExport(current, 'Print');
        await current.getByRole('button', { name: 'Preview on wall' }).click();
        await current.locator('.studio-wall-scene img').waitFor({ timeout: 30_000 });
        await current.waitForTimeout(2500);
      });
      const raw = await rawShot(context, page, 'wall-preview', await dialogBox(page));
      await encode(raw, context.out('marketing/editor/wall-preview-framed-poster.webp'), { width: 1600 });
    },
  },
  {
    id: 'export-print',
    async run(context) {
      const page = await sceneShot(context, 'lisbon', async (current) => {
        const dialog = await openExport(current, 'Print');
        await dialog.getByRole('radio', { name: /^PNG/ }).click();
        await current.waitForTimeout(2000);
      });
      const raw = await rawShot(context, page, 'export-print', await dialogBox(page));
      await encode(raw, context.out('marketing/editor/export-dialog-print-preview.webp'), { width: 1600 });
    },
  },
  {
    id: 'compare-export',
    async run(context) {
      const page = await sceneShot(context, 'amsterdam', async (current) => {
        const dialog = await openExport(current, 'Print');
        await dialog.getByRole('radio', { name: /^PDF/ }).click();
        await dialog.getByRole('button', { name: /Technical details/ }).click();
        await current.waitForTimeout(2000);
      });
      const raw = await rawShot(context, page, 'compare-export', await dialogBox(page));
      await encode(raw, context.out('marketing/compare/export-dialog-pdf-option.webp'), { width: 1600 });
    },
  },
  {
    id: 'sizes',
    async run(context) {
      const page = await sceneShot(context, 'lisbon', async (current) => {
        await openTab(current, 'Layout');
        await collapseAll(current, PANEL_TITLES);
        await accordion(current, 'Page');
        await current.locator('.right-sidebar').getByRole('combobox').first().click();
        await current.waitForTimeout(600);
      });
      const raw = await rawShot(context, page, 'sizes', INSPECTOR_VIEW);
      await encode(raw, context.out('marketing/sizes/page-size-presets.webp'), { width: 1600 });
    },
  },
  {
    id: 'editor-tabs',
    async run(context) {
      const map = await sceneShot(context, 'kyoto', (current) => openTab(current, 'Map'));
      await encode(await rawShot(context, map, 'editor-map-tab'), context.out('marketing/editor/map-tab-style-gallery.webp'), { width: 1600 });
      const layout = await sceneShot(context, 'lisbon', async (current) => {
        await openTab(current, 'Layout');
        await collapseAll(current, PANEL_TITLES);
        await accordion(current, 'Text');
      });
      await encode(await rawShot(context, layout, 'editor-layout-tab'), context.out('marketing/editor/layout-tab-poster-text.webp'), { width: 1600 });
    },
  },
  {
    id: 'editor-route',
    async run(context) {
      const page = await sceneShot(context, 'road-trip-editor', (current) => selectLayer(current, 'Scenic drive'));
      await encode(await rawShot(context, page, 'editor-route'), context.out('marketing/editor/route-layer-selected.webp'), { width: 1600 });
    },
  },
];

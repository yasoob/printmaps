/**
 * Refreshes the images that existing pages reference by path. Filenames and pixel sizes stay
 * the same so current markup keeps working.
 */
import type { Page } from 'playwright';
import type { Context, Job } from './capture.mts';
import { loadScene } from './editor.mts';
import { encode } from './compose.mts';
import { accordion, box, collapseAll, openExport, openTab, pad, selectLayer, type Box } from './ui.mts';
import { dialogBox, PANEL_TITLES, rawShot } from './editor-jobs.mts';

const RIGHT_PANEL: Box = { x: 875, y: 44, width: 565, height: 856 };

type Size = { width: number; height: number };

async function scenePage(context: Context, scene: string, viewport?: Size) {
  const page = await context.page(viewport);
  await loadScene(page, scene);
  return page;
}

async function save(context: Context, raw: string, publicPath: string, size: Size, withPng = false) {
  await encode(raw, context.out(publicPath), size);
  if (withPng) await encode(raw, context.out(publicPath.replace(/\.webp$/, '.png')), size);
}

async function inspector(context: Context, page: Page, name: string, publicPath: string) {
  await save(context, await rawShot(context, page, name, RIGHT_PANEL), publicPath, { width: 1130, height: 1716 });
}

async function openMobilePanel(page: Page, name: 'layers' | 'properties') {
  const buttons = page.locator('.mobile-panel-actions > button');
  await (name === 'layers' ? buttons.first() : buttons.last()).click();
  await page.waitForTimeout(900);
}

export const legacyJobs: Job[] = [
  {
    id: 'legacy-feature-shots',
    async run(context) {
      const design = await scenePage(context, 'copenhagen');
      await openTab(design, 'Map');
      await save(context, await rawShot(context, design, 'legacy-design-desktop'), 'feature-shots/design-desktop.webp', { width: 1440, height: 900 }, true);
      const content = await scenePage(context, 'ventoux-editor');
      await selectLayer(content, 'Bédoin ascent');
      await save(context, await rawShot(context, content, 'legacy-content-desktop'), 'feature-shots/content-desktop.webp', { width: 1440, height: 900 }, true);
      const exporting = await scenePage(context, 'kyoto');
      await openExport(exporting, 'Print');
      await save(context, await rawShot(context, exporting, 'legacy-export-desktop'), 'feature-shots/export-desktop.webp', { width: 1440, height: 900 }, true);
    },
  },
  {
    id: 'legacy-feature-mobile',
    async run(context) {
      const phone = { width: 390, height: 844 };
      const lower: Box = { x: 0, y: 352, width: 390, height: 422 };
      const size = { width: 780, height: 844 };
      const design = await scenePage(context, 'copenhagen', phone);
      await openMobilePanel(design, 'properties');
      await save(context, await rawShot(context, design, 'legacy-design-mobile', { x: 0, y: 422, width: 390, height: 422 }), 'feature-shots/design-mobile.webp', size, true);
      const content = await scenePage(context, 'ventoux-editor', phone);
      await save(context, await rawShot(context, content, 'legacy-content-mobile', { x: 0, y: 0, width: 390, height: 422 }), 'feature-shots/content-mobile.webp', size, true);
      const exporting = await scenePage(context, 'kyoto', phone);
      await openExport(exporting, 'Print');
      const dialog = await dialogBox(exporting);
      await save(context, await rawShot(context, exporting, 'legacy-export-mobile', { ...lower, y: Math.max(0, dialog.y) }), 'feature-shots/export-mobile.webp', size, true);
      const overview = await scenePage(context, 'clifton', { width: 390, height: 420 });
      await save(context, await rawShot(context, overview, 'legacy-overview-mobile'), 'explore-shots/export-editor-overview-mobile.webp', { width: 780, height: 840 });
    },
  },
  {
    id: 'legacy-inspector',
    async run(context) {
      const colors = await scenePage(context, 'lisbon');
      await colors.getByRole('button', { name: /Customize colors/ }).click();
      await colors.waitForTimeout(800);
      await inspector(context, colors, 'legacy-custom-colors', 'explore-shots/custom-colors.webp');
      const labels = await scenePage(context, 'lisbon-german');
      await collapseAll(labels, PANEL_TITLES);
      await accordion(labels, 'Labels & details');
      await inspector(context, labels, 'legacy-labels', 'explore-shots/labels-and-text.webp');
      const details = await scenePage(context, 'lisbon-details');
      await collapseAll(details, PANEL_TITLES);
      await accordion(details, 'Labels & details');
      await inspector(context, details, 'legacy-map-features', 'explore-shots/map-features.webp');
      const route = await scenePage(context, 'thames-editor');
      await selectLayer(route, 'Marathon route');
      await inspector(context, route, 'legacy-route-appearance', 'explore-shots/route-appearance.webp');
      const advanced = route.getByRole('button', { name: /^Advanced/ });
      await advanced.click();
      await advanced.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await route.waitForTimeout(600);
      await inspector(context, route, 'legacy-route-advanced', 'explore-shots/route-advanced.webp');
      const waypoint = await scenePage(context, 'clifton');
      await selectLayer(waypoint, 'Royal York Crescent');
      await inspector(context, waypoint, 'legacy-waypoint', 'explore-shots/waypoint-style.webp');
    },
  },
  {
    id: 'legacy-frames',
    async run(context) {
      const frameShot = async (scene: string, name: string, publicPath: string, size: Size) => {
        const page = await scenePage(context, scene);
        const frame = await box(page.locator('.print-frame'));
        const target = size.width / size.height;
        const padded = pad(frame, 36);
        const width = Math.min(1136 - padded.x, Math.max(padded.width, padded.height * target));
        const height = width / target;
        const clip = { x: padded.x + (padded.width - width) / 2, y: Math.max(44, frame.y + frame.height / 2 - height / 2), width, height };
        await save(context, await rawShot(context, page, name, clip), publicPath, size);
      };
      await frameShot('style-sample', 'legacy-printable-frame', 'explore-shots/printable-page-frame.webp', { width: 915, height: 715 });
      await frameShot('ventoux', 'legacy-gpx-frame', 'explore-shots/gpx-print-frame.webp', { width: 913, height: 715 });
      await frameShot('amsterdam', 'legacy-flat-map', 'explore-shots/export-flat-map.webp', { width: 1400, height: 1040 });
    },
  },
  {
    id: 'legacy-overview',
    async run(context) {
      const layers = await scenePage(context, 'clifton');
      await save(context, await rawShot(context, layers, 'legacy-layers', { x: 0, y: 0, width: 920, height: 650 }), 'explore-shots/imported-layers-overview.webp', { width: 1840, height: 1300 });
      await save(context, await rawShot(context, layers, 'legacy-overview-desktop'), 'explore-shots/export-editor-overview-desktop.webp', { width: 1440, height: 900 });
      const psd = await scenePage(context, 'vienna-psd', { width: 1386, height: 800 });
      await save(context, await rawShot(context, psd, 'legacy-psd-editor'), 'explore-shots/psd-workflow-editor.webp', { width: 2000, height: 1155 });
    },
  },
  {
    id: 'legacy-export',
    async run(context) {
      const page = await scenePage(context, 'amsterdam');
      const dialog = await openExport(page, 'Print');
      await dialog.getByRole('radio', { name: /^PDF/ }).click();
      await page.waitForTimeout(1500);
      const panel = await box(dialog.getByRole('radiogroup', { name: 'Export format' }));
      const whole = await dialogBox(page);
      const width = whole.x + whole.width - panel.x + 16;
      const clip = { x: panel.x - 16, y: panel.y - 16, width, height: width * 852 / 1024 };
      await save(context, await rawShot(context, page, 'legacy-pdf-summary', clip), 'explore-shots/export-pdf-summary.webp', { width: 1024, height: 852 });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Project', exact: true }).click();
      await page.waitForTimeout(600);
      const menu = pad(await box(page.getByRole('menu')), 28);
      const menuHeight = menu.width * 780 / 860;
      const menuClip = { x: menu.x, y: Math.max(0, menu.y + menu.height / 2 - menuHeight / 2), width: menu.width, height: menuHeight };
      await save(context, await rawShot(context, page, 'legacy-project-menu', menuClip), 'explore-shots/export-project-download.webp', { width: 860, height: 780 });
    },
  },
];

import { expect, type Page, type TestInfo } from '@playwright/test';
import type { ReactScanProbeController, ReactScanProbeResult } from '../../src/dev/reactScanProbe';

type ProbeWindow = typeof globalThis & { __PRINT_MAP_REACT_SCAN__?: ReactScanProbeController };

export async function waitForRenderQuiet(page: Page) {
  await page.waitForFunction(() => {
    const probe = (globalThis as ProbeWindow).__PRINT_MAP_REACT_SCAN__;
    return probe && performance.now() - probe.lastActivityAt >= 500;
  });
}

export async function openScanEditor(page: Page) {
  await page.goto('./');
  await page.addStyleTag({ content: '#react-scan-root { pointer-events: none !important; }' });
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 30_000 });
  await waitForRenderQuiet(page);
}

export async function startProbe(page: Page, label: string) {
  await waitForRenderQuiet(page);
  await page.evaluate((value) => {
    const probe = (globalThis as ProbeWindow).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error('React Scan probe was not installed.');
    probe.start(value);
  }, label);
}

export async function finishProbe(page: Page, testInfo: TestInfo, label: string) {
  await page.waitForTimeout(200);
  const result = await page.evaluate(() => {
    const probe = (globalThis as ProbeWindow).__PRINT_MAP_REACT_SCAN__;
    if (!probe) throw new Error('React Scan probe was not installed.');
    return { ...probe.finish(), inventory: probe.inventory, instances: probe.instances };
  });
  await testInfo.attach(label, { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify(result));
  return result;
}

export function expectOwners(result: ReactScanProbeResult, positive: string[], negative: string[]) {
  for (const name of positive) expect(result.components[name]?.callbacks, `${result.label}: ${name} must update`).toBeGreaterThan(0);
  for (const name of negative) expect(result.components[name], `${result.label}: ${name} must stay isolated`).toBeUndefined();
}

export const NATIVE_MAP_OWNERS = [
  'MapCanvas', 'CanvasWorkspace', 'CanvasWorkspaceChrome', 'LocationSearch',
  'MapScale', 'LayerNavigation', 'StudioTerrainControls', 'StudioVideoControls',
];

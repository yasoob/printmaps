import { expect, test, type Locator } from '@playwright/test';

type Color = { red: number; green: number; blue: number };

function linear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function parseColor(color: string): Color {
  const isSrgb = color.startsWith('color(srgb ');
  if (!isSrgb && !color.startsWith('rgb')) throw new Error(`Unsupported computed color: ${color}`);
  const matches = color.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/gi);
  if (!matches) throw new Error(`Missing computed color channels: ${color}`);
  const [red, green, blue, alpha] = matches.map(Number);
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Missing computed color channels: ${color}`);
  }
  if (alpha !== undefined && alpha !== 1) throw new Error(`Expected an opaque computed color: ${color}`);
  const scale = isSrgb ? 255 : 1;
  return { red: red * scale, green: green * scale, blue: blue * scale };
}

function luminance(color: Color) {
  return 0.2126 * linear(color.red) + 0.7152 * linear(color.green) + 0.0722 * linear(color.blue);
}

async function expectReadableAction(button: Locator) {
  await expect(button).toBeEnabled();
  const colors = await button.evaluate((element) => {
    const style = getComputedStyle(element);
    const before = getComputedStyle(element, '::before');
    const background = before.content !== 'none' && before.backgroundColor !== 'rgba(0, 0, 0, 0)'
      ? before.backgroundColor : style.backgroundColor;
    return { foreground: style.color, background };
  });
  const first = luminance(parseColor(colors.foreground));
  const second = luminance(parseColor(colors.background));
  const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`primary actions and active tool labels meet contrast requirements at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });
    const activeTool = page.getByRole('button', { name: 'Select (V)' });
    await expectReadableAction(activeTool);
    const exportButton = page.getByRole('button', { name: 'Export', exact: true });
    await expectReadableAction(exportButton);
    await exportButton.hover();
    await expectReadableAction(exportButton);
    await exportButton.click();
    const download = page.getByRole('button', { name: 'Download PNG', exact: true });
    await expectReadableAction(download);
    await download.hover();
    await expectReadableAction(download);
  });
}

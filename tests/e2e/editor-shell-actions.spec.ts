import { expect, test } from '@playwright/test';

test('initial editor search, live scale, title history, and Project actions work together', async ({ page }, testInfo) => {
  await page.route('https://api.mapbox.com/search/geocode/v6/forward**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          id: 'place.vienna',
          geometry: { type: 'Point', coordinates: [16.3725, 48.2084] },
          properties: { name: 'Vienna', place_formatted: 'Austria' },
        }],
      }),
    });
  });
  await page.goto('./');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-ready', 'true', { timeout: 20_000 });

  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(undo).toHaveCSS('cursor', 'default');
  await expect(undo).toHaveCSS('opacity', '0.38');

  await page.getByRole('button', { name: 'Vienna field guide' }).click();
  const title = page.getByRole('textbox', { name: 'Project title' });
  await expect(title).toBeFocused();
  await title.fill('Summer map');
  await title.press('Enter');
  await expect(page.getByRole('button', { name: 'Summer map' })).toBeVisible();
  await expect(undo).toBeEnabled();

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Vienna field guide' })).toBeVisible();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByRole('button', { name: 'Summer map' })).toBeVisible();

  const search = page.getByRole('combobox', { name: 'Search places and addresses' });
  await search.fill('Vienna');
  await search.press('Enter');
  await page.getByRole('option', { name: 'Vienna, Austria' }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-location-request', /16\.3725,48\.2084/);

  const scale = page.getByLabel(/^Map scale:/);
  const initialScale = await scale.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(scale).not.toHaveAttribute('aria-label', initialScale!);

  const project = page.getByRole('button', { name: 'Project' });
  await expect(project).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Share' })).toHaveCount(0);
  await project.click();
  await expect(page.getByRole('menuitem', { name: 'Open project' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Download project' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Import map data' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('editor-shell-actions.png') });
});

test('Backspace deletes a selected content layer but never hijacks text editing', async ({ page }) => {
  await page.goto('./');
  const coffee = page.getByRole('button', { name: 'Select Coffee stop' });
  await coffee.click();
  await page.keyboard.press('Backspace');
  await expect(coffee).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Select Coffee stop' })).toBeVisible();

  await page.getByRole('button', { name: 'Vienna field guide' }).click();
  const title = page.getByRole('textbox', { name: 'Project title' });
  await title.fill('Coffee');
  await title.press('Backspace');
  await expect(page.getByRole('button', { name: 'Select Coffee stop' })).toBeVisible();
});

test('route radios and Shape tabs rove with arrow keys without clipping mobile labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');

  await page.getByRole('button', { name: 'Route (R)' }).click();
  const straight = page.getByRole('radio', { name: 'Straight' });
  const arc = page.getByRole('radio', { name: 'Arc', exact: true });
  await straight.focus();
  await straight.press('ArrowRight');
  await expect(arc).toBeFocused();
  await expect(arc).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Cancel route' }).click();

  await page.getByRole('button', { name: 'Area (S)' }).click();
  const administrative = page.getByRole('tab', { name: 'Find administrative area' });
  const draw = page.getByRole('tab', { name: 'Draw custom area' });
  await administrative.focus();
  await administrative.press('ArrowRight');
  await expect(draw).toBeFocused();
  await expect(draw).toHaveAttribute('aria-selected', 'true');
  const metrics = await draw.evaluate((element) => {
    const tablist = element.parentElement!;
    const style = getComputedStyle(tablist);
    return {
      height: element.getBoundingClientRect().height,
      overflow: style.overflow,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(metrics.height).toBeGreaterThanOrEqual(40);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(Math.ceil(metrics.height));
  expect(metrics.overflow).not.toBe('hidden');
});

import { expect, test } from '@playwright/test';
import { savedAdmissionRecord } from './project-admission-support';
import { beginDrag, documentAt, evidence, expectActive, finishDrag, ids, openSearch, row, search, start, status, tabCounts } from './layer-navigation-support';

test.setTimeout(60_000);

test('300 POIs have four row Tab stops, five Tabs from filter to exit, and keyboard navigation does not save or select', async ({ page }, info) => {
  await start(page, 300);
  const before = await documentAt(page, info, '300-before');
  const stored = await savedAdmissionRecord(page);
  expect(await tabCounts(page)).toMatchObject({ rowButtonCount: 1204, rowTabStops: 4, sidebarTabStops: 7 });
  await openSearch(page);
  const traversal: string[] = [];
  for (const name of ['Hide Place 001', 'Select Place 001', 'Lock Place 001', 'Reorder Place 001']) {
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
    traversal.push(name);
  }
  await page.keyboard.press('Tab');
  expect(await page.locator('#layers-panel').evaluate((panel) => panel.contains(document.activeElement))).toBe(false);
  traversal.push(await page.evaluate(() => {
    const focused = document.activeElement;
    return focused ? focused.getAttribute('aria-label') ?? focused.tagName : 'none';
  }));

  await search(page).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await expect(row(page, 'basemap')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(row(page, 'place-300')).toBeFocused();
  expect(await page.locator('#layers-list').evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-selected-layer', '');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  expect(await documentAt(page, info, '300-navigated')).toEqual(before);
  expect(await savedAdmissionRecord(page)).toEqual(stored);
  await evidence(page, info, '300-tab-traversal', { traversal, before, after: before, storedRevision: stored.revision });

  await search(page).fill('pLaCe 300');
  await expect(status(page)).toContainText('1 of 301 layers');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Place 300', exact: true })).toBeVisible();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-selected-layer', 'place-300');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await evidence(page, info, '300-find-select', {});
});

test('filtered and unfiltered native drags and Alt+Arrow use canonical destinations with exact Undo/Redo', async ({ page }, info) => {
  await start(page);
  const before = await documentAt(page, info, 'order-before');
  await openSearch(page);
  await search(page).fill('keep');
  await beginDrag(page, 'Keep A', 'Keep C');
  await finishDrag(page);
  const after = await documentAt(page, info, 'order-filtered-drag');
  expect(ids(after)).toEqual(['place-2', 'place-3', 'place-4', 'place-5', 'place-1', 'basemap']);
  expect(after.camera).toEqual(before.camera);
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-map-layer-order', 'place-2,place-3,place-4,place-5,place-1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await documentAt(page, info, 'order-undo')).toEqual(before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await documentAt(page, info, 'order-redo')).toEqual(after);
  await page.getByRole('button', { name: 'Reorder Keep A', exact: true }).press('Alt+ArrowUp');
  const keyboard = await documentAt(page, info, 'order-filtered-keyboard');
  expect(ids(keyboard)).toEqual(['place-2', 'place-3', 'place-4', 'place-1', 'place-5', 'basemap']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Clear layer filter' }).click();
  await beginDrag(page, 'Keep A', 'Keep B');
  await finishDrag(page);
  const unfiltered = await documentAt(page, info, 'order-unfiltered-drag');
  expect(ids(unfiltered)).toEqual(['place-2', 'place-1', 'place-3', 'place-4', 'place-5', 'basemap']);
  await page.getByRole('button', { name: 'Reorder Keep A', exact: true }).press('Alt+ArrowUp');
  const unfilteredKeyboard = await documentAt(page, info, 'order-unfiltered-keyboard');
  expect(ids(unfilteredKeyboard)).toEqual(ids(before));
  await expect(page.getByRole('button', { name: 'Reorder Paper basemap', exact: true })).toBeDisabled();
  await evidence(page, info, 'reorder-parity', { before, after, keyboard, unfiltered, unfilteredKeyboard });
});

test('changing the filter retires a real pointer drag and its trailing release without poisoning the next drag', async ({ page }, info) => {
  await start(page);
  const before = await documentAt(page, info, 'cancel-before');
  await openSearch(page);
  await search(page).fill('keep');
  await beginDrag(page, 'Keep A', 'Keep C');
  await search(page).fill('other');
  await expect(status(page)).toContainText('reorder canceled: the filter changed');
  await finishDrag(page);
  await expect(search(page)).toBeFocused();
  expect(await documentAt(page, info, 'cancel-filter')).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await search(page).fill('keep');
  await beginDrag(page, 'Keep A', 'Keep C');
  await finishDrag(page);
  const after = await documentAt(page, info, 'cancel-next-drag');
  expect(ids(after)).toEqual(['place-2', 'place-3', 'place-4', 'place-5', 'place-1', 'basemap']);
  await evidence(page, info, 'filter-drag-retirement', { before, after });
});

test('keyboard drag cancellation preserves filter focus, then a fresh Space/Arrow/Space drag works', async ({ page }, info) => {
  await start(page);
  const before = await documentAt(page, info, 'keyboard-before');
  await openSearch(page);
  await search(page).fill('keep');
  const handle = page.getByRole('button', { name: 'Reorder Keep A', exact: true });
  await handle.press('Space');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await search(page).fill('KEEP');
  await expect(status(page)).toContainText('reorder canceled: the filter changed');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
  await page.waitForTimeout(400); // Covers the installed engine's delayed keyboard-focus restoration.
  await expect(search(page)).toBeFocused();
  expect(await documentAt(page, info, 'keyboard-canceled')).toEqual(before);
  await handle.press('Space');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
  const after = await documentAt(page, info, 'keyboard-completed');
  expect(ids(after)).toEqual(['place-2', 'place-3', 'place-1', 'place-4', 'place-5', 'basemap']);
  await evidence(page, info, 'keyboard-drag', { before, after });
});

test('replacing the document during a native drag retires the old epoch and trailing pointer release', async ({ page }, info) => {
  await start(page);
  await openSearch(page);
  await search(page).fill('keep');
  await beginDrag(page, 'Keep A', 'Keep C');
  await page.getByRole('button', { name: 'Project', exact: true }).press('Enter');
  await page.getByRole('menuitem', { name: 'New project', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Start new project', exact: true }).press('Enter');
  await expect(search(page)).toHaveValue('');
  await expect(status(page)).toContainText('reorder canceled: the project changed');
  await finishDrag(page);
  await expect(page.locator('.layer-tree > li')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  const after = await documentAt(page, info, 'epoch-drag');
  expect(ids(after)).toEqual(['basemap']);
  await evidence(page, info, 'epoch-drag', { after });
});

test('case-insensitive duplicate long names remain distinct and keyboard-addressable by stable layer ID', async ({ page }, info) => {
  await start(page);
  const name = 'North promenade and station '.repeat(3).trim();
  for (const [id, value] of [['place-1', name], ['place-5', name.toUpperCase()]]) {
    await row(page, id).click();
    await page.getByRole('textbox', { name: 'Layer name', exact: true }).fill(value);
    await page.getByRole('spinbutton', { name: 'Layer opacity', exact: true }).focus();
  }
  const before = await documentAt(page, info, 'long-names-before');
  await openSearch(page);
  await search(page).fill('nOrTh pRoMeNaDe');
  await expect(status(page)).toContainText('2 of 6 layers');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await expect(row(page, 'place-1')).toBeFocused();
  await page.keyboard.press('End');
  await expect(row(page, 'place-5')).toBeFocused();
  await expect(row(page, 'place-1')).toBeVisible();
  const overflow = await row(page, 'place-1').locator('span').evaluate((span) => ({
    clipped: span.scrollWidth > span.clientWidth,
    ellipsis: getComputedStyle(span).textOverflow,
  }));
  expect(overflow).toEqual({ clipped: true, ellipsis: 'ellipsis' });
  expect(await documentAt(page, info, 'long-names-navigated')).toEqual(before);
  await row(page, 'place-5').press('Enter');
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-selected-layer', 'place-5');
  await evidence(page, info, 'long-names', { ids: ['place-1', 'place-5'], before, overflow });
});

for (const change of ['name', 'geometry'] as const) {
  test(`a ${change} edit during native drag cancels stale mapping and keeps Properties focus`, async ({ page }, info) => {
    await start(page);
    await row(page, 'place-3').click();
    const before = await documentAt(page, info, `stale-${change}-before`);
    await openSearch(page);
    await search(page).fill('keep');
    await beginDrag(page, 'Keep A', 'Keep C');
    const field = page.getByRole('textbox', { name: change === 'name' ? 'Layer name' : 'POI longitude', exact: true });
    await field.fill(change === 'name' ? 'Renamed B' : '16.37');
    const next = page.getByRole('spinbutton', { name: 'Layer opacity', exact: true });
    await next.focus();
    await expect(status(page)).toContainText('reorder canceled: the layers changed');
    await finishDrag(page);
    await expect(next).toBeFocused();
    const after = await documentAt(page, info, `stale-${change}-after`);
    expect(ids(after)).toEqual(ids(before));
    const expected = structuredClone(before);
    if (change === 'name') expected.layers[2].name = 'Renamed B';
    else expected.layers[2].geometry = { type: 'Point', coordinates: [16.37, 48.2] };
    expect(after).toEqual(expected);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await documentAt(page, info, `stale-${change}-undo`)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await evidence(page, info, `stale-${change}`, { before, after });
  });
}

test('actions never select incidentally; filtered deletion and history repair focus without stealing a Properties edit', async ({ page }, info) => {
  await start(page);
  await openSearch(page);
  await search(page).fill('keep');
  await row(page, 'place-3').click();
  await page.getByRole('button', { name: 'Hide Keep C', exact: true }).click();
  await page.getByRole('button', { name: 'Lock Keep C', exact: true }).click();
  await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-selected-layer', 'place-3');
  await expectActive(page, 'place-5');
  await page.keyboard.press('Delete');
  await expect(row(page, 'place-3')).toBeVisible();
  await expect(status(page)).toContainText('Select this layer before deleting');
  await row(page, 'place-3').click();
  await page.keyboard.press('Delete');
  await expect(row(page, 'place-3')).toHaveCount(0);
  await expect(row(page, 'place-5')).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(row(page, 'place-3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeFocused();
  await expectActive(page, 'place-5');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(row(page, 'place-3')).toHaveCount(0);
  await row(page, 'place-5').click();
  await page.getByRole('textbox', { name: 'Layer name', exact: true }).fill('Renamed C');
  const opacity = page.getByRole('spinbutton', { name: 'Layer opacity', exact: true });
  await opacity.focus();
  await expect(row(page, 'place-5')).toHaveCount(0);
  await expect(opacity).toBeFocused();
  await expectActive(page, 'place-1');
  const after = await documentAt(page, info, 'focus-actions');
  expect(after.layers.find((layer) => layer.id === 'place-5')).toMatchObject({ name: 'Renamed C', visible: false, locked: true });
  await evidence(page, info, 'focus-actions', { after });
});

test('empty-state clearing, desktop collapse and New project have coherent local filter ownership', async ({ page }, info) => {
  await start(page);
  const stored = await savedAdmissionRecord(page);
  await openSearch(page);
  await search(page).fill('no matching name');
  await expect(status(page)).toContainText('0 of 6 layers');
  await expect(page.getByText('No matching layers. Change or clear the filter.')).toBeVisible();
  await page.getByRole('button', { name: 'Collapse layers', exact: true }).click();
  await expect(search(page)).not.toBeVisible();
  await page.getByRole('button', { name: 'Expand layers', exact: true }).click();
  await expect(search(page)).toHaveValue('no matching name');
  expect(await savedAdmissionRecord(page)).toEqual(stored);
  await page.getByRole('button', { name: 'Clear layer filter' }).click();
  await expect(search(page)).toBeFocused();
  await expect(page.locator('.layer-tree > li')).toHaveCount(6);
  await search(page).fill('no matching name');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'Start new project', exact: true }).click();
  await expect(search(page)).toHaveValue('');
  await expect(page.locator('.layer-tree > li')).toHaveCount(1);
  await expect(status(page)).toBeEmpty();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await evidence(page, info, 'new-document-reset', { beforeRevision: stored.revision, after: await documentAt(page, info, 'new-document') });
});

for (const width of [320, 390]) {
  test.describe(`mobile ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
    test('300 layers retain bounded trap, direct Properties, touch sizes and Escape preferences', async ({ page }, info) => {
      await start(page, 300);
      await page.getByRole('button', { name: 'Open layers' }).tap();
      await expect(page.getByRole('button', { name: 'Close layers' })).toBeFocused();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await openSearch(page);
      await search(page).fill('Place');
      expect(await tabCounts(page)).toMatchObject({ rowTabStops: 4, sidebarTabStops: 9 });
      const clear = page.getByRole('button', { name: 'Clear layer filter' });
      expect((await clear.boundingBox())!.width).toBeGreaterThanOrEqual(44);
      expect((await clear.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await search(page).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: 'Layer keyboard shortcuts' }).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('button', { name: 'Reorder Place 001', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Layer keyboard shortcuts' })).toBeFocused();
      await search(page).fill('pLaCe 300');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Properties sidebar' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Place 300', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close properties' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open properties' })).toBeFocused();
      await page.getByRole('button', { name: 'Open layers' }).tap();
      await expect(search(page)).toHaveValue('pLaCe 300');
      await search(page).focus();
      await page.keyboard.press('Escape');
      await expect(search(page)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Search layers', exact: true })).toBeFocused();
      await expect(page.getByRole('dialog', { name: 'Layers sidebar' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Open layers' })).toBeFocused();
      await page.getByRole('button', { name: 'Open layers' }).tap();
      await openSearch(page);
      await expect(search(page)).toHaveValue('');
      await expect(status(page)).toBeEmpty();
      await page.keyboard.press('ArrowDown');
      await expect(row(page, 'place-300')).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await evidence(page, info, `mobile-${width}`, {});
    });
  });
}

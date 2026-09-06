import { expect, test, type Page } from '@playwright/test';
import { documentAt, evidence, ids, row, search, start, status } from './layer-navigation-support';
import { savedAdmissionRecord } from './project-admission-support';

test.setTimeout(60_000);

declare global {
  interface Window {
    layerNavigationFocusTrace: string[];
    layerNavigationAnimations: Array<{ duration: number | string | undefined; target: string; outcome: 'running' | 'finished' | 'canceled' }>;
  }
}

async function trackFocus(page: Page) {
  await page.evaluate(() => {
    Object.assign(window, { layerNavigationFocusTrace: [] });
    document.addEventListener('focusin', (event) => {
      if (event.target instanceof HTMLElement) window.layerNavigationFocusTrace.push(event.target.getAttribute('aria-label') ?? event.target.tagName);
    });
  });
}

async function lift(page: Page, name: string) {
  await page.getByRole('button', { name: `Reorder ${name}`, exact: true }).press('Space');
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(1);
}

for (const key of ['Delete', 'Backspace']) {
  test(`${key} cannot delete a different selected layer while Keep B owns a native keyboard drag`, async ({ page }, info) => {
    await start(page);
    await row(page, 'place-1').click();
    const before = await documentAt(page, info, `review-${key}-before`);
    const stored = await savedAdmissionRecord(page);
    await lift(page, 'Keep B');
    await page.keyboard.press(key);
    await expect(row(page, 'place-1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByTestId('map-canvas')).toHaveAttribute('data-selected-layer', 'place-1');
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled();
    await expect(status(page)).toContainText('Select this layer before deleting');
    expect(await documentAt(page, info, `review-${key}-unchanged`)).toEqual(before);
    expect(await savedAdmissionRecord(page)).toEqual(stored);
    await page.keyboard.press('Escape');
    await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
    await lift(page, 'Keep B');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
    const after = await documentAt(page, info, `review-${key}-next-drag`);
    expect(ids(after)).toEqual(['place-1', 'place-2', 'place-4', 'place-3', 'place-5', 'basemap']);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await documentAt(page, info, `review-${key}-undo`)).toEqual(before);
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    expect(await documentAt(page, info, `review-${key}-redo`)).toEqual(after);
    await evidence(page, info, `review-${key}`, { before, after, storedRevision: stored.revision });
  });
}

for (const end of ['Space', 'Escape']) {
  for (const target of ['filter', 'Properties']) {
    test(`${end} followed immediately by ${target} focus cannot restore the old drag handle`, async ({ page }, info) => {
      await start(page);
      await row(page, 'place-1').click();
      const before = await documentAt(page, info, `review-${end}-${target}-before`);
      await trackFocus(page);
      await lift(page, 'Keep A');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press(end);
      const destination = target === 'filter' ? search(page) : page.getByRole('textbox', { name: 'Layer name', exact: true });
      if (target === 'filter') await destination.fill('Keep');
      else await destination.focus();
      await expect(destination).toBeFocused();
      // Observe beyond the installed engine's 250ms animation and queued focus callback.
      await page.waitForTimeout(450);
      await expect(destination).toBeFocused();
      await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
      const focusTrace = await page.evaluate(() => window.layerNavigationFocusTrace);
      const focusName = target === 'filter' ? 'Filter layers by name' : 'Layer name';
      expect(focusTrace.slice(focusTrace.indexOf(focusName) + 1)).not.toContain('Reorder Keep A');
      const after = await documentAt(page, info, `review-${end}-${target}-after`);
      expect(ids(after)).toEqual(end === 'Space' ? ['place-2', 'place-1', 'place-3', 'place-4', 'place-5', 'basemap'] : ids(before));
      if (end === 'Escape') {
        expect(after).toEqual(before);
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
      } else {
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        expect(await documentAt(page, info, `review-${end}-${target}-undo`)).toEqual(before);
        await page.getByRole('button', { name: 'Redo', exact: true }).click();
        expect(await documentAt(page, info, `review-${end}-${target}-redo`)).toEqual(after);
      }
      await lift(page, 'Keep A');
      await page.keyboard.press('Escape');
      await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
      await evidence(page, info, `review-${end}-${target}`, { before, after, focusTrace });
    });
  }
}

test('uninterrupted keyboard drops still animate and restore their own handle at actual completion', async ({ page }, info) => {
  await start(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    Object.assign(window, { layerNavigationAnimations: [] });
    Element.prototype.animate = new Proxy(Element.prototype.animate, {
      apply(target, element: Element, args: Parameters<Element['animate']>) {
        const options = args[1];
        const duration = typeof options === 'number' ? options : options?.duration;
        const animation: Animation = Reflect.apply(target, element, args);
        const entry: Window['layerNavigationAnimations'][number] = {
          duration: typeof duration === 'number' || duration === undefined ? duration : String(duration),
          target: element instanceof HTMLElement && element.dataset.dndOverlay !== undefined ? 'layer-drop-overlay' : element.className,
          outcome: 'running',
        };
        window.layerNavigationAnimations.push(entry);
        void animation.finished.then(() => { entry.outcome = 'finished'; }).catch(() => { entry.outcome = 'canceled'; });
        return animation;
      },
    });
  });
  await lift(page, 'Keep A');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => window.layerNavigationAnimations)).toContainEqual({ duration: 250, target: 'layer-drop-overlay', outcome: 'finished' });
  await expect(page.locator('.layer-tree .is-dragging')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reorder Keep A', exact: true })).toBeFocused();
  const after = await documentAt(page, info, 'review-native-completion');
  expect(ids(after)).toEqual(['place-2', 'place-1', 'place-3', 'place-4', 'place-5', 'basemap']);
  await evidence(page, info, 'review-native-completion', { after, animations: await page.evaluate(() => window.layerNavigationAnimations) });
});

test('document replacement immediately after a keyboard drop retires the old completion', async ({ page }, info) => {
  await start(page);
  await lift(page, 'Keep A');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Project', exact: true }).press('Enter');
  await page.getByRole('menuitem', { name: 'New project', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Start new project', exact: true }).press('Enter');
  await page.waitForTimeout(450);
  await expect(page.getByRole('button', { name: 'Project', exact: true })).toBeFocused();
  await expect(search(page)).toHaveValue('');
  await expect(page.locator('.layer-tree > li')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  const after = await documentAt(page, info, 'review-completion-epoch');
  expect(ids(after)).toEqual(['basemap']);
  await evidence(page, info, 'review-completion-epoch', { after });
});

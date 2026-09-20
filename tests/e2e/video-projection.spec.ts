import { expect, test } from '@playwright/test';

for (const pitch of [0, 30, 60]) {
  for (const offset of [false, true]) {
    test(`preserves pitched map projection at ${pitch} degrees with ${offset ? 'offset' : 'centered'} print frame`, async ({ page }) => {
      await page.route('**/video-projection-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Video perspective regression</title>' }));
      await page.goto('/video-projection-harness');
      const evidence = await page.evaluate(async ({ pitch, offset }) => {
        const path = '/tests/e2e/video-projection-fixture.ts';
        const { pitchedVideoProjectionEvidence } = await import(path) as typeof import('./video-projection-fixture');
        return pitchedVideoProjectionEvidence(pitch, offset);
      }, { pitch, offset });
      expect(Math.max(...evidence.errors)).toBeLessThan(0.05);
      expect(evidence.output).toEqual({ width: evidence.expected.width, height: evidence.expected.height });
      expect(evidence.color).toEqual([18, 52, 86, 255]);
      expect(evidence.pitch).toBe(pitch);
      expect(evidence.bearing).toBe(115);
      expect(evidence.unchanged).toBe(true);
      expect(evidence.sourceMoves).toBe(0);
      await expect(page.locator('[data-video-export-renderer]')).toHaveCount(0);
    });
  }
}

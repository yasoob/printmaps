import { readFileSync } from 'node:fs';

const inspectorDisclosureSource = readFileSync('tests/e2e/inspector-disclosure.spec.ts', 'utf8');
const evidencePath = 'docs/screenshots/route-advanced-disclosure-20260826.png';

describe('browser evidence discipline', () => {
  it('writes the route disclosure evidence only from Chromium', () => {
    const writers = inspectorDisclosureSource.match(
      /(?:if \(testInfo\.project\.name === 'chromium'\) )?await page\.screenshot\(\{[^\n]*path: 'docs\/screenshots\/route-advanced-disclosure-20260826\.png'[^\n]*\}\);/g,
    ) ?? [];

    expect(inspectorDisclosureSource.split(`path: '${evidencePath}'`)).toHaveLength(2);
    expect(writers).toEqual([
      "if (testInfo.project.name === 'chromium') await page.screenshot({ animations: 'disabled', path: 'docs/screenshots/route-advanced-disclosure-20260826.png' });",
    ]);
  });
});

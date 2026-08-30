import { expect, test } from "@playwright/test";

test("auto-hides route settings while preserving map drawing", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 574, height: 844 });
  await page.goto("./");
  const mapReady = page.locator('[data-map-ready="true"]');
  const mapFallback = page.getByText("Map preview unavailable");
  await expect(mapReady.or(mapFallback)).toBeVisible({ timeout: 20_000 });
  test.skip(await mapFallback.isVisible(), "This browser fixture has no WebGL 2 renderer.");

  await page.getByRole("button", { name: "Route (R)" }).click();
  const panel = page.locator(".route-authoring-panel");
  await expect(panel).toHaveAttribute("data-mobile-expanded", "true");
  await expect(page.getByRole("button", { name: "Show route settings" }))
    .toHaveCount(0);
  await expect(page.getByRole("button", { name: /Draw on map/i }))
    .toHaveCount(0);
  expect(await panel.evaluate((element) => getComputedStyle(element).maxHeight))
    .toBe("none");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-route-settings.png"),
  });

  const canvas = page.locator(".maplibregl-canvas");
  const canvasBox = await canvas.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  const point = {
    x: canvasBox!.width / 2,
    y: panelBox!.y - canvasBox!.y - 24,
  };
  await canvas.click({ position: point });

  await expect(page.getByRole("status", { name: "Route drawing status" }))
    .toContainText("1 point");
  await expect(panel).toHaveAttribute("data-mobile-expanded", "false");
  const settings = page.getByRole("button", { name: "Show route settings" });
  await expect(settings).toBeVisible();
  expect(await settings.evaluate((element) => getComputedStyle(element).borderWidth))
    .toBe("0px");
  const minimizedStatusBox = await page
    .getByRole("status", { name: "Route drawing status" })
    .boundingBox();
  expect(minimizedStatusBox?.width).toBeLessThanOrEqual(1);
  expect(minimizedStatusBox?.height).toBeLessThanOrEqual(1);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("mobile-route-minimized.png"),
  });

  await settings.click();
  await expect(panel).toHaveAttribute("data-mobile-expanded", "true");
  const reopenedBox = await panel.boundingBox();
  expect(reopenedBox).not.toBeNull();
  await canvas.click({
    position: {
      x: canvasBox!.width * 0.6,
      y: reopenedBox!.y - canvasBox!.y - 24,
    },
  });
  await expect(panel).toHaveAttribute("data-mobile-expanded", "false");
  await expect(page.getByRole("status", { name: "Route drawing status" }))
    .toContainText("2 points");

  await page.getByRole("button", { name: "Finish route" }).click();
  await expect(page.getByTestId("map-canvas"))
    .toHaveAttribute("data-map-layer-order", /route-02/);
});

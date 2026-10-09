import { expect, test } from "@playwright/test";
test("video movil", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const video = page.locator('video:has(source[src="/rfc-metalmecanica.mp4"])');
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeVisible();
  await expect(video.locator("source")).toHaveAttribute("src", "/rfc-metalmecanica.mp4");
  await page.waitForTimeout(1200);
  expect(await video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
  await expect(video).not.toHaveAttribute("poster", /.+/);
});

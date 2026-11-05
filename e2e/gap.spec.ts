import { expect, test } from "@playwright/test";

// 시연 인물로 리포트까지 가서 격차 칸과 모바일 넘침을 본다. AI 안 부름.
test("리포트에 필요한 것과 내 격차가 나온다", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 180_000 });
  await page.goto("/report");
  const dev = page.getByTestId("gap-developer");
  await expect(dev).toBeVisible({ timeout: 120_000 });
  await expect(dev.getByText("이미 가진 것")).toBeVisible();
  await expect(dev.getByText("공고 집계 없음(기관 키 필요)").first()).toBeVisible();
  await expect(dev.getByText(/시뮬레이션에서 \+\d+%p/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("gap-civil-servant").getByText("국어")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await dev.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await dev.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-1280.png" });
});

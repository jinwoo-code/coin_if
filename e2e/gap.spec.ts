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
  // 능력 묶음 답 → 격차 판정이 바뀐다
  const skills = page.getByTestId("skills-developer");
  const firstGroup = skills.locator("fieldset").first();
  await firstGroup.getByRole("button", { name: "할 줄 알아요" }).click();
  await expect(dev.getByText(/직접 답했어요/).first()).toBeVisible();
  // 공부 시간 효과 문구
  await expect(page.getByTestId("gap-civil-servant").getByText(/하루 공부를 2시간 늘렸을 때/).first()).toBeVisible({ timeout: 60_000 });
  // 시간 초과 → 기간 늘리기
  const plan = page.getByTestId("plan-developer");
  await plan.getByRole("spinbutton", { name: /주당 공부 시간/ }).fill("1");
  await expect(plan.getByText(/주 \d+시간이 필요한데 지금은 1시간이에요/)).toBeVisible();
  await plan.getByRole("button", { name: /기간을 \d+개월로 늘리기/ }).click();
  await expect(plan.getByText(/주 \d+시간이 필요한데/)).toHaveCount(0);
  await plan.getByRole("button", { name: "처음 일정으로" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-1280.png" });
});

test("전공이 다른 진로를 고르면 학과부터라고 알려 준다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.goto("/choose");
  await page.getByRole("searchbox").or(page.getByPlaceholder(/검색|찾/)).first().fill("간호사");
  await page.getByRole("button", { name: /간호사/ }).first().click();
  await expect(page.getByTestId("retrain-note").getByText(/전공이 달라 학과부터 다녀야 해요/)).toBeVisible();
});

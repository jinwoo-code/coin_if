import { expect, test } from "@playwright/test";
import { quickPart, savedProfile, autoOpenReport } from "./helpers";

test.beforeEach(async ({ page }) => autoOpenReport(page));

// 파일럿 링크 → 동의·사전 설문 → 빠르게 검사 → 사후 설문. 키를 비워 AI 안 부름.
test("파일럿: 쓰기 전 설문이 먼저 나오고, 프로필에 붙고, 사후 설문까지 저장된다", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/interview?pilot=1");
  await page.waitForURL(/pilot\/survey\?when=pre/, { timeout: 30_000 });
  await page.screenshot({ path: "test-results/pilot-consent-390.png", fullPage: true });
  await page.getByRole("button", { name: "동의하고 시작" }).click();
  await page.getByRole("radio", { name: "별로 없어요" }).click();
  await page.getByLabel("지금 고려 중인 진로를 적어 주세요.", { exact: false }).fill("개발자, 공무원");
  await page.getByRole("radio", { name: "아니요, 없어요" }).click();
  await page.screenshot({ path: "test-results/pilot-pre-390.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "test-results/pilot-pre-1280.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "다음" }).click();
  await page.waitForURL(/\/interview$/, { timeout: 30_000 });

  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(":pilotPending"))!)!));
  expect(pending.survey.pre.confidence).toBe(2);
  expect(pending.survey.pre.careers).toEqual(["개발자", "공무원"]);
  expect(pending.survey.pre.hasAction).toBe(false);
  expect(pending.survey.pre.usedBefore).toBeUndefined();

  // 다시 초대 링크로 와도 설문을 또 묻지 않는다
  await page.goto("/interview?pilot=1");
  await page.waitForTimeout(800);
  expect(page.url()).toContain("/interview");

  // 빠르게 검사를 끝내면 프로필에 동의·사전 답이 붙는다
  await page.goto("/interview");
  await quickPart(page, "빠르게", 13);
  await page.getByRole("button", { name: "이대로 진로 고르기" }).click({ timeout: 60_000 });
  await page.waitForURL(/\/choose/);
  await expect.poll(() => savedProfile(page).then((x) => x?.pilot?.survey?.pre?.confidence), { timeout: 30_000 }).toBe(2);

  // 리포트를 보면 마무리 설문 링크가 뜬다
  const search = page.getByRole("searchbox").or(page.getByPlaceholder(/검색|찾/)).first();
  for (const name of ["웹 백엔드 개발자", "9급 행정직 공무원"]) {
    await search.fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
  }
  await page.getByRole("button", { name: /2개 진로를 .* 살아보기/ }).click({ timeout: 15_000 });
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 110_000 });
  await page.goto("/report");
  const link = page.getByTestId("pilot-post-link");
  await expect(link).toBeVisible({ timeout: 110_000 });
  await link.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/pilot-link-390.png" });
  await link.click();
  await page.waitForURL(/pilot\/survey\?when=post/);
  await page.getByRole("radio", { name: "꽤 있어요" }).click();
  await page.getByRole("radio", { name: "네, 있어요" }).click();
  await page.getByLabel("판단이 바뀌었나요?", { exact: false }).fill("공무원은 빼기로 했어요");
  await page.screenshot({ path: "test-results/pilot-post-390.png", fullPage: true });
  await page.getByRole("button", { name: "끝내기" }).click();
  await expect(page.getByTestId("pilot-survey-done")).toBeVisible();
  await page.goto("/report");
  const after = await savedProfile(page);
  expect(after.pilot?.survey?.post?.confidence).toBe(4);
  expect(after.pilot?.survey?.post?.hasAction).toBe(true);
  expect(after.pilot?.survey?.changed).toBe("공무원은 빼기로 했어요");
  expect(after.pilot?.survey?.pre?.confidence).toBe(2);
  await page.waitForLoadState("load");
  await expect(page.getByTestId("pilot-post-link")).toHaveCount(0);
});

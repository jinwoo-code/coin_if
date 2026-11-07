// AI 판단이 실패하면 화면에 'AI 판단 실패 → 규칙 계산'이 나온다. 응답 실패(500)와 네트워크 끊김은 가짜로, 틀린 키는 E2E_BAD_KEY=1로 실제 서버를 거쳐.
import { expect, test } from "@playwright/test";
import { openTimeline, SIM_WAIT, openDemo, REMOTE } from "./helpers";

const cases = process.env.E2E_BAD_KEY ? (["틀린 키"] as const) : (["응답 실패", "네트워크 끊김"] as const);
for (const how of cases) {
  test(`AI 판단 ${how} 표시`, async ({ page }) => {
    test.setTimeout(REMOTE ? 600_000 : 240_000);
    let calls = 0;
    await page.route("**/api/judge", (route) => {
      calls++;
      if (how === "틀린 키") return route.continue();
      return how === "응답 실패" ? route.fulfill({ status: 500, json: { error: "x" } }) : route.abort("failed");
    });
    await page.goto("/");
    await openDemo(page);
    await expect(page).toHaveURL(/\/choose|\/simulate/, { timeout: 30_000 });
    if (page.url().includes("/choose")) await page.getByRole("button", { name: /살아보기|시작/ }).last().click();
    await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });

    const failed = page.getByText("AI 판단 실패 → 규칙 계산").first();
    await expect.poll(() => calls, { timeout: 60_000 }).toBeGreaterThan(0);
    // 시뮬레이션이 끝날 때까지 기다린 뒤(무료 키 배포본은 몇 분 걸림) 큰 갈림길 장면을 찾는다
    await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: SIM_WAIT });
    await expect(page.locator("details").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first()).toBeAttached({ timeout: 30_000 });
    await openTimeline(page);
    await page.locator("details:not([data-testid])").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first().locator("summary").click();
    await expect(failed).toBeVisible();
    await failed.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/judge-fail-${how}.png` });
  });
}

// 좁은 칸에서 '나라면 이렇게 안 해' 버튼이 카드 끝에 붙지 않는다(진로 3개를 나란히, 320·390px)
for (const width of [320, 390]) {
  test(`고치기 버튼 여백 ${width}px`, async ({ page }) => {
    test.setTimeout(REMOTE ? 600_000 : 240_000); // 진로 3개라 배포 사이트(무료 키, 하나씩 호출)는 2분을 넘긴다
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await openDemo(page);
    await expect(page).toHaveURL(/\/simulate/);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("cr:v10:selection")!);
      localStorage.setItem("cr:v10:selection", JSON.stringify({ ...s, worldIds: ["developer", "civil-servant", "marketer"] }));
    });
    await page.reload();
    const btn = page.getByRole("button", { name: "나라면 이렇게 안 해" }).first();
    await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: SIM_WAIT });
    await openTimeline(page);
    await expect(btn).toBeAttached();
    const gap = await btn.evaluate((el) => {
      let card = el.parentElement!;
      while (card && parseFloat(getComputedStyle(card).borderLeftWidth) === 0) card = card.parentElement!;
      return card.getBoundingClientRect().right - el.getBoundingClientRect().right;
    });
    expect(gap).toBeGreaterThanOrEqual(8);
    const bad = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(bad).toBeLessThanOrEqual(0);
  });
}

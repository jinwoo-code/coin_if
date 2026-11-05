// AI 판단이 실패하면 화면에 'AI 판단 실패 → 규칙 계산'이 나온다. 응답 실패(500)와 네트워크 끊김은 가짜로, 틀린 키는 E2E_BAD_KEY=1로 실제 서버를 거쳐.
import { expect, test } from "@playwright/test";

const cases = process.env.E2E_BAD_KEY ? (["틀린 키"] as const) : (["응답 실패", "네트워크 끊김"] as const);
for (const how of cases) {
  test(`AI 판단 ${how} 표시`, async ({ page }) => {
    let calls = 0;
    await page.route("**/api/judge", (route) => {
      calls++;
      if (how === "틀린 키") return route.continue();
      return how === "응답 실패" ? route.fulfill({ status: 500, json: { error: "x" } }) : route.abort("failed");
    });
    await page.goto("/");
    await page.getByRole("button", { name: /예시 인물로 바로 보기/ }).click();
    await expect(page).toHaveURL(/\/choose|\/simulate/, { timeout: 30_000 });
    if (page.url().includes("/choose")) await page.getByRole("button", { name: /살아보기|시작/ }).last().click();
    await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });

    const failed = page.getByText("AI 판단 실패 → 규칙 계산").first();
    await expect.poll(() => calls, { timeout: 60_000 }).toBeGreaterThan(0);
    // 큰 갈림길 장면이 나올 때까지 기다렸다가 펼친다
    await expect(page.locator("details").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first()).toBeAttached({ timeout: 110_000 });
    await page.locator("details").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first().locator("summary").click();
    await expect(failed).toBeVisible();
    await failed.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/judge-fail-${how}.png` });
  });
}

// 좁은 칸에서 '나라면 이렇게 안 해' 버튼이 카드 끝에 붙지 않는다(진로 3개를 나란히, 320·390px)
for (const width of [320, 390]) {
  test(`고치기 버튼 여백 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("button", { name: /예시 인물로 바로 보기/ }).click();
    await expect(page).toHaveURL(/\/simulate/);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("cr:v9:selection")!);
      localStorage.setItem("cr:v9:selection", JSON.stringify({ ...s, worldIds: ["developer", "civil-servant", "marketer"] }));
    });
    await page.reload();
    const btn = page.getByRole("button", { name: "나라면 이렇게 안 해" }).first();
    await expect(btn).toBeAttached({ timeout: 110_000 });
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

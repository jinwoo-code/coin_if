import { expect, test } from "@playwright/test";
import { REMOTE, SIM_WAIT, autoOpenReport, openDemo } from "./helpers";

test.beforeEach(async ({ page }) => autoOpenReport(page));

// 끝맺음 흐름: 시연 인물 → 프리미엄 생성 → 계획 수정 → 다시 살아 보기 → 공유.
// 공유 링크를 실제로 여는 건 0007이 있어야 해서 배포 사이트에서는 E2E_SHARE_DB=1일 때만 한다.
const CASES = [
  { id: "developer", name: "개발자", button: "developer" as const, weekly: "60" },
  { id: "nurse", name: "간호사", button: "nurse" as const, weekly: "30" },
  { id: "civil-servant", name: "9급", button: "developer" as const, weekly: "71" },
];

for (const c of CASES) {
  test(`${c.name}: 프리미엄 생성 → 계획 수정 → 다시 살아 보기 → 공유`, async ({ page, context }) => {
    test.setTimeout(REMOTE ? 900_000 : 300_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await openDemo(page, c.button);
    await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
    await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: SIM_WAIT });
    await page.goto("/report");

    // 프리미엄 생성(시연 인물은 토큰 없이)
    const open = page.getByRole("button", { name: /프리미엄 리포트 열기/ });
    await expect(open).toBeEnabled({ timeout: SIM_WAIT });
    await open.click();
    await expect(open).toHaveCount(0, { timeout: SIM_WAIT });

    // 계획 수정
    const plan = page.getByTestId(`plan-${c.id}`);
    await expect(plan).toBeVisible({ timeout: 60_000 });
    await plan.getByRole("spinbutton", { name: "주당 쓸 수 있는 시간" }).fill(c.weekly);

    // 다시 살아 보기
    const rerun = page.getByTestId(`plan-rerun-${c.id}`);
    await rerun.getByRole("button", { name: "다시 살아 보기" }).click();
    const result = rerun.getByText(/이 계획대로 하면 .+ 안에/);
    await expect(result).toBeVisible({ timeout: 120_000 });
    console.log(`[${c.name}] ${(await rerun.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);

    // 넘침 없음 + 스크린샷
    await page.waitForLoadState("load");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await rerun.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/three-${c.id}-390.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await rerun.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/three-${c.id}-1280.png` });

    // 공유: 미리 보기와 PDF 화면은 늘, 링크는 0007이 있을 때만
    await page.getByRole("button", { name: "상담사에게 공유" }).click();
    const panel = page.getByTestId("share-panel");
    await expect(panel.getByText("들어가지 않는 것")).toBeVisible();
    const make = panel.getByRole("button", { name: /읽기 전용 링크 만들기/ });
    await expect(make).toBeEnabled({ timeout: 120_000 });
    const [print] = await Promise.all([context.waitForEvent("page"), panel.getByRole("button", { name: "PDF 내려받기" }).click()]);
    await expect(print.getByTestId("ai-notice")).toHaveText("AI로 만든 리포트입니다");
    await print.close();

    if (REMOTE && !process.env.E2E_SHARE_DB) return;
    await make.click();
    const link = page.getByTestId("share-links").getByRole("link").first();
    await expect(link).toBeVisible({ timeout: 30_000 });
    const viewer = await context.browser()!.newContext();
    const other = await viewer.newPage();
    await other.goto((await link.textContent())!);
    await expect(other.getByTestId("ai-notice")).toHaveText("AI로 만든 리포트입니다");
    await viewer.close();
  });
}

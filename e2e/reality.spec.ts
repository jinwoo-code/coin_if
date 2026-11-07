// '지금 현실에서는': 채용정보가 개인회원 키로 막혀 있을 때 공고 대신 기관 키 안내만 나온다. 고용24 응답은 가짜(실제 키와 상관없이 같은 결과).
import { expect, test } from "@playwright/test";
import { REMOTE, SIM_WAIT, openDemo } from "./helpers";

const base = { available: true, keyword: "개발자", regionLabel: "전국", duties: [{ name: "응용SW 개발", def: "" }], ncs: "응용SW", training: null, at: "2026-11-05", wanted: null };

for (const [name, body, shown] of [
  ["공고 잠김", { ...base, wantedLocked: true }, true],
  ["시험형(공고 안 찾음)", { ...base, wantedLocked: false }, false],
] as const) {
  test(`지금 현실에서는: ${name}`, async ({ page }) => {
    test.setTimeout(REMOTE ? 900_000 : 120_000);
    await page.route("**/api/live?*", (r) => r.fulfill({ json: body }));
    await page.goto("/");
    await openDemo(page);
    await page.getByRole("link", { name: /다른 세계선 보기/ }).click({ timeout: SIM_WAIT });
    await expect(page.getByText("지금 현실에서는")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("채용 공고는 기관 키 연결 후 보여 드려요")).toHaveCount(shown ? 1 : 0);
    await expect(page.getByText(/고용24에 연결하지 못했어요/)).toHaveCount(0);
  });
}

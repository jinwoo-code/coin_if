// 예시 인물 두 명이 시연용 체크인을 끝까지 돌고, 전후로 바뀐 것을 한 화면에서 본다. 큰 갈림길의 고치기 버튼이 접히지 않는 것도.
import { expect, test } from "@playwright/test";
import { SIM_WAIT, openDemo } from "./helpers";

for (const [button, name, worlds] of [
  ["developer", "김민준", ["developer", "civil-servant"]],
  ["nurse", "이서연", ["nurse", "civil-servant"]],
] as const) {
  test(`${name}: 고친 선택 → 시연용 체크인 → 전후 비교`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto("/");
    await openDemo(page, button);
    await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: SIM_WAIT });

    // 큰 갈림길 고치기: 자세히를 펼치지 않아도 연도만 펼치면 보인다. 가장 흔한 길에 큰 갈림길이 없는 진로면 다음 진로에서 찾는다.
    const years = page.getByTestId("year");
    const fix = page.getByRole("button", { name: "나라면 이렇게 안 해" });
    let found = false;
    for (const tab of [null, /9급 행정직 공무원/] as const) {
      if (tab) await page.getByRole("button", { name: tab }).first().click();
      for (let i = 0; i < (await years.count()); i++) {
        const sum = years.nth(i).locator("summary").first();
        if ((await years.nth(i).getAttribute("open")) === null) await sum.click();
        const visible = years.nth(i).getByRole("button", { name: "나라면 이렇게 안 해" }).locator("visible=true");
        if (await visible.count()) {
          await visible.first().click();
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) await fix.first().waitFor({ timeout: 5_000 });
    const group = page.getByRole("radiogroup").first();
    await group.getByRole("radio", { checked: false }).first().click();
    const corrected = JSON.parse((await page.evaluate(() => localStorage.getItem("cr:v10:profile")))!).corrections;
    expect(corrected.length).toBeGreaterThanOrEqual(1);

    // 요약 카드·비교 표 숫자 기준
    await expect(page.getByTestId("summary-basis")).toHaveText("가장 흔한 길 기준");
    await expect(page.getByTestId("compare-all").getByText("1,000번 전체의 가운데 값").first()).toBeVisible();

    await page.goto("/me");
    await page.getByRole("link", { name: /한 달 체크인/ }).click();
    await page.getByRole("button", { name: "시연용: 지금 해 보기" }).click();
    await page.getByRole("button", { name: "시연용: 예시 답 채우기" }).click();
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByRole("heading", { name: "체크인 전후로 바뀐 것" })).toBeVisible();
    await expect(page.getByText(/저장했어요 \(시연용\)/)).toBeVisible();
    // 1. 성격
    const persona = page.getByTestId("change-personality");
    await expect(persona.getByText("성실성")).toBeVisible();
    // 2. 고친 선택: 시뮬레이션에서 고친 것 + 체크인 실제 선택
    const corrections = page.getByTestId("change-corrections");
    await expect(corrections.getByRole("listitem").filter({ hasText: "한 달 체크인" })).toBeVisible();
    expect(await corrections.locator("ul").first().getByRole("listitem").count()).toBeGreaterThanOrEqual(2);
    await expect(corrections.getByText("평소 상태에서 분신이 고를 확률")).toBeVisible();
    // 3. 다시 살아 보기
    const rerun = page.getByTestId("change-rerun");
    for (const id of worlds) await expect(rerun.getByTestId(`rerun-${id}`)).toBeVisible({ timeout: 120_000 });
    await expect(rerun.getByText("만족하며 끝남").first()).toBeVisible();
    await expect(rerun.getByText(/%.*→.*%/).first()).toBeVisible();

    // 성격 값을 바꾸면 그 값으로 다시 잰다
    const before = JSON.parse((await page.evaluate(() => localStorage.getItem("cr:v10:profile")))!).bigFive;
    await persona.getByRole("button", { name: /성격 값 바꾸기/ }).click();
    await expect(persona.getByRole("status")).toBeVisible();
    const after = JSON.parse((await page.evaluate(() => localStorage.getItem("cr:v10:profile")))!).bigFive;
    expect(after).not.toEqual(before);
    for (const id of worlds) await expect(rerun.getByTestId(`rerun-${id}`)).toBeVisible({ timeout: 120_000 });
    await page.screenshot({ path: `test-results/checkin-${name}.png`, fullPage: true });
  });
}

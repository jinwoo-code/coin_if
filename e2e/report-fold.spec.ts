// 리포트는 결론과 행동만 펼쳐 두고, 숫자·준비 계획·미리 보기·고용센터는 접어 둔다. 접어도 잠긴 건 아니다.
import { expect, test } from "@playwright/test";
import { SIM_WAIT, openDemo } from "./helpers";

async function toReport(page: import("@playwright/test").Page) {
  await page.goto("/");
  await openDemo(page);
  await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: SIM_WAIT });
}

test("결론·행동은 펼치고 나머지는 접는다, 눌러서 다 볼 수 있다", async ({ page }) => {
  test.setTimeout(240_000);
  await toReport(page);
  await page.goto("/report");
  await expect(page.getByTestId("fit-leader")).toBeVisible({ timeout: 120_000 });
  // 펼치지 않은 첫 화면에도 보장하지 않는다는 한 줄
  await expect(page.getByTestId("no-guarantee")).toBeVisible();
  await expect(page.getByTestId("no-guarantee")).toHaveText(/준비 계획이지 합격·취업을 보장하지 않아요/);
  await expect(page.getByRole("heading", { name: "이번 주 실행 계획" })).toBeVisible();
  await expect(page.getByRole("link", { name: /세계선 지도에서 자세히 보기/ }).first()).toBeVisible();
  const runs = page.getByTestId("report-runs");
  await expect(runs).not.toHaveAttribute("open", "");
  await expect(runs.getByText("가장 많이 간 세계선").first()).toBeHidden();
  await runs.locator("summary").first().click(); // 안에 시험형 '어떻게 셌나요?' 접기도 있다
  await expect(runs.getByText("가장 많이 간 세계선").first()).toBeVisible();
  await expect(runs.getByRole("img", { name: /잠김/ })).toHaveCount(0);
  const gap = page.getByTestId("gap-world").first();
  await expect(gap).not.toHaveAttribute("open", "");
  await gap.locator("summary").first().click();
  await expect(page.getByTestId("plan-developer")).toBeVisible({ timeout: 60_000 });
});

test("내 정보: 부가 메뉴가 여기로 옮겨졌고, 전체 지우기는 확인 창을 거친다", async ({ page }) => {
  test.setTimeout(240_000);
  await toReport(page);
  await page.goto("/choose");
  await expect(page.getByRole("link", { name: /한 달 체크인/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "전체 지우기" })).toHaveCount(0);
  await page.getByRole("link", { name: "내 정보" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await page.getByRole("button", { name: "전체 지우기" }).click();
  await expect(page.getByRole("heading", { name: "전체 지울까요?" })).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  expect(await page.evaluate(() => localStorage.getItem("cr:v10:profile"))).not.toBeNull();
  // 시연 인물만 체크인을 앞당길 수 있다
  await page.goto("/me");
  await page.getByRole("link", { name: /한 달 체크인/ }).click();
  await expect(page.getByRole("button", { name: "시연용: 지금 해 보기" })).toBeVisible();
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("cr:v10:profile")!);
    localStorage.setItem("cr:v10:profile", JSON.stringify({ ...p, name: "학생" }));
  });
  await page.reload();
  await expect(page.getByText(/일 남았어요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "시연용: 지금 해 보기" })).toHaveCount(0);
  await page.goto("/me");
  await expect(page.getByText("시연용")).toHaveCount(0);
  await page.getByRole("button", { name: "전체 지우기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "전체 지우기" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem("cr:v10:profile"))).toBeNull();
});

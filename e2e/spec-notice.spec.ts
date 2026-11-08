// 스펙(학교·졸업 시기)을 안 적은 사람: 시뮬레이션 요약 위에 기본값 안내 + 적으러 가기.
// 머리글 오른쪽 진행 표시(마지막으로 받은 칸)는 살아보는 중에만 보이고, 끝나면 비운다(보고 있는 장면 날짜처럼 보이지 않게).
import { expect, test } from "@playwright/test";
import { openDemo, SIM_WAIT } from "./helpers";

test("스펙 안 적음 안내와 끝난 뒤 머리글 진행 표시", async ({ page }) => {
  test.setTimeout(SIM_WAIT + 120_000);
  await page.goto("/");
  await openDemo(page, "developer");
  await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });
  await page.getByRole("link", { name: /다른 갈래 길 보기/ }).waitFor({ timeout: SIM_WAIT });
  const progress = page.locator("header span[aria-live='polite']");
  await expect(progress).toHaveText("");
  // 예시 인물은 스펙을 적었으니 안내가 없다
  await expect(page.getByTestId("spec-notice")).toHaveCount(0);

  // 스펙을 안 적은 사람으로 바꾸고 다시 열면(저장된 본선 복원) 안내가 보인다
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("cr:v10:profile")!);
    localStorage.setItem("cr:v10:profile", JSON.stringify({ ...p, depth: { ...p.depth, spec: false, resume: false } }));
  });
  await page.reload();
  const note = page.getByTestId("spec-notice");
  await expect(note).toContainText("학교·졸업 시기를 안 적어서 전문대 재학·1년 뒤 졸업 기준으로 계산했어요. 적으면 더 맞아져요.");
  await expect(progress).toHaveText("", { timeout: SIM_WAIT });
  await note.getByRole("link", { name: /적으러 가기/ }).click();
  await expect(page).toHaveURL(/\/interview\?more=1/);
});

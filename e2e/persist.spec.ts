// 데이터가 사라지지 않는지: 검사 결과가 나오는 순간 저장되고(버튼을 안 눌러도), 진로 고르기에서 고른 진로는 새로고침해도 남는다.
import { expect, test } from "@playwright/test";
import { quickPart, savedProfile } from "./helpers";

test("검사 결과는 나오자마자 저장, 고른 진로는 새로고침 뒤에도", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/interview");
  await quickPart(page, "빠르게", 13);
  await expect(page.getByRole("heading", { name: "입력한 정보" })).toBeVisible({ timeout: 60_000 });
  // '이대로 진로 고르기'를 누르지 않고 닫았다가 다시 와도 결과가 있다
  expect((await savedProfile(page))?.major).toBe("경영학과");
  await page.goto("/choose");
  await expect(page).toHaveURL(/\/choose/);

  await page.getByRole("button", { name: /브랜드 마케터/ }).click();
  await page.getByRole("button", { name: /무역·물류 담당자/ }).click();
  await page.getByRole("radio", { name: "5년" }).or(page.getByRole("button", { name: "5년", exact: true })).first().click();
  await page.reload();
  await expect(page.getByRole("button", { name: /2개 진로를 5년 살아보기/ })).toBeVisible();
});

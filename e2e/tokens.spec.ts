// 토큰 정책(lib/token-policy.ts, 2026-11-08): 화면 값, 결제 전 환불·유효기간 안내와 필수 동의, 주문 API.
// 로그인 없이 보는 범위만 본다(테스트 계정 로그인·토스 결제창은 사람이 직접 확인).
import { expect, test } from "@playwright/test";
import { openDemo, SIM_WAIT } from "./helpers";

test("토큰 화면: 기능별 토큰, 묶음 두 개, 환불 안내와 동의 체크", async ({ page }) => {
  await page.goto("/tokens");
  const costs = page.getByTestId("token-costs");
  await expect(costs.getByRole("listitem").filter({ hasText: "진로 시뮬레이션(1,000번)" })).toContainText("무료");
  await expect(costs.getByRole("listitem").filter({ hasText: "미래의 나와 대화" })).toContainText("무료");
  await expect(costs.getByRole("listitem").filter({ hasText: "미래의 나와 대화" })).toContainText("20마디까지");
  await expect(costs.getByRole("listitem").filter({ hasText: "AI가 직접 살아 보는 모드" })).toContainText("3개");
  await expect(costs.getByRole("listitem").filter({ hasText: "프리미엄 리포트" })).toContainText("5개");
  await expect(page.getByText("1토큰 990원")).toHaveCount(0); // 예전 낱개 가격 문구
  await expect(page.getByText("1개에 990원")).toBeVisible(); // 5개 묶음
  await expect(page.getByText("1개에 825원")).toBeVisible(); // 12개 묶음

  const notice = page.getByTestId("refund-notice");
  await expect(notice).toContainText("결제 후 7일 안에 하나도 쓰지 않았으면 전액 환불해 드려요. 쓴 토큰은 환불되지 않아요. 산 토큰은 5년 동안 쓸 수 있어요.");
  const agree = page.getByRole("checkbox", { name: /위 내용을 확인했어요/ });
  await expect(agree).not.toBeChecked();

  const t5 = page.getByRole("button", { name: "5토큰 4,950원 충전" });
  const t12 = page.getByRole("button", { name: "12토큰 9,900원 충전" });
  await expect(t5).toBeVisible();
  await expect(t12).toBeVisible();
  await expect(page.getByRole("button", { name: /10토큰|30토큰|1토큰/ })).toHaveCount(0);
  // 동의 전에는 결제 버튼이 꺼져 있다(로그인 전이라 동의해도 꺼진 채)
  await expect(t5).toBeDisabled();
  await agree.check();
  await expect(agree).toBeChecked();
});

test("토큰 API: 값과 주문 거부", async ({ request }) => {
  const info = await (await request.get("/api/tokens")).json();
  expect(info.costs).toEqual({ simulate: 0, live_simulate: 3, premium_report: 5, talk: 0 });
  expect(info.talkLimit).toBe(20);
  // 로그인 안 하면 주문을 못 만든다
  const res = await request.post("/api/pay/order", { data: { productId: "t5", agreed: true } });
  expect(res.status()).toBe(401);
});

test("진로 고르기: 모드 버튼에 토큰 표시", async ({ page }) => {
  test.setTimeout(SIM_WAIT + 60_000);
  await page.goto("/");
  await openDemo(page, "developer");
  await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });
  await page.goto("/choose");
  await expect(page.getByRole("radio", { name: /기본 모드 · 무료/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /AI가 직접 살아 보는 모드 · 토큰 3개/ })).toBeVisible();
});

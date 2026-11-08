// 전체 흐름. 시연 인물: 시뮬 → 세계선 지도(갈림길 바꿔 보기) → 실시간 30번 → 대화 → 리포트 → 토큰 충전 화면.
// 검사 깊이 셋: 빠르게·표준·정밀(이야기 1장) → 진로 고르기 → 시뮬 → 세계선 지도.
// AI는 안 부른다(설정에서 키를 비움, 이야기·대화·실시간 판단은 가짜). 로그인·실제 결제창 승인은 못 한다: 토큰은 /api/tokens 응답을 가짜로 줘서 화면만, 승인 API의 금액·중복 검사는 따로 실제로 확인했다(CLAUDE.md 2026-11-02).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { counter, EMPTY, mockStoryApis, next, pickAll, quickPart, REMOTE, SIM_WAIT, autoOpenReport, openDemo } from "./helpers";

test.beforeEach(async ({ page }) => autoOpenReport(page));

const worldFile = (id: string) => JSON.parse(readFileSync(`data/worlds/${id}.json`, "utf8")) as { events: { id: string; choices: unknown[] }[] };
const WORLDS = { developer: worldFile("developer"), "civil-servant": worldFile("civil-servant"), marketer: worldFile("marketer") };
const noErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

async function mockLiveJudge(page: Page) {
  await page.route("**/api/judge", async (route) => {
    const body = route.request().postDataJSON();
    const w = WORLDS[body.worldId as keyof typeof WORLDS];
    const n = w.events.find((e) => e.id === body.forkId)!.choices.length;
    await route.fulfill({ json: { entries: { now: { probs: Array(n).fill(1 / n), reasons: Array(n).fill("모은 돈이 적어서"), src: "ai" } }, src: "ai" } });
  });
}

// 시뮬이 끝나고 세계선 지도까지
async function simulateToMap(page: Page) {
  await expect(page).toHaveURL(/\/simulate/);
  await page.getByRole("link", { name: /다른 갈래 길 보기/ }).click({ timeout: SIM_WAIT });
  await expect(page).toHaveURL(/\/multiverse/);
  await expect(page.getByText(/1,000번 중/).first()).toBeVisible({ timeout: 60_000 });
}

test("시연 인물 끝까지", async ({ page }) => {
  test.setTimeout(REMOTE ? 900_000 : 300_000);
  const errors = noErrors(page);
  await page.goto("/");
  await openDemo(page);
  await simulateToMap(page);

  // 세계선 열기 → 갈림길 바꿔 보기(1,000번 다시)
  await page.locator('section[aria-labelledby="tree"] button').first().click();
  const flip = page.getByRole("button", { name: /여기서 다르게 골랐다면|운이 반대였다면/ }).first();
  await expect(flip).toBeVisible({ timeout: 60_000 });
  await flip.click();
  await expect(page.getByText("반대로 간 길")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/다시 살아봤어요/)).toBeVisible();
  await page.getByRole("button", { name: "원래 길로 돌아가기" }).click();

  // 이 세계의 나와 대화
  await page.route("**/api/talk", (r) => r.fulfill({ json: { reply: "그 세계에서는 그렇게 됐어.", memory: null } }));
  await page.getByRole("button", { name: /이 길의 나와 대화하기/ }).click();
  await expect(page).toHaveURL(/\/talk/);
  await page.getByRole("textbox").fill("어땠어?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("그 세계에서는 그렇게 됐어.")).toBeVisible();

  // 리포트
  await page.goto("/report");
  await expect(page.getByText(/1,000번 살아본 결과/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /프리미엄 리포트 열기/ })).toBeVisible();

  // 실시간 30번을 같은 인물로 → 세계선 지도·리포트에 별도 칸
  await mockLiveJudge(page);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("cr:v10:selection")!);
    localStorage.setItem("cr:v10:selection", JSON.stringify({ ...s, mode: "live" }));
  });
  await page.goto("/live");
  await expect(page.getByRole("status")).toContainText("다 살아봤어요", { timeout: 120_000 });
  await page.getByRole("button", { name: /갈래 길 지도·대화·리포트에서 이어 보기/ }).click();
  await expect(page).toHaveURL(/\/multiverse/, { timeout: 60_000 });
  await expect(page.getByRole("region", { name: /AI가 직접 살아 본 30개의 삶/ })).toContainText("30번 중");

  // 토큰: 로그인 안 하면 무료 안내. 로그인한 척 응답을 주면 충전 주문 → 승인 화면(가짜 응답)
  await page.goto("/tokens");
  await expect(page.getByText("테스트 결제예요. 실제로 돈이 나가지 않아요.")).toBeVisible();
  await expect(page.getByRole("link", { name: "로그인" }).last()).toBeVisible();
  await page.route("**/api/pay/confirm", (r) => r.fulfill({ json: { ok: true, tokens: 5, balance: 10 } }));
  await page.goto("/tokens/success?paymentKey=fake&orderId=fake&amount=4950");
  await expect(page.getByText(/충전했어요/)).toBeVisible();
  await expect(page.getByText(/남은 토큰/)).toContainText("10");

  expect(errors).toEqual([]);
});

// 고른 진로로 시뮬·지도까지
async function chooseAndRun(page: Page) {
  await expect(page).toHaveURL(/\/choose/);
  await page.locator("#q").fill("백엔드");
  await page.getByRole("button", { name: /웹 백엔드 개발자/ }).first().click();
  await page.locator("#q").fill("9급");
  await page.getByRole("button", { name: /9급/ }).first().click();
  await page.getByRole("button", { name: /2개 진로를 .* 살아보기/ }).click();
  await simulateToMap(page);
}

test("검사 빠르게 → 지도", async ({ page }) => {
  test.setTimeout(REMOTE ? 900_000 : 240_000);
  const errors = noErrors(page);
  await page.goto("/interview");
  await quickPart(page, "빠르게", 13);
  await expect(page.getByRole("heading", { name: "입력한 정보" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "이대로 진로 고르기" }).click();
  await chooseAndRun(page);
  expect(errors).toEqual([]);
});

async function standardRest(page: Page) {
  await expect(counter(page)).toHaveText("13/26");
  await page.locator("#answer").fill("동아리에서 앱을 만들어 봤어요");
  await page.locator("#answer").press("Enter");
  for (let k = 0; k < 9; k++) {
    await expect(counter(page)).toHaveText(`${14 + k}/26`);
    await pickAll(page, k < 6 ? 2 : 1);
    await next(page);
  }
  await page.locator("#cci-c4").fill("일단 해 보자가 좌우명이에요");
  await next(page);
  await page.getByRole("button", { name: "맞아요, 이대로 저장" }).click();
  await page.getByRole("button", { name: "건너뛰기" }).click();
  await expect(page.getByRole("heading", { name: "입력한 정보" })).toBeVisible({ timeout: 60_000 });
}

test("검사 표준 → 지도", async ({ page }) => {
  test.setTimeout(REMOTE ? 900_000 : 240_000);
  await mockStoryApis(page, { ...EMPTY, decisionStyle: { value: "impulsive", evidence: "일단 해 보자", confidence: 0.8 } });
  await page.goto("/interview");
  await quickPart(page, "표준", 26);
  await standardRest(page);
  await page.getByRole("button", { name: "이대로 진로 고르기" }).click();
  await chooseAndRun(page);
});

test("검사 정밀(이야기 1장) → 지도", async ({ page }) => {
  test.setTimeout(REMOTE ? 900_000 : 240_000);
  await mockStoryApis(page, { ...EMPTY, regretType: { value: "inaction", evidence: "미술을 포기한 게 후회돼요" } });
  await page.goto("/interview");
  await quickPart(page, "정밀", 26);
  await standardRest(page);
  // 결과 화면에서 바로 들어간다(프로필을 저장하고 가야 검사로 안 돌아간다)
  await page.getByRole("link", { name: /인생 이야기 6장 시작하기/ }).click();
  await expect(page).toHaveURL(/\/story$/);
  await page.getByRole("link", { name: /큰 결정과 후회/ }).click();
  const answer = page.getByPlaceholder("생각나는 대로 써 주세요");
  const send = page.getByRole("button", { name: "보내기" });
  await answer.fill("인문계에서 자연계로 바꾼 게 제일 큰 결정이에요");
  await send.click();
  await page.getByRole("button", { name: "넘어가기" }).click();
  await answer.fill("미술을 포기한 게 후회돼요. 지금도 가끔 그림을 그려요");
  await send.click();
  await answer.fill("아쉬웠지만 어쩔 수 없다고 생각했어요");
  await send.click();
  await page.getByRole("button", { name: "맞아요, 이대로 저장" }).click();
  await expect(page.getByText("1/6장 끝냄")).toBeVisible();
  await page.goto("/choose");
  await chooseAndRun(page);
});

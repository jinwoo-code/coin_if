// 화면 흐름 테스트에서 같이 쓰는 것
import { expect, type Page } from "@playwright/test";

// 화면 안의 5점 척도·보기 묶음을 전부 고른다(n번째 보기)
export async function pickAll(page: Page, n: number) {
  const groups = page.locator("main [role=radiogroup]");
  await expect(groups.first()).toBeVisible(); // 'AI가 입력 중' 뒤에 문항이 나온다
  for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole("radio").nth(n).click();
}

// 배포 사이트는 실제 AI를 불러서 느리다(시연 인물 약 150초, 2026-11-06). 로컬은 키를 비워 빠르다.
export const REMOTE = Boolean(process.env.BASE_URL);
export const SIM_WAIT = REMOTE ? 300_000 : 110_000;
export const counter = (page: Page) => page.locator("header .num");
export const next = (page: Page) => page.getByRole("button", { name: "다음", exact: true }).click();
export const savedProfile = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:profile") ?? "null"));

// 동의 → 기본 → 깊이 고르기 → 고민 → 스펙 → 가치관 → 성격 10 → 생활 조건 → 성격 10 → 상황 질문 3화면 → 바라는 것(빠르게와 표준 공통 앞부분)
export async function quickPart(page: Page, depth: "빠르게" | "표준" | "정밀" | "계속 닮아 가기", total: number) {
  await page.getByRole("button", { name: "동의하고 시작" }).click();
  await page.getByPlaceholder("예: 김민준…").fill("테스트");
  await page.getByPlaceholder("예: 컴퓨터모바일융합과…").fill("경영학과");
  await next(page);
  await page
    .getByRole("listitem")
    .filter({ hasText: new RegExp(`^${depth}`) })
    .click();
  await page.getByRole("button", { name: "바로 취업할지 공무원을 준비할지" }).click();
  await page.getByRole("button", { name: "이 스펙으로 다음" }).click();
  for (const v of ["안정", "성장", "돈", "여유"]) await page.getByRole("button", { name: new RegExp(`^${v}`) }).click();
  await next(page);
  await expect(counter(page)).toHaveText(`6/${total}`);
  await pickAll(page, 3);
  await next(page);
  await page.getByRole("button", { name: "이 조건으로 다음" }).click();
  await pickAll(page, 1);
  await next(page);
  for (let k = 0; k < 3; k++) {
    await expect(counter(page)).toHaveText(`${9 + k}/${total}`);
    await pickAll(page, 0);
    await next(page);
  }
  await expect(counter(page)).toHaveText(`12/${total}`);
  await next(page);
}

// AI를 부르지 않도록 이야기 API를 가짜로 바꾼다(무료 키 한도·결과가 매번 다른 것 피하기)
export async function mockStoryApis(page: Page, signals: object) {
  await page.route("**/api/story/extract", (r) => r.fulfill({ json: { signals, crisis: false } }));
  await page.route("**/api/story/followup", async (r) => {
    const body = r.request().postDataJSON() as { follows?: number };
    await r.fulfill({ json: { q: body.follows ? null : "그때 어떤 기분이었어요?", crisis: false } });
  });
}

// 이야기 API 말고 다른 곳으로 나간 요청 본문(원문이 새는지 보려고)
export function watchOtherPosts(page: Page) {
  const bodies: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && !r.url().includes("/api/story/")) bodies.push(`${new URL(r.url()).pathname} ${r.postData() ?? ""}`);
  });
  return bodies;
}

export const EMPTY = { decisionStyle: null, persistence: null, familyExpectation: null, regretType: null, coreValues: [], runwayMonths: null };

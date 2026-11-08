// AI 판단이 실패하면 화면에 'AI 판단 실패 → 규칙 계산'이 나온다. 응답 실패(500)와 네트워크 끊김은 가짜로, 틀린 키는 E2E_BAD_KEY=1로 실제 서버를 거쳐.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { openTimeline, SIM_WAIT, openDemo, REMOTE } from "./helpers";

// 실패하면 에러 줄·화면·시각 기록을 e2e-failures/{시각}-{테스트}/에 남긴다(test-results/는 다음 실행에 지워져서).
// 배포본은 분신 판단을 하나씩 부르고 429면 최대 60초씩 3번 다시 시도해서, 실패 안내까지 몇 분 걸릴 수 있다.
const FAIL_WAIT = REMOTE ? 480_000 : 120_000;
const marks = new WeakMap<Page, string[]>();
function track(page: Page) {
  const t0 = Date.now();
  const log: string[] = [];
  marks.set(page, log);
  const at = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  page.on("request", (q) => {
    const p = new URL(q.url()).pathname;
    if (p.startsWith("/api/simulate") || p.startsWith("/api/judge")) log.push(`${at()} 요청 ${p}`);
  });
  page.on("response", (q) => {
    const p = new URL(q.url()).pathname;
    if (p.startsWith("/api/simulate") || p.startsWith("/api/judge")) log.push(`${at()} 응답 ${p} ${q.status()}`);
  });
  return (what: string) => log.push(`${at()} ${what}`);
}
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const dir = `e2e-failures/${new Date().toISOString().replace(/[:.]/g, "-")}-${info.title.replace(/[^\p{L}\p{N}]+/gu, "_")}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/error.txt`, [info.title, info.status, ...info.errors.map((e) => `${e.message ?? ""}\n${e.stack ?? ""}`)].join("\n\n"));
  writeFileSync(`${dir}/timeline.txt`, (marks.get(page) ?? []).join("\n"));
  await page.screenshot({ path: `${dir}/screen.png`, fullPage: true }).catch(() => {});
  for (const a of info.attachments) if (a.path && existsSync(a.path)) copyFileSync(a.path, `${dir}/${a.name}${a.path.slice(a.path.lastIndexOf("."))}`);
  appendFileSync("e2e-failures/index.txt", `${dir}\n`);
  console.log(`실패 기록: ${dir}`);
});

const cases = process.env.E2E_BAD_KEY ? (["틀린 키"] as const) : (["응답 실패", "네트워크 끊김"] as const);
for (const how of cases) {
  test(`AI 판단 ${how} 표시`, async ({ page }) => {
    test.setTimeout(REMOTE ? 600_000 : 240_000);
    let calls = 0;
    await page.route("**/api/judge", (route) => {
      calls++;
      if (how === "틀린 키") return route.continue();
      return how === "응답 실패" ? route.fulfill({ status: 500, json: { error: "x" } }) : route.abort("failed");
    });
    await page.goto("/");
    await openDemo(page);
    await expect(page).toHaveURL(/\/choose|\/simulate/, { timeout: 30_000 });
    if (page.url().includes("/choose")) await page.getByRole("button", { name: /살아보기|시작/ }).last().click();
    await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });

    const failed = page.getByText("AI 판단 실패 → 규칙 계산").first();
    await expect.poll(() => calls, { timeout: 60_000 }).toBeGreaterThan(0);
    // 시뮬레이션이 끝날 때까지 기다린 뒤(무료 키 배포본은 몇 분 걸림) 큰 갈림길 장면을 찾는다
    await page.getByRole("link", { name: /다른 갈래 길 보기/ }).waitFor({ timeout: SIM_WAIT });
    await expect(page.locator("details").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first()).toBeAttached({ timeout: 30_000 });
    await openTimeline(page);
    await page.locator("details:not([data-testid])").filter({ hasText: "AI 판단 실패 → 규칙 계산" }).first().locator("summary").click();
    await expect(failed).toBeVisible();
    await failed.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/judge-fail-${how}.png` });
  });
}

// 좁은 칸에서 '나라면 이렇게 안 해' 버튼이 카드 끝에 붙지 않는다(진로 3개를 나란히, 320·390px)
for (const width of [320, 390]) {
  test(`고치기 버튼 여백 ${width}px`, async ({ page }) => {
    test.setTimeout(REMOTE ? 600_000 : 240_000); // 진로 3개라 배포 사이트(무료 키, 하나씩 호출)는 2분을 넘긴다
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await openDemo(page);
    await expect(page).toHaveURL(/\/simulate/);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("cr:v10:selection")!);
      localStorage.setItem("cr:v10:selection", JSON.stringify({ ...s, worldIds: ["developer", "civil-servant", "marketer"] }));
    });
    await page.reload();
    const btn = page.getByRole("button", { name: "나라면 이렇게 안 해" }).first();
    await page.getByRole("link", { name: /다른 갈래 길 보기/ }).waitFor({ timeout: SIM_WAIT });
    await openTimeline(page);
    await expect(btn).toBeAttached();
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

// 시뮬레이션 서버가 실패하면 멈춘 상태가 되고, 큰 버튼 '다시 살아보기'로 다시 돌 수 있다(예전에는 버튼이 다 꺼져 갇혔다)
// 두 가지: 서버가 500을 줌 / 응답이 '끝' 신호 없이 중간에 끊김(함수 시간 제한 등)
for (const how of ["서버 실패", "응답 중간에 끊김"] as const) {
  test(`시뮬레이션 ${how} → 다시 살아보기`, async ({ page }) => {
    test.setTimeout(REMOTE ? 900_000 : 300_000);
    const mark = track(page);
    let fail = true;
    await page.route("**/api/simulate", async (route) => {
      if (!fail) return route.continue();
      if (how === "서버 실패") return route.fulfill({ status: 500, json: { error: "x" } });
      // 진짜 응답에서 첫 '역'(step)까지만 주고 닫는다: plan·step은 오고 done은 안 온다
      const res = await route.fetch();
      const events = (await res.text()).split("\n\n");
      const cut = events.findIndex((e) => e.includes('"type":"step"'));
      expect(cut, "응답에 step이 있어야 끊을 수 있다").toBeGreaterThan(-1);
      mark(`응답을 ${events.length}개 중 ${cut + 1}번째 이벤트에서 끊음`);
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: events.slice(0, cut + 1).join("\n\n") + "\n\n" });
    });
    await page.goto("/");
    await openDemo(page);
    await expect(page.getByRole("alert").filter({ hasText: "다시 살아보기" })).toBeVisible({ timeout: FAIL_WAIT });
    mark("실패 안내 보임");
    await expect(page.getByText("살아보다 멈췄어요")).toBeVisible();
    await page.screenshot({ path: `test-results/simulate-${how === "서버 실패" ? "fail" : "cut"}.png` });
    const again = page.getByRole("button", { name: "다시 살아보기" }).last();
    await expect(again).toBeEnabled();
    fail = false;
    await again.click();
    mark("다시 살아보기 누름");
    await page.getByRole("link", { name: /다른 갈래 길 보기/ }).waitFor({ timeout: SIM_WAIT });
    mark("끝까지 감");
  });
}

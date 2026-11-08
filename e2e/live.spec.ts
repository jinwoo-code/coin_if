// 실시간 판단 모드: 시작 → 끝난 삶 먼저 보기 → AI 실패로 멈춤 → 새로고침해도 이어서 → 끝 → 다시 열면 AI를 안 부름. AI는 가짜.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { autoOpenReport } from "./helpers";

test.beforeEach(async ({ page }) => autoOpenReport(page));

const world = JSON.parse(readFileSync("data/worlds/developer.json", "utf8")) as { events: { id: string; choices: unknown[] }[] };
const marketer = JSON.parse(readFileSync("data/worlds/marketer.json", "utf8")) as { events: { id: string; choices: unknown[] }[] };
const answer = (worldId: string, forkId: string) => {
  const n = (worldId === "developer" ? world : marketer).events.find((e) => e.id === forkId)!.choices.length;
  return { entries: { now: { probs: Array(n).fill(1 / n), reasons: Array(n).fill("모은 돈이 적어서"), src: "ai" } }, src: "ai" };
};

test("실시간 판단 모드 멈춤과 이어서 하기", async ({ page }) => {
  let calls = 0;
  let failAfter = 10;
  await page.route("**/api/judge", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.live).toBeTruthy();
    expect(body.profile.storyRaw).toEqual({}); // 원문을 안 보낸다
    calls++;
    if (calls > failAfter) return route.fulfill({ json: { entries: {}, src: "fallback" } });
    await route.fulfill({ json: answer(body.worldId, body.forkId) });
  });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("cr:v10:profile", JSON.stringify({ name: "테스트", major: "경영학과" }));
    localStorage.setItem("cr:v10:selection", JSON.stringify({ worldIds: ["developer", "marketer"], months: 36, startYm: "2026-12", mode: "live" }));
  });
  await page.goto("/live");
  await expect(page.getByText(/AI가 답을 못 줬어요/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("status")).toContainText("번째 삶까지 살고 멈췄어요");
  const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("cr:v10:live") ?? "{}").entries ?? {}).length);
  expect(stored).toBe(10);

  // 새로고침해도 이어서, 끝까지
  failAfter = 100_000;
  await page.reload();
  await expect(page.getByRole("status")).toContainText("다 살아봤어요", { timeout: 90_000 });
  await expect(page.getByText("30번 다 살아봤어요.").first()).toBeVisible();
  await expect(page.getByText(/30번 중 \d+번/).first()).toBeVisible();

  // 삶 하나 읽기
  await page.getByRole("button", { name: "1번째 삶 읽기" }).first().click();
  await expect(page.getByText("모은 돈이 적어서").first()).toBeVisible();

  // 다시 열면 AI를 안 부르고 같은 결과
  const text = await page.locator("main").innerText();
  const before = calls;
  await page.reload();
  await expect(page.getByRole("status")).toContainText("다 살아봤어요");
  expect(calls).toBe(before);
  expect((await page.locator("main").innerText()).replace(/\s/g, "").includes(text.split("어떤 갈래로")[0].replace(/\s/g, "").slice(-30))).toBeTruthy();

  // 세계선 지도·리포트에서 1,000번 통계와 따로 'AI가 직접 살아 본 30개의 삶' 칸으로 잇는다(그 삶을 규칙으로 다시 살지 않는다)
  await page.getByRole("button", { name: /갈래 길 지도·대화·리포트에서 이어 보기/ }).click();
  await expect(page).toHaveURL(/\/multiverse/, { timeout: 60_000 });
  await expect(page.getByText(/1,000번 중/).first()).toBeVisible(); // 나무는 1,000번
  const card = page.getByRole("region", { name: /AI가 직접 살아 본 30개의 삶/ });
  await expect(card).toContainText("30번 중");
  await expect(card).toContainText("오차 범위");
  await expect(card.getByText(/\(\d+~\d+%\)/).first()).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:multiverses") ?? "{}"));
  expect(saved.developer.stats.runs).toBe(1000);
  expect(saved.developer.live).toBeUndefined();

  // 그 삶의 나와 대화
  let talkBody: { lineId?: string; scenes?: { worldId: string }[] } = {};
  await page.route("**/api/talk", async (route) => {
    talkBody = route.request().postDataJSON();
    await route.fulfill({ json: { reply: "그 삶에서는 그렇게 됐어.", memory: null } });
  });
  await card.getByRole("button", { name: "이 삶의 나와 대화" }).first().click();
  await expect(page).toHaveURL(/\/talk/);
  await expect(page.getByText("AI가 직접 살아 본 삶")).toBeVisible();
  await page.getByRole("textbox").fill("어땠어?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("그 삶에서는 그렇게 됐어.")).toBeVisible();
  expect(talkBody.lineId).toMatch(/^live:/);
  expect(talkBody.scenes?.length).toBeGreaterThan(0);

  // 리포트에도 별도 칸. 대화 상대를 30개의 삶에서 골라도 리포트는 1,000번 장면을 쓴다.
  await page.goto("/report");
  await expect(page.getByRole("region", { name: /AI가 직접 살아 본 30개의 삶/ }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/1,000번 살아본 결과/).first()).toBeVisible();
});

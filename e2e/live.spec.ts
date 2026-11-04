// 실시간 판단 모드: 시작 → 끝난 삶 먼저 보기 → AI 실패로 멈춤 → 새로고침해도 이어서 → 끝 → 다시 열면 AI를 안 부름. AI는 가짜.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

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
    localStorage.setItem("cr:v9:profile", JSON.stringify({ name: "테스트", major: "경영학과" }));
    localStorage.setItem("cr:v9:selection", JSON.stringify({ worldIds: ["developer", "marketer"], months: 36, startYm: "2026-12", mode: "live" }));
  });
  await page.goto("/live");
  await expect(page.getByText(/AI가 답을 못 줬어요/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("status")).toContainText("번째 삶까지 살고 멈췄어요");
  const stored = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("cr:v9:live") ?? "{}").entries ?? {}).length);
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

  // 플래그가 꺼져 있으면(기본) 이어 가는 버튼이 없다. 켠 뒤 확인: NEXT_PUBLIC_FEATURE_LIVE_LINK=1 npx playwright test e2e/live.spec.ts
  if (process.env.NEXT_PUBLIC_FEATURE_LIVE_LINK !== "1") {
    await expect(page.getByRole("button", { name: /이 결과로 세계선 지도/ })).toHaveCount(0);
    return;
  }

  // 이 결과로 세계선 지도·대화·리포트로 이어 가기(장면은 그 삶 그대로, 다시 살기 요청 없음)
  const replays: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/(line|explore|simulate)/.test(r.url())) replays.push(r.url());
  });
  await page.getByRole("button", { name: /이 결과로 세계선 지도/ }).click();
  await expect(page).toHaveURL(/\/multiverse/);
  await expect(page.getByText("실시간 판단 30번 결과예요").first()).toBeVisible();
  await expect(page.getByText(/30번 살아본 결과/).first()).toBeVisible();
  await page.getByRole("button", { name: "이 세계 살아보기" }).first().click();
  await expect(page.getByText("여기서 다르게 골랐다면")).toHaveCount(0);
  await expect(page.getByText("나라면 이렇게 안 해")).toHaveCount(0);
  expect(replays).toEqual([]);
  await page.goto("/talk?world=developer");
  await expect(page).toHaveURL(/\/talk/);
  await expect(page.getByRole("textbox")).toBeVisible();
  await page.goto("/report");
  await expect(page.getByText(/30번 살아본 결과/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("실시간 판단 30번 결과예요").first()).toBeVisible();
});

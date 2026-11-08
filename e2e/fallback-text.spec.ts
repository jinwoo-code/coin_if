// AI 서술·대화가 실패해 기본 문장으로 대신 나가면 'AI 문장 대신 기본 문장'을 붙이고, 같은 기본 문장은 한 해에 한 번만 보인다.
// 실제 실패를 보려면 E2E_BAD_KEY=1(틀린 키로 서버가 실제로 실패). 키가 없는 목업 모드(기본)는 실패가 아니라 표시가 없어야 한다.
import { expect, test } from "@playwright/test";
import { openDemo, openTimeline, REMOTE, SIM_WAIT } from "./helpers";

const BAD = Boolean(process.env.E2E_BAD_KEY);

test(`서술 기본 문장 안내와 한 해 반복 접기 (${BAD ? "틀린 키" : "키 없음"})`, async ({ page }) => {
  test.skip(REMOTE, "배포본은 키 상태를 정할 수 없다");
  test.setTimeout(300_000);
  await page.goto("/");
  await openDemo(page, "nurse");
  await expect(page).toHaveURL(/\/simulate/, { timeout: 30_000 });
  await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: SIM_WAIT });
  await openTimeline(page);
  const notes = page.getByText("AI 문장 대신 기본 문장");
  if (BAD) await expect(notes.first()).toBeVisible();
  else await expect(notes).toHaveCount(0);

  // 한 해 안에서 같은 장면 문장이 두 번 보이지 않는다
  const dup = await page.evaluate(() => {
    const out: string[] = [];
    document.querySelectorAll('details[data-testid="year"]').forEach((y) => {
      const seen = new Set<string>();
      y.querySelectorAll("article").forEach((a) => {
        const t = a.querySelector("h3 + p")?.firstChild?.textContent?.trim() ?? "";
        if (!t || t.startsWith("앞과 같은 일")) return;
        const title = a.querySelector("h3")?.textContent ?? "";
        if (title.includes("조용히")) return;
        if (seen.has(t)) out.push(t);
        seen.add(t);
      });
    });
    return out;
  });
  expect(dup).toEqual([]);

  // 대화 기본 답
  await page.goto("/talk?world=nurse");
  const ask = page.getByRole("textbox", { name: "미래의 나에게 물어보기" });
  await ask.fill("요즘 어때?");
  await ask.press("Enter");
  await expect(page.getByText("요즘 어때?")).toBeVisible();
  await expect(page.getByText(/가장 최근 큰일은|그때가 제일 힘들었어|모아 둔 돈은|후회까진/).first()).toBeVisible({ timeout: 60_000 });
  if (BAD) await expect(page.getByText("AI 문장 대신 기본 문장")).toBeVisible();
  else await expect(page.getByText("AI 문장 대신 기본 문장")).toHaveCount(0);
});

// 저장된 결과 복원과 예시 인물 시작 확인. AI·시뮬레이션 호출 없이 저장값으로 본다.
import { expect, test } from "@playwright/test";
import { DEMO_PROFILE, demoSelection } from "../lib/demo";

const K = (n: string) => `cr:v10:${n}`;
const scene = (lineId: string, title: string) => ({ worldId: "developer", lineId, station: 0, label: "2027년 1분기", eventId: "quiet", title, narration: "", status: "준비 중", delta: {}, state: { satisfaction: 50, stress: 50, skill: 50, money: 100, health: 50 }, freq: 1, minor: [], routine: true });
const mv = (mainId: string) => ({ worldId: "developer", months: 36, startYm: "2026-12", stats: { runs: 1000, gate: null, final: {} }, tree: { id: "", key: "", children: [], count: 1000 }, lines: [{ id: mainId, isMain: true, title: "본선", count: 600, path: [""] }, { id: "other", isMain: false, title: "다른 길", count: 400, path: [""] }] });

async function seed(page: import("@playwright/test").Page, mainId: string, profile: object) {
  await page.goto("/privacy");
  await page.evaluate(
    ({ K, profile, selection, mv, lines, active }) => {
      localStorage.setItem(`${K}profile`, JSON.stringify(profile));
      localStorage.setItem(`${K}selection`, JSON.stringify(selection));
      localStorage.setItem(`${K}multiverses`, JSON.stringify({ developer: mv }));
      localStorage.setItem(`${K}lines`, JSON.stringify({ developer: lines }));
      localStorage.setItem(`${K}active`, JSON.stringify({ developer: active }));
    },
    { K: K(""), profile, selection: { ...demoSelection("developer"), worldIds: ["developer"] }, mv: mv(mainId), lines: { [mainId]: [scene(mainId, "본선 장면")], other: [scene("other", "다른 길 장면")] }, active: "other" },
  );
}

for (const mainId of ["", "hired:0"]) {
  test(`본선 '${mainId}' 복원: 다시 돌지 않고, 다른 세계선을 열었어도 본선을 보여 준다`, async ({ page }) => {
    let calls = 0;
    await page.route("**/api/simulate", (r) => {
      calls++;
      return r.abort();
    });
    await page.route("**/api/judge", (r) => {
      calls++;
      return r.abort();
    });
    await seed(page, mainId, DEMO_PROFILE);
    await page.goto("/simulate");
    await expect(page.getByText("본선 장면")).toBeVisible();
    await expect(page.getByText("다른 길 장면")).toHaveCount(0);
    expect(calls).toBe(0);
    await expect(page.locator(".animate-rise, .animate-draw")).toHaveCount(0);
  });
}

test("내 기록이 있으면 예시 인물 시작 전에 묻고, 취소하면 그대로 남는다", async ({ page }) => {
  await seed(page, "", { ...DEMO_PROFILE, name: "내이름" });
  await page.goto("/");
  await expect(page.getByTestId("resume-banner").getByRole("link", { name: /이어서 하기/ })).toHaveAttribute("href", "/simulate");
  await page.getByRole("button", { name: "간호학과 3학년 예시로 보기" }).click();
  const dialog = page.getByRole("dialog", { name: "예시 인물로 새로 시작할까요?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "취소하고 기록 유지하기" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).name, K("profile"))).toBe("내이름");
  await page.getByRole("button", { name: "예시 인물로 바로 보기" }).click();
  await page.route("**/api/**", (r) => r.abort());
  await dialog.getByRole("button", { name: "예시 인물로 새로 시작하기" }).click();
  await expect(page).toHaveURL(/simulate/);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).name, K("profile"))).toBe(DEMO_PROFILE.name);
});

test("예시 인물 기록만 있으면 묻지 않는다", async ({ page }) => {
  await seed(page, "", DEMO_PROFILE);
  await page.goto("/");
  await page.route("**/api/**", (r) => r.abort());
  await page.getByRole("button", { name: "예시 인물로 바로 보기" }).click();
  await expect(page).toHaveURL(/simulate/);
});

test("진로는 하나씩 보고, 마지막에 한눈에 비교한다", async ({ page }) => {
  const stats = (gate: number, money: number) => ({ runs: 1000, gate: { label: "합격", share: gate, typicalMonth: 10 }, satisfiedShare: 60, stressedShare: 30, final: { money: { p10: 0, p50: money, p90: money } } });
  const world = (id: string, gate: number, money: number) => ({ ...mv("m"), worldId: id, stats: stats(gate, money) });
  const line = (id: string, title: string) => [{ ...scene("m", title), worldId: id }];
  await page.goto("/privacy");
  await page.evaluate(
    ({ K, profile, selection, mvs, lines, active }) => {
      for (const [k, v] of Object.entries({ profile, selection, multiverses: mvs, lines, active })) localStorage.setItem(`${K}${k}`, JSON.stringify(v));
    },
    {
      K: K(""),
      profile: DEMO_PROFILE,
      selection: { ...demoSelection("developer"), worldIds: ["developer", "civil-servant"] },
      mvs: { developer: world("developer", 86, 3625), "civil-servant": world("civil-servant", 41, 1333) },
      lines: { developer: { m: line("developer", "개발자 장면") }, "civil-servant": { m: line("civil-servant", "공무원 장면") } },
      active: { developer: "m", "civil-servant": "m" },
    },
  );
  await page.goto("/simulate");
  await expect(page.getByText("개발자 장면")).toBeVisible();
  await expect(page.getByText("공무원 장면")).toHaveCount(0);
  const compare = page.getByTestId("compare-all");
  await expect(compare.getByRole("row", { name: /합격·취업 86% 41%/ })).toBeVisible();
  await compare.getByRole("button", { name: /공무원/ }).click();
  await expect(page.getByText("공무원 장면")).toBeVisible();
  await expect(page.getByText("개발자 장면")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "9급 행정직 공무원" })).toHaveAttribute("aria-pressed", "true");
});

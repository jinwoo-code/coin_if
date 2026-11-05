// 표준 모드 끝까지(26화면): 성격 50(Mini-IPIP 20 + 나머지 30)·흥미 24·상황 질문 나머지·진로 구성 인터뷰 → '맞나요?' → 결과.
// 이야기 API는 가짜로 바꿔 AI를 부르지 않는다. 이야기 원문이 다른 API로 나가지 않는지도 본다.
import { expect, test } from "@playwright/test";
import { counter, EMPTY, mockStoryApis, next, pickAll, quickPart, savedProfile, watchOtherPosts } from "./helpers";

const SECRET = "보라색우산을들고다닌할머니"; // 원문에만 있는 말

test("표준 모드로 끝까지", async ({ page }) => {
  await mockStoryApis(page, { ...EMPTY, decisionStyle: { value: "impulsive", evidence: `${SECRET} 일단 해 보자`, confidence: 0.8 } });
  const others = watchOtherPosts(page);
  await page.goto("/interview");
  await quickPart(page, "표준", 26);

  // 경험(글)
  await expect(counter(page)).toHaveText("13/26");
  await page.locator("#answer").fill("동아리에서 앱을 만들어 봤어요");
  await page.locator("#answer").press("Enter");

  // 성격 나머지 30문항(10문항씩 3화면) → 흥미 24문항(8문항씩 3화면) → 상황 질문 나머지 9개(3화면)
  for (let k = 0; k < 9; k++) {
    await expect(counter(page)).toHaveText(`${14 + k}/26`);
    await pickAll(page, k < 6 ? 2 : 1);
    await next(page);
  }

  // 진로 구성 인터뷰 → '맞나요?'(가짜 값) → 신경 쓰이는 것
  await expect(counter(page)).toHaveText("23/26");
  await page.locator("#cci-c4").fill(`${SECRET} 일단 해 보자가 좌우명이에요`);
  await next(page);
  await page.getByRole("button", { name: "맞아요, 이대로 저장" }).click();
  await expect(counter(page)).toHaveText("26/26");
  await page.getByRole("button", { name: "건너뛰기" }).click();

  await expect(page.getByRole("heading", { name: "입력한 정보" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^6개 중 [0-6]개$/).first()).toBeVisible();
  await expect(page.getByText("이야기에서 확인한 값을 빼면")).toBeVisible();

  await page.getByRole("button", { name: "이대로 진로 고르기" }).click();
  await expect(page).toHaveURL(/\/choose/);
  await expect(page.getByRole("link", { name: /인생 이야기/ })).toBeVisible(); // 표준을 마치면 정밀로 이어 갈 수 있다

  const p = await savedProfile(page);
  expect(p.depthMode).toBe("standard");
  expect(Object.keys(p.answers.ipip)).toHaveLength(50);
  expect(Object.keys(p.answers.riasec)).toHaveLength(24);
  expect(Object.keys(p.answers.sjt)).toHaveLength(12);
  expect(Object.keys(p.holdoutPicks)).toHaveLength(6);
  expect(p.story.decisionStyle.value).toBe("impulsive");
  expect(p.storyRaw.cci.c4).toContain(SECRET);
  // 원문(과 그 인용)은 이야기 API 말고는 어디로도 안 나간다
  expect(others.filter((b) => b.includes(SECRET)).map((b) => b.split(" ")[0])).toEqual([]);
});

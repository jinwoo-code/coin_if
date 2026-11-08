// 빠르게 모드로 처음부터 진로 고르기까지(모바일 390px 근처), 그리고 한 달 체크인.
import { expect, test } from "@playwright/test";
import { counter, pickAll } from "./helpers";

test("빠르게 모드로 끝까지", async ({ page }) => {
  await page.goto("/interview");
  await expect(counter(page)).toHaveText("1/13");

  await page.getByRole("button", { name: "동의하고 시작" }).click();
  await page.getByPlaceholder("예: 김민준…").fill("테스트");
  await page.getByPlaceholder("예: 컴퓨터모바일융합과…").fill("경영학과");
  await page.getByRole("button", { name: "다음", exact: true }).click();

  // 깊이 고르기: 네 가지 모두 고를 수 있다
  await expect(page.getByRole("listitem").filter({ hasText: "정밀" })).toBeEnabled();
  await expect(page.getByRole("listitem").filter({ hasText: "계속 닮아 가기" })).toBeEnabled();
  await page.getByRole("listitem").filter({ hasText: "빠르게" }).click();

  await page.getByRole("button", { name: "바로 취업할지 공무원을 준비할지" }).click();
  // 스펙은 두 화면. 빠르게 테스트는 '나중에 채우기'로 넘어간다(표준·전체 흐름은 두 화면을 다 지난다)
  await expect(page.getByRole("button", { name: "다음: 자격증·경험" })).toBeVisible();
  await page.getByRole("button", { name: "나중에 채우기" }).click();
  for (const v of ["안정", "성장", "돈", "여유"]) await page.getByRole("button", { name: new RegExp(`^${v}`) }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();

  // 성격 10문항 → 생활 조건 → 성격 10문항
  await expect(counter(page)).toHaveText("6/13");
  await pickAll(page, 3);
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("button", { name: "이 조건으로 다음" }).click();
  await pickAll(page, 1);
  await page.getByRole("button", { name: "다음", exact: true }).click();

  // 상황 질문 3화면(학습용 6 + 채점용 3, 화면에서는 구분되지 않는다)
  for (let k = 0; k < 3; k++) {
    await expect(counter(page)).toHaveText(`${9 + k}/13`);
    await expect(page.getByRole("button", { name: /문항 남았어요/ })).toBeDisabled();
    await pickAll(page, 0);
    await page.getByRole("button", { name: "다음", exact: true }).click();
  }

  await expect(counter(page)).toHaveText("12/13");
  await page.getByRole("button", { name: "다음", exact: true }).click();

  // 결과: 입력한 정보 체크리스트와 분신 닮은 정도(채점용 3개 중 몇 개 맞혔는지), "정확도" 문구 없음
  await expect(page.getByRole("heading", { name: "입력한 정보" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/^3개 중 [0-3]개$/)).toBeVisible();
  await expect(page.getByText(/정확도|정밀도/)).toHaveCount(0);
  // 학교를 안 고르고 넘어갔으면 기본값(전문대)을 고른 것처럼 보이지 않는다
  await expect(page.getByText("아직 안 적음")).toBeVisible();
  await expect(page.getByText(/^전문대 /)).toHaveCount(0);
  // 안 적은 스펙은 어떤 기본값으로 계산했는지 알려 준다
  await expect(page.getByTestId("spec-notice")).toContainText("전문대 재학·1년 뒤 졸업 기준으로 계산했어요");
  await expect(page.getByTestId("spec-notice").getByRole("button", { name: /적으러 가기/ })).toBeVisible();
  await page.getByRole("button", { name: "이대로 진로 고르기" }).click();
  await expect(page).toHaveURL(/\/choose/);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:profile") ?? "null"));
  expect(saved.depthMode).toBe("quick");
  expect(saved.depth.spec).toBe(false); // 나중에 채우기: '더 정확하게 하기'에서 다시 묻는다
  expect(Object.keys(saved.answers.sjt)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
  expect(Object.keys(saved.holdoutPicks)).toHaveLength(3);
  expect(saved.holdout.ids).toHaveLength(6);
  expect(Object.keys(saved.holdoutPicks).every((id: string) => saved.holdout.ids.includes(id))).toBe(true);
  // 한 달이 지난 사람: 내 정보에서 체크인. 채점용 3개 + 실제 선택 1개를 고르면 본인 일치율과 분신 점수가 나온다
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("cr:v10:profile")!);
    localStorage.setItem("cr:v10:profile", JSON.stringify({ ...p, since: new Date(Date.now() - 31 * 864e5).toISOString() }));
  });
  await page.goto("/choose");
  await page.getByRole("link", { name: "내 정보" }).click();
  await expect(page.getByRole("link", { name: /더 정확하게 하기/ })).toBeVisible();
  await page.getByRole("link", { name: /한 달 체크인/ }).click();
  await pickAll(page, 0);
  await page.getByRole("button", { name: /성격 20문항도 다시 답하기/ }).click();
  await expect(page.getByRole("button", { name: /20문항 남았어요/ })).toBeDisabled();
  await page.getByRole("button", { name: "성격 문항은 빼기" }).click();
  await page.getByRole("button", { name: /성격 20문항도 다시 답하기/ }).click();
  await pickAll(page, 0);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("3개 중 3개").first()).toBeVisible();
  await expect(page.getByText("1. 성격 다시 재기")).toBeVisible();
  const big = await page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:profile") ?? "null").bigFive);
  await page.getByRole("button", { name: "이 차이만큼 내 성격 값 바꾸기" }).click();
  await expect(page.getByText(/바꿨어요/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:profile") ?? "null").bigFive)).not.toEqual(big);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("cr:v10:profile") ?? "null"));
  expect(after.checkins).toHaveLength(1);
  expect(after.checkins[0].demo).toBeFalsy();
  expect(after.corrections).toEqual([expect.objectContaining({ source: "checkin", to: "push" })]);
});

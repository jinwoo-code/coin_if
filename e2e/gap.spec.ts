import { expect, test } from "@playwright/test";

// 시연 인물로 리포트까지 가서 격차 칸과 모바일 넘침을 본다. AI 안 부름.
test("리포트에 필요한 것과 내 격차가 나온다", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 180_000 });
  await page.goto("/report");
  const dev = page.getByTestId("gap-developer");
  await expect(dev).toBeVisible({ timeout: 120_000 });
  await expect(dev.getByText("이미 가진 것")).toBeVisible();
  await expect(dev.getByText("공고 집계 없음(기관 키 필요)").first()).toBeVisible();
  await expect(dev.getByText(/시뮬레이션에서 \+\d+%p/).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("gap-civil-servant").getByText(/국어, 영어/)).toBeVisible();
  // 능력 묶음 답 → 격차 판정이 바뀐다
  const skills = page.getByTestId("skills-developer");
  const firstGroup = skills.locator("fieldset").first();
  await firstGroup.getByRole("button", { name: "할 줄 알아요" }).click();
  await expect(dev.getByText(/직접 답했어요/).first()).toBeVisible();
  // 공부 시간 효과 문구
  await expect(page.getByTestId("gap-civil-servant").getByText(/하루 공부를 2시간 늘렸을 때/).first()).toBeVisible({ timeout: 60_000 });
  // 시간 초과 → 기간 늘리기
  const plan = page.getByTestId("plan-developer");
  await plan.getByRole("spinbutton", { name: /주당 공부 시간/ }).fill("1");
  await expect(plan.getByText(/주 \d+시간이 필요한데 지금은 1시간이에요/)).toBeVisible();
  await plan.getByRole("button", { name: /기간을 \d+개월로 늘리기/ }).click();
  await expect(plan.getByText(/주 \d+시간이 필요한데/)).toHaveCount(0);
  await plan.getByRole("button", { name: "처음 일정으로" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-1280.png" });
});

test("전공이 다른 진로를 고르면 학과부터라고 알려 준다", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.goto("/choose");
  await page.getByRole("searchbox").or(page.getByPlaceholder(/검색|찾/)).first().fill("간호사");
  await page.getByRole("button", { name: /간호사/ }).first().click();
  await expect(page.getByTestId("retrain-note").getByText(/전공이 달라 학과부터 다녀야 해요/)).toBeVisible();
});

// 시연 인물 3개 진로의 일정: NCS 근거, 나중에 볼 자격, 뺀 자격. 스크린샷은 test-results/.
test("개발자·간호사·9급 일정과 NCS 근거가 나온다", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.goto("/choose");
  const search = page.getByRole("searchbox").or(page.getByPlaceholder(/검색|찾/)).first();
  for (const name of ["웹 백엔드 개발자", "9급 행정직 공무원", "간호사"]) {
    await search.fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
  }
  await page.getByRole("button", { name: /3개 진로를 .* 살아보기/ }).click({ timeout: 15_000 });
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && (localStorage.getItem(k) ?? "").includes("nurse")), null, { timeout: 300_000 });
  await page.goto("/report");
  const dev = page.getByTestId("gap-developer");
  await expect(dev).toBeVisible({ timeout: 120_000 });
  await expect(dev.getByText(/NCS 훈련 기준/).first()).toBeVisible();
  // 수행준거·공부 목록은 펼치면 보인다
  await dev.locator("details", { hasText: "직책 수준" }).first().locator("summary").click();
  await expect(dev.getByText("포트폴리오 체크리스트(수행준거)").first()).toBeVisible();
  await expect(dev.getByText(/공부 목록:/).first()).toBeVisible();
  await expect(page.getByTestId("later-developer")).toContainText("신입 뒤에 익힐 능력");
  await expect(page.getByTestId("later-certs-developer")).toContainText("기술사");
  const later = page.getByTestId("plan-later-developer");
  await expect(later).toContainText("MCSE");
  await later.locator("summary").click();
  const plan = page.getByTestId("plan-developer");
  await expect(plan.getByText("MCSE")).toHaveCount(1); // 접힌 칸에만
  await later.getByRole("listitem").filter({ hasText: "MCSE" }).getByRole("button", { name: "일정에 넣기" }).click();
  await expect(plan.getByText("MCSE")).toHaveCount(1);
  await expect(plan.locator("ol").getByText("MCSE")).toBeVisible();
  await plan.getByRole("button", { name: "처음 일정으로" }).click();
  await expect(plan.locator("ol").getByText("MCSE")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const id of ["developer", "nurse", "civil-servant"]) await page.getByTestId(`plan-${id}`).screenshot({ path: `test-results/plan-${id}-${w}.png` });
  }
});

// 증거물: 키 없이 규칙 예시, 고른 주제·체크 저장, 간호사 가정값, 시험형 모의고사. AI 안 부름.
test("증거물과 모의고사 기록이 저장된다", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.goto("/choose");
  const search = page.getByRole("searchbox").or(page.getByPlaceholder(/검색|찾/)).first();
  for (const name of ["웹 백엔드 개발자", "9급 행정직 공무원", "간호사"]) {
    await search.fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).first().click();
  }
  await page.getByRole("button", { name: /3개 진로를 .* 살아보기/ }).click({ timeout: 15_000 });
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && (localStorage.getItem(k) ?? "").includes("nurse")), null, { timeout: 300_000 });
  await page.goto("/report");
  const dev = page.getByTestId("evidence-developer");
  await expect(dev).toBeVisible({ timeout: 120_000 });
  await expect(dev.getByText(/공고 집계가 없어서/)).toBeVisible();
  await expect(dev.getByText(/NCS 수행준거/).first()).toBeVisible();

  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/evidence/topics")) sent.push(r.postData() ?? "");
  });
  await dev.getByRole("button", { name: /주제 제안받기/ }).click();
  await expect(dev.getByText(/AI 없이 만든 예시예요/).first()).toBeVisible();
  expect(sent.length).toBe(1);
  expect(sent[0]).not.toContain("storyRaw");

  const card = dev.locator('[data-testid^="evidence-card-"]').first();
  await card.getByRole("button", { name: /수업·알바·동아리/ }).click();
  await expect(card.getByRole("textbox", { name: "내 주제" })).toHaveValue(/수업·알바·동아리/);
  await card.getByRole("checkbox").first().check();
  await expect(card.getByText(/완성 기준 1\//)).toBeVisible();

  const nurse = page.getByTestId("evidence-nurse");
  await expect(nurse.getByText("실습 사례 보고서").first()).toBeVisible();
  await expect(nurse.getByText(/가정값\(팀이 정함\)/).first()).toBeVisible();

  const exam = page.getByTestId("evidence-civil-servant");
  await expect(exam.getByText(/포트폴리오 대신/)).toBeVisible();
  await expect(exam.getByRole("button", { name: /주제 제안받기/ })).toHaveCount(0);
  await exam.getByRole("spinbutton", { name: "국어" }).fill("85");
  await exam.getByRole("spinbutton", { name: "영어" }).fill("40");
  await exam.getByRole("button", { name: "점수 저장" }).click();
  await expect(page.getByTestId("weak-civil-servant").getByText(/약점: 영어 평균 40점/)).toBeVisible();
  await expect(page.getByTestId("weak-civil-servant").getByText(/약점: 국어/)).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const id of ["developer", "nurse", "civil-servant"]) await page.getByTestId(`evidence-${id}`).screenshot({ path: `test-results/evidence-${id}-${w}.png` });
  }

  await page.reload();
  const again = page.getByTestId("evidence-developer").locator('[data-testid^="evidence-card-"]').first();
  await expect(again.getByRole("textbox", { name: "내 주제" })).toHaveValue(/수업·알바·동아리/, { timeout: 120_000 });
  await expect(again.getByText(/완성 기준 1\//)).toBeVisible();
  await expect(page.getByTestId("weak-civil-servant").getByText(/약점: 영어 평균 40점/)).toBeVisible();
});

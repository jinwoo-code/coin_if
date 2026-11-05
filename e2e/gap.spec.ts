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
  // 계획 넣고 다시 살아 보기: Worker 계산, 전후 숫자, 가정값 표시, 계획을 고치면 다시 계산 안내
  const rerun = page.getByTestId("plan-rerun-developer");
  await rerun.getByRole("button", { name: "다시 살아 보기" }).click();
  await expect(rerun.getByText(/이 계획대로 하면 .+ 안에/)).toBeVisible({ timeout: 60_000 });
  await expect(rerun.getByText(/\d+%.*→.*\d+%/)).toBeVisible();
  await expect(rerun.getByText(/배수는 대부분 가정값/)).toBeVisible();
  await rerun.scrollIntoViewIfNeeded();
  await rerun.screenshot({ path: "test-results/plan-rerun-390.png" });
  await plan.getByRole("spinbutton", { name: /주당 공부 시간/ }).fill("40");
  await expect(rerun.getByText("계획이 바뀌었어요", { exact: false })).toBeVisible();
  await plan.getByRole("button", { name: "처음 일정으로" }).click();
  const cs = page.getByTestId("plan-rerun-civil-servant");
  await cs.getByRole("button", { name: "다시 살아 보기" }).click();
  await expect(cs.getByText(/시험형은 주당 공부 시간을 고치면 달라져요/)).toBeVisible({ timeout: 60_000 });
  // 합격자 평균 공부량 버튼 → 일정의 주당 시간이 공부 시간으로 들어가 전후가 달라진다
  await cs.getByRole("button", { name: /합격자 평균 공부량/ }).click();
  await expect(cs.getByText(/처음부터: 주당 공부 \d+시간 → 71시간/)).toBeVisible({ timeout: 60_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await plan.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/gap-1280.png" });
  await rerun.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/plan-rerun-1280.png" });
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
  await expect(dev.getByText(/NCS 수행준거 원문/).first()).toBeVisible();

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
  await expect(nurse.getByText("활력징후 측정")).toBeVisible();
  await expect(nurse.getByText("공식 항목")).toBeVisible();

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

test("간호학과 3학년 예시 인물로 간호사 리포트 전 과정이 나오고, 이번 주 할 일이 저장된다", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "간호학과 3학년 예시로 보기" }).click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 180_000 });
  await page.goto("/report");
  const gap = page.getByTestId("gap-nurse");
  await expect(gap).toBeVisible({ timeout: 120_000 });
  await expect(gap.getByText("필수 — 없으면 이 길로 갈 수 없어요").first()).toBeVisible();
  // 전공이 맞아 학과를 새로 안 다닌다
  await expect(page.getByTestId("plan-nurse").getByText("학과 다시 다니기")).toHaveCount(0);
  await expect(page.getByTestId("plan-nurse").getByText("학과 과정 마치기")).toBeVisible();
  await expect(page.getByTestId("evidence-nurse").getByText("활력징후 측정")).toBeVisible();
  const rerun = page.getByTestId("plan-rerun-nurse");
  await rerun.getByRole("button", { name: "다시 살아 보기" }).click();
  await expect(rerun.getByText(/이 계획대로 하면 .+ 안에/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("plan-extend-nurse")).toHaveCount(0);
  // WOOP 장애물의 근거
  await expect(page.getByTestId("woop-forks")).toContainText("자주 만난 갈림길");
  // 이번 주 할 일: 예시 하나 + 고치면 저장
  const week = page.getByTestId("week-plan");
  await expect(week.getByText("예시예요", { exact: false })).toHaveCount(1);
  await week.getByLabel("언제").first().fill("토요일 오전");
  await expect(week.getByText("예시예요", { exact: false })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("week-plan").getByLabel("언제").first()).toHaveValue("토요일 오전", { timeout: 60_000 });
  // 하단 고정 버튼이 맨 아래 내용을 가리지 않는다
  // 부드러운 스크롤과 늦게 늘어나는 내용 때문에 맨 아래에 닿을 때까지 다시 잰다.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
          const last = document.querySelector("main")!.lastElementChild!.getBoundingClientRect().bottom;
          const bar = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "sticky" && d.className.includes("bottom-0"))!.getBoundingClientRect().top;
          return last - bar;
        }),
      { timeout: 15_000 },
    )
    .toBeLessThanOrEqual(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await week.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/week-390.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await week.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/week-1280.png" });
});

test("예시 인물 김민준이 간호사를 고르면 0%에서 기간 늘리기 버튼이 뜬다", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.endsWith(":selection"))!;
    const v = JSON.parse(localStorage.getItem(k)!);
    localStorage.setItem(k, JSON.stringify({ ...v, worldIds: ["nurse", "civil-servant"], months: 36 }));
    Object.keys(localStorage).filter((x) => x.endsWith(":multiverses") || x.endsWith(":lines")).forEach((x) => localStorage.removeItem(x));
  });
  await page.goto("/simulate");
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && (localStorage.getItem(k) ?? "").includes("nurse")), null, { timeout: 180_000 });
  await page.goto("/report");
  const rerun = page.getByTestId("plan-rerun-nurse");
  await expect(rerun).toBeVisible({ timeout: 120_000 });
  await rerun.getByRole("button", { name: "다시 살아 보기" }).click();
  const extend = page.getByTestId("plan-extend-nurse");
  await expect(extend.getByText("기간을 늘려 볼까요?", { exact: false })).toBeVisible({ timeout: 60_000 });
  await extend.getByRole("button", { name: "5년으로 보기" }).click();
  await expect(rerun.getByText(/이 계획대로 하면 5년 안에/)).toBeVisible({ timeout: 60_000 });
  await expect(extend).toHaveCount(0);
});

test("상담사 공유: 미리 보기 → PDF 화면 → 링크 열기(AI 표시, 원문 없음) → 취소", async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "간호학과 3학년 예시로 보기" }).click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 180_000 });
  // 이야기 원문·문항별 답을 일부러 넣어 둔다
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.endsWith(":profile"))!;
    const p = JSON.parse(localStorage.getItem(k)!);
    p.storyRaw = { c1: { "0:a": "비밀원문문장입니다 절대 나가면 안 돼요" } };
    p.holdoutPicks = { s7: 2 };
    localStorage.setItem(k, JSON.stringify(p));
  });
  await page.goto("/report");
  await page.getByRole("button", { name: "상담사에게 공유" }).click();
  const panel = page.getByTestId("share-panel");
  await expect(panel.getByText("들어가지 않는 것")).toBeVisible();
  const make = panel.getByRole("button", { name: /읽기 전용 링크 만들기/ });
  await expect(make).toBeEnabled({ timeout: 120_000 });
  await panel.screenshot({ path: "test-results/share-390.png" });
  // PDF 화면
  const [print] = await Promise.all([context.waitForEvent("page"), panel.getByRole("button", { name: "PDF 내려받기" }).click()]);
  await expect(print.getByTestId("ai-notice")).toHaveText("AI로 만든 리포트입니다");
  await print.close();
  // 링크
  let sent = "";
  page.on("request", (r) => {
    if (r.url().endsWith("/api/share") && r.method() === "POST") sent = r.postData() ?? "";
  });
  await make.click();
  const link = page.getByTestId("share-links").getByRole("link").first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  expect(sent).not.toContain("비밀원문문장");
  expect(sent).not.toContain("holdoutPicks");
  expect(sent).not.toContain("experiences");
  const url = (await link.textContent())!;
  const viewer = await context.browser()!.newContext(); // 로그인·저장값 없는 사람
  const other = await viewer.newPage();
  await other.goto(url);
  await expect(other.getByTestId("ai-notice")).toHaveText("AI로 만든 리포트입니다");
  await expect(other.getByTestId("shared-report")).toContainText("간호사");
  const html = await other.content();
  expect(html).not.toContain("비밀원문문장");
  await other.screenshot({ path: "test-results/shared-390.png", fullPage: true });
  await other.setViewportSize({ width: 1280, height: 900 });
  await other.screenshot({ path: "test-results/shared-1280.png" });
  const over = await other.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
  // 취소하면 안 열린다
  await page.getByRole("button", { name: "링크 취소" }).click();
  await expect(panel.getByText("링크를 취소했어요")).toBeVisible();
  await other.reload();
  await expect(other.getByText("볼 수 없는 링크예요")).toBeVisible();
  await viewer.close();
});

test("무료는 미리 보기까지, 프리미엄을 열면 격차~실행 전체", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물/ }).first().click();
  await page.waitForURL(/simulate|multiverse/, { timeout: 60_000 });
  await page.waitForFunction(() => Object.keys(localStorage).some((k) => k.includes("multiverses") && localStorage.getItem(k) !== "null"), null, { timeout: 180_000 });
  // 시연 인물이 아닌 사람으로
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.endsWith(":profile"))!;
    localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)!), name: "파일럿학생" }));
  });
  await page.goto("/report");
  await expect(page.getByTestId("free-todos")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole("heading", { name: /WOOP|이번 주 실행 계획/ })).toBeVisible();
  const preview = page.getByTestId("premium-preview");
  await expect(preview.getByTestId("preview-goal")).toContainText(/목표: .+%/);
  await expect(preview.getByText("미리 보기 3개")).toBeVisible();
  await expect(page.getByTestId("plan-developer")).toHaveCount(0);
  await expect(page.getByTestId("evidence-developer")).toHaveCount(0);
  await expect(page.getByTestId("week-plan")).toHaveCount(0);
  await page.getByRole("button", { name: "상담사에게 공유" }).click();
  await expect(page.getByTestId("share-panel")).toHaveCount(0);
  await page.waitForTimeout(800);
  await preview.scrollIntoViewIfNeeded();
  await preview.screenshot({ path: "test-results/free-preview-390.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/free-1280.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  // 서버도 막는다: 로그인 안 한 사람의 주제 호출·공유 링크
  const topics = await page.request.post("/api/evidence/topics", { data: { world: "developer", cards: ["career-note"], person: { name: "파일럿학생", major: "컴퓨터" } } });
  expect(topics.status()).toBe(401);
  const link = await page.request.post("/api/share", { data: { report: { person: { name: "파일럿학생", major: "컴퓨터" }, worlds: [{ id: "x" }] } } });
  expect(link.status()).toBe(401);
  // 로그인 안 했으면 로그인으로
  const open = page.getByRole("button", { name: /프리미엄 리포트 열기/ });
  await expect(open).toContainText("토큰 5개");
  await page.route("**/api/report/premium", (r) => r.fulfill({ status: 200, json: { items: [], charged: true, unlimited: false, balance: 0 } }));
  await open.click();
  await expect(page.getByTestId("plan-developer")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("week-plan")).toBeVisible();
  await expect(page.getByTestId("premium-preview")).toHaveCount(0);
  // 넓은 비교 표가 화면을 밀면 안 된다
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/premium-open-390.png" });
  await page.getByRole("button", { name: "상담사에게 공유" }).click();
  await expect(page.getByTestId("share-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/premium-open-1280.png" });
});

// 전체 화면을 390px·1280px로 찍어 docs/screens/{폭}/에 둔다(UI·UX 점검용). 평소 테스트에서는 건너뛴다.
// 실행: DOCS_SCREENS=1 BASE_URL=https://coinif.vercel.app npx playwright test e2e/docs-screens.spec.ts
import { appendFileSync, mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { counter, next, pickAll, REMOTE, savedProfile, SIM_WAIT } from "./helpers";

const ROOT = process.env.SCREENS_OUT ?? "docs/screens";
// 전체 페이지를 찍으면 하단 고정 버튼이 본문 중간을 가리므로 사진에서만 흐름 안에 둔다.
const unstick = (page: Page) => page.addStyleTag({ content: ".fixed.bottom-0,.sticky.bottom-0{position:static!important}" });

for (const width of [390, 1280]) {
  test.describe(`${width}px`, () => {
    test.skip(!process.env.DOCS_SCREENS, "DOCS_SCREENS=1일 때만");
    test.use({ viewport: { width, height: width === 390 ? 844 : 800 }, deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768 });
    const dir = `${ROOT}/${width}`;
    const shot = async (page: Page, name: string, full = true) => {
      mkdirSync(dir, { recursive: true });
      if (full) await unstick(page);
      await page.waitForTimeout(400);
      if (process.env.TERMS_LOG) {
        const text = await page.evaluate(() => document.body.textContent ?? "");
        for (const m of text.matchAll(/.{0,25}(가정값|본선|신뢰구간|실시간 판단|시연용).{0,15}/g)) appendFileSync(process.env.TERMS_LOG, `${width} ${name}: ${m[0]}\n`);
      }
      await page.screenshot({ path: `${dir}/${name}.png`, fullPage: full });
    };

    test("파일럿 설문과 빠르게 검사", async ({ page }) => {
      test.setTimeout(420_000);
      await page.goto("/interview?pilot=1");
      await page.waitForURL(/pilot\/survey\?when=pre/, { timeout: 30_000 });
      await shot(page, "20-파일럿-동의");
      await page.getByRole("button", { name: "동의하고 시작" }).click();
      await page.getByRole("radio", { name: "별로 없어요" }).click();
      await page.locator("#survey-careers").fill("개발자, 공무원");
      await page.getByRole("radio", { name: "아니요, 없어요" }).click();
      await shot(page, "21-파일럿-시작-전-설문");
      await page.getByRole("button", { name: "다음" }).click();
      await page.waitForURL(/\/interview$/, { timeout: 30_000 });

      await shot(page, "22-검사-01-동의");
      await page.getByRole("button", { name: "동의하고 시작" }).click();
      await page.getByPlaceholder("예: 김민준…").fill("테스트");
      await page.getByPlaceholder("예: 컴퓨터모바일융합과…").fill("경영학과");
      await shot(page, "22-검사-02-기본");
      await next(page);
      await expect(page.getByRole("listitem").filter({ hasText: /^빠르게/ })).toBeVisible();
      await shot(page, "22-검사-03-깊이-고르기");
      await page.getByRole("listitem").filter({ hasText: /^빠르게/ }).click();
      await expect(page.getByRole("button", { name: "바로 취업할지 공무원을 준비할지" })).toBeVisible();
      await shot(page, "22-검사-04-고민");
      await page.getByRole("button", { name: "바로 취업할지 공무원을 준비할지" }).click();
      await expect(page.getByRole("button", { name: "이 스펙으로 다음" })).toBeVisible();
      await shot(page, "22-검사-05-스펙");
      await page.getByRole("button", { name: "이 스펙으로 다음" }).click();
      for (const v of ["안정", "성장", "돈", "여유"]) await page.getByRole("button", { name: new RegExp(`^${v}`) }).click();
      await shot(page, "22-검사-06-가치관");
      await next(page);
      await expect(counter(page)).toHaveText("6/13");
      await pickAll(page, 3);
      await shot(page, "22-검사-07-성격");
      await next(page);
      await expect(page.getByRole("button", { name: "이 조건으로 다음" })).toBeVisible();
      await shot(page, "22-검사-08-생활-조건");
      await page.getByRole("button", { name: "이 조건으로 다음" }).click();
      await pickAll(page, 1);
      await next(page);
      for (let k = 0; k < 3; k++) {
        await expect(counter(page)).toHaveText(`${9 + k}/13`);
        await pickAll(page, 0);
        if (k === 0) await shot(page, "22-검사-09-상황-질문");
        await next(page);
      }
      await expect(counter(page)).toHaveText("12/13");
      await shot(page, "22-검사-10-바라는-것");
      await next(page);
      const go = page.getByRole("button", { name: "이대로 진로 고르기" });
      await expect(go).toBeVisible({ timeout: 90_000 });
      await shot(page, "23-검사-결과");
      await go.click();
      await page.waitForURL(/\/choose/);
      await page.waitForTimeout(1500);
      await shot(page, "24-진로-고르기");
      await expect.poll(() => savedProfile(page).then((x) => x?.pilot?.survey?.pre?.confidence), { timeout: 30_000 }).toBe(2);
      await page.goto("/pilot");
      await page.waitForTimeout(1200);
      await shot(page, "25-파일럿-상황-질문");
      await page.goto("/pilot/survey?when=post");
      await page.getByRole("radio", { name: "꽤 있어요" }).click();
      await page.getByRole("radio", { name: "네, 있어요" }).click();
      await page.locator("#survey-changed").fill("공무원은 빼기로 했어요");
      await shot(page, "26-파일럿-마무리-설문");
    });

    test("첫 화면부터 리포트와 공유 링크까지", async ({ page, context }) => {
      test.setTimeout(REMOTE ? 1_200_000 : 400_000);
      await page.goto("/");
      await page.waitForTimeout(2500); // 노선 그려지는 효과
      await shot(page, "01-첫-화면");
      await page.getByRole("button", { name: "예시 인물로 바로 보기" }).click();
      await page.waitForURL(/simulate/);
      await page.waitForTimeout(4000);
      await shot(page, "02-시뮬레이션-진행-중", false);
      const toMap = page.getByRole("link", { name: /다른 세계선 보기/ });
      await toMap.waitFor({ timeout: SIM_WAIT });
      await shot(page, "03-시뮬레이션-첫-진로");
      await page.getByTestId("year").first().locator("summary").first().click();
      await page.getByTestId("event-detail").first().locator("summary").click();
      await shot(page, "03-2-시뮬레이션-연도-펼침");
      await page.getByRole("button", { name: "9급 행정직 공무원" }).click();
      await shot(page, "04-시뮬레이션-다른-진로");
      await page.getByTestId("compare-all").scrollIntoViewIfNeeded();
      await page.getByTestId("compare-all").screenshot({ path: `${dir}/05-시뮬레이션-한눈에-비교.png` });

      await page.goto("/multiverse?world=developer");
      await expect(page.getByText(/1,000번 중/).first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(6000);
      await shot(page, "06-세계선-지도");
      await page.locator('section[aria-labelledby="tree"] button').first().click();
      await page.waitForTimeout(3000);
      await shot(page, "07-세계선-열기", false);

      await page.goto("/talk?world=developer");
      await page.waitForTimeout(2500);
      await shot(page, "08-미래의-나와-대화");

      await page.goto("/report");
      await expect(page.getByTestId("fit-leader")).toBeVisible({ timeout: 150_000 });
      await page.waitForTimeout(8000);
      await shot(page, "09-리포트-예시-인물-전체");
      const open = page.getByRole("button", { name: /프리미엄 리포트 열기/ });
      await open.click();
      await expect(open).toHaveCount(0, { timeout: 150_000 });
      await page.waitForTimeout(1500);
      await shot(page, "10-리포트-프리미엄-연-뒤");

      await page.reload();
      await page.getByRole("button", { name: "상담사에게 공유" }).click();
      const panel = page.getByTestId("share-panel");
      const make = panel.getByRole("button", { name: /읽기 전용 링크 만들기/ });
      await expect(make).toBeEnabled({ timeout: 120_000 });
      await shot(page, "11-상담사-공유-패널", false);
      const [print] = await Promise.all([context.waitForEvent("page"), panel.getByRole("button", { name: "PDF 내려받기" }).click()]);
      await expect(print.getByTestId("ai-notice")).toBeVisible();
      await print.setViewportSize({ width, height: 800 });
      await print.waitForTimeout(800);
      await print.screenshot({ path: `${dir}/12-공유-PDF-화면.png`, fullPage: true });
      await print.close();
      await make.click();
      const link = page.getByTestId("share-links").getByRole("link").first();
      await expect(link).toBeVisible({ timeout: 30_000 });
      const url = (await link.textContent())!;
      const viewer = await page.context().browser()!.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
      const other = await viewer.newPage();
      await other.goto(url);
      await expect(other.getByTestId("ai-notice")).toBeVisible();
      await other.screenshot({ path: `${dir}/13-공유-링크.png`, fullPage: true });
      await page.getByRole("button", { name: "링크 취소" }).click();
      await expect(panel.getByText("링크를 취소했어요")).toBeVisible();
      await other.reload();
      await expect(other.getByText("볼 수 없는 링크예요")).toBeVisible();
      await other.screenshot({ path: `${dir}/14-공유-링크-취소됨.png` });
      await viewer.close();

      // 시연 인물이 아닌 사람이 보는 무료 리포트(같은 결과에 이름만 바꿈)
      await page.evaluate(() => {
        const k = Object.keys(localStorage).find((x) => x.endsWith(":profile"))!;
        localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k)!), name: "학생" }));
        const pk = Object.keys(localStorage).find((x) => x.endsWith(":premium"));
        if (pk) localStorage.removeItem(pk);
      });
      await page.goto("/report");
      await expect(page.getByTestId("premium-preview")).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(8000);
      await shot(page, "15-리포트-무료");

      await page.goto("/");
      await expect(page.getByTestId("resume-banner")).toBeVisible();
      await page.waitForTimeout(2500);
      await shot(page, "16-첫-화면-이어서-하기");
      await page.getByRole("button", { name: "예시 인물로 바로 보기" }).click();
      await shot(page, "17-예시-인물-확인-창", false);
      await page.getByRole("button", { name: "취소하고 기록 유지하기" }).click();

      for (const [name, route] of [
        ["30-내-이야기-인생-6장", "/story"],
        ["31-체크인", "/checkin"],
        ["32-실시간-판단", "/live"],
        ["33-가치관-검사", "/deepen"],
        ["34-로그인", "/login"],
        ["39-내-정보", "/me"],
        ["35-토큰-충전", "/tokens"],
        ["36-대학-초대코드", "/org"],
        ["37-개인정보-처리방침", "/privacy"],
        ["38-관리자-대시보드", "/admin"],
      ]) {
        await page.goto(route);
        await page.waitForTimeout(1800);
        await shot(page, name);
      }
    });
  });
}

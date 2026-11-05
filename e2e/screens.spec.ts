// 모든 화면을 390px·1280px로 찍고 넘침·빈 화면·404를 본다. 시연 인물 결과가 있는 상태. SCREENS_DIR에 사진과 report.json을 남긴다.
// 실행: SCREENS_DIR=폴더 npx playwright test e2e/screens.spec.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const DIR = process.env.SCREENS_DIR ?? "test-results/screens";
const ROUTES = ["/", "/admin", "/checkin", "/choose", "/counselor", "/deepen", "/interview", "/live", "/login", "/multiverse?world=developer", "/org", "/pilot", "/privacy", "/report", "/simulate", "/story", "/story/decisions", "/talk?world=developer", "/tokens", "/tokens/fail", "/tokens/success?paymentKey=x&orderId=x&amount=1", "/welcome"];

test("모든 화면 넘침 검사", async ({ page }) => {
  test.setTimeout(590_000);
  mkdirSync(DIR, { recursive: true });
  await page.route("**/api/pay/confirm", (r) => r.fulfill({ status: 400, json: { error: "테스트" } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /예시 인물로 바로 보기/ }).click();
  await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: 110_000 });
  await page.evaluate(() => localStorage.setItem("cr:v9:pilotInvite", "true"));

  const report: object[] = [];
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const route of ROUTES) {
      const res = await page.goto(route);
      await page.waitForTimeout(route.startsWith("/multiverse") || route.startsWith("/report") ? 6000 : 1500);
      const info = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const bad: string[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const s = getComputedStyle(el);
          if (s.visibility === "hidden" || s.position === "fixed") return;
          let scrolls = false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") scrolls = true;
          }
          if (!scrolls && (r.right > vw + 1 || r.left < -1)) bad.push(`${el.tagName}.${String(el.className).slice(0, 30)}: ${Math.round(r.right - vw)}px`);
          // 글자가 칸 밖으로 잘림
          if (el.children.length === 0 && el.textContent?.trim() && s.overflowX === "hidden" && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== "ellipsis") bad.push(`잘림 ${el.textContent.slice(0, 20)}`);
        });
        const small: string[] = [];
        document.querySelectorAll<HTMLElement>("main button, main a[href]").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height && r.height < 44 && !el.closest("p, li > span")) small.push((el.textContent ?? "").trim().slice(0, 16));
        });
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, bad: bad.slice(0, 4), text: (document.body.innerText ?? "").trim().length, small: small.slice(0, 5), path: location.pathname + location.search, title: document.querySelector("h1")?.textContent ?? "" };
      });
      const name = `${width}-${route.replace(/[/?&=]+/g, "_") || "home"}.png`;
      await page.screenshot({ path: join(DIR, name), fullPage: true });
      report.push({ width, route, status: res?.status(), ...info });
    }
  }
  writeFileSync(join(DIR, "report.json"), JSON.stringify(report, null, 1));
  expect(report.filter((r) => (r as { overflow: number }).overflow > 0).map((r) => `${(r as { route: string }).route}`)).toEqual([]);
});

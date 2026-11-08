// 글자 대비·크기 점검(보고만, 실패로 치지 않음). 시연 인물 결과가 있는 상태에서 주요 화면을 390px·1280px로 돌며
// 글자가 있는 요소마다 글자색과 실제 바탕색(반투명은 겹쳐 계산)의 대비, 글자 크기를 잰다.
// 실행: CONTRAST_OUT=폴더 npx playwright test e2e/contrast.spec.ts (CONTRAST_OUT이 없으면 건너뜀)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { SIM_WAIT, openDemo } from "./helpers";

const OUT = process.env.CONTRAST_OUT;
const ROUTES = ["/", "/interview", "/choose", "/simulate", "/multiverse?world=developer", "/multiverse?world=civil-servant", "/report", "/me", "/checkin", "/talk?world=developer", "/story", "/tokens"];

test("글자 대비·크기 점검", async ({ page }) => {
  test.skip(!OUT, "CONTRAST_OUT이 있을 때만");
  test.setTimeout(600_000);
  mkdirSync(OUT!, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openDemo(page);
  await page.getByRole("link", { name: /다른 갈래 길 보기/ }).waitFor({ timeout: SIM_WAIT });

  const rows: Record<string, unknown>[] = [];
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForTimeout(route.startsWith("/multiverse") || route.startsWith("/report") ? 6000 : 2000);
      // 접힌 내용도 보이게 연다(대비는 열렸을 때 본다)
      await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
      const found = await page.evaluate(() => {
        type RGBA = [number, number, number, number];
        const parse = (c: string): RGBA => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return [0, 0, 0, 0];
          const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
          return [p[0], p[1], p[2], p[3] ?? 1];
        };
        const over = (top: RGBA, under: RGBA): RGBA => {
          const a = top[3] + under[3] * (1 - top[3]);
          if (!a) return [0, 0, 0, 0];
          return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a) as RGBA;
        };
        const lum = (c: RGBA) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const bgOf = (el: Element | null): { c: RGBA; image: boolean } => {
          const layers: RGBA[] = [];
          let image = false;
          for (let e = el; e; e = e.parentElement) {
            const s = getComputedStyle(e);
            if (s.backgroundImage !== "none") image = true;
            const c = parse(s.backgroundColor);
            if (c[3] > 0) layers.push(c);
            if (c[3] >= 1) break;
          }
          let c: RGBA = [255, 255, 255, 1];
          for (const l of layers.reverse()) c = over(l, c);
          return { c, image };
        };
        const out: Record<string, unknown>[] = [];
        document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
          const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent!.trim()).map((n) => n.textContent!.trim()).join(" ");
          if (!own) return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const s = getComputedStyle(el);
          if (s.visibility === "hidden" || s.display === "none") return;
          let opacity = 1;
          for (let e: HTMLElement | null = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
          const fg = parse(s.color);
          fg[3] *= opacity;
          const bg = bgOf(el);
          const shown = over(fg, bg.c);
          const [hi, lo] = [lum(shown), lum(bg.c)].sort((a, b) => b - a);
          const ratio = (hi + 0.05) / (lo + 0.05);
          const size = parseFloat(s.fontSize);
          const bold = Number(s.fontWeight) >= 700;
          const disabled = !!el.closest("button:disabled, [aria-disabled=true]");
          out.push({ text: own.slice(0, 40), ratio: Math.round(ratio * 100) / 100, size, bold, color: s.color, bg: `rgb(${bg.c.slice(0, 3).map(Math.round).join(",")})`, opacity: Math.round(opacity * 100) / 100, image: bg.image, disabled, cls: String(el.className).slice(0, 60) });
        });
        return out;
      });
      for (const f of found) rows.push({ route, width, ...f });
    }
  }
  writeFileSync(join(OUT!, "contrast.json"), JSON.stringify(rows, null, 1));
});

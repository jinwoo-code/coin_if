// 휴대폰 시간 재기: 모바일 에뮬레이션(iPhone 13) + CPU 4배 감속으로 무거운 화면 계산을 잰다. 실제 폰이 아니라 이 컴퓨터를 4배 늦춘 값이다.
// CPU 감속은 화면 스레드에만 걸리고 Worker에는 안 걸릴 수 있어서, 'Worker 없이' 재면 화면 스레드에서 돌아 4배가 확실히 걸린다(그 값을 휴대폰 Worker 시간으로 본다).
// 실행: npm run build 뒤 npx tsx@4.19.2 --tsconfig tsconfig.json scripts/phone-timing.ts (빌드본을 포트 3100에 스스로 띄운다, AI 안 부름)
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, devices, type Page } from "@playwright/test";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const CPU = 4;
const world = (id: string) => JSON.parse(readFileSync(`data/worlds/${id}.json`, "utf8")) as { events: { id: string; choices: unknown[] }[] };
const W: Record<string, ReturnType<typeof world>> = { developer: world("developer"), marketer: world("marketer") };

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    const ok = await fetch(BASE).then((r) => r.ok).catch(() => false);
    if (ok) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버가 안 떴어요");
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

(async () => {
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env: { ...process.env, GEMINI_API_KEY: "", GEMINI_TIER: "" }, stdio: "ignore", detached: true });
  const rows: string[] = [];
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    await waitServer();

    async function open(worker: boolean, throttle: boolean) {
      const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL: BASE });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const w = window as unknown as { __long: number[] };
        w.__long = [];
        new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ entryTypes: ["longtask"] });
      });
      if (!worker) await page.addInitScript(() => void delete (window as unknown as { Worker?: unknown }).Worker);
      const cdp = await ctx.newCDPSession(page);
      if (throttle) await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
      return { ctx, page };
    }
    const longest = (page: Page) => page.evaluate(() => Math.max(0, ...(window as unknown as { __long: number[] }).__long));

    // 시연 인물 결과 만들기(서버 계산, 감속 안 걸림)
    async function prepare(page: Page, months: number) {
      await page.goto("/");
      await page.getByRole("button", { name: /예시 인물로 바로 보기/ }).click();
      await page.waitForURL(/simulate/);
      const started = Date.now();
      await page.evaluate((m) => {
        const s = JSON.parse(localStorage.getItem("cr:v10:selection")!);
        localStorage.setItem("cr:v10:selection", JSON.stringify({ ...s, months: m }));
      }, months);
      await page.reload();
      await page.getByRole("link", { name: /다른 세계선 보기/ }).waitFor({ timeout: 300_000 });
      return Date.now() - started;
    }

    // 1. 세계선 계산은 서버(/api/simulate). 휴대폰은 스트리밍만 받는다.
    for (const months of [36, 120]) {
      const { ctx, page } = await open(true, true);
      const ms = await prepare(page, months);
      rows.push(`| /simulate 끝까지(서버 계산 + 서술 목업, ${months}개월, 진로 2개) | 서버 | ${secs(ms)} | ${secs(await longest(page))} |`);
      // 2. 바꿀 수 있는 것
      for (const [label, worker] of [["Worker(감속이 안 걸릴 수 있음)", true], ["화면 스레드(4배 확실, 휴대폰 Worker 추정치)", false]] as const) {
        const state = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
        const b = await open(worker, true);
        await b.page.goto("/privacy");
        await b.page.evaluate((s) => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, v as string)), state);
        const t = Date.now();
        await b.page.goto("/multiverse?world=developer");
        await b.page.getByText("조건을 바꿔 가며 다시 살아보는 중").waitFor({ state: "attached", timeout: 60_000 }).catch(() => {});
        await b.page.getByText("조건을 바꿔 가며 다시 살아보는 중").waitFor({ state: "detached", timeout: 300_000 });
        rows.push(`| 바꿀 수 있는 것(진로 1개, ${months}개월) · ${label} | ${worker ? "Worker" : "화면"} | ${secs(Date.now() - t)} | ${secs(await longest(b.page))} |`);
        await b.ctx.close();
      }
      await ctx.close();
    }

    // 3. 실시간 판단 30번(AI는 가짜, 바로 답함). 판단 받을 때마다 다시 계산한다.
    for (const months of [36, 120]) {
      const { ctx, page } = await open(true, true);
      await page.route("**/api/judge", async (route) => {
        const b = route.request().postDataJSON();
        const n = W[b.worldId].events.find((e) => e.id === b.forkId)!.choices.length;
        await route.fulfill({ json: { entries: { now: { probs: Array(n).fill(1 / n), reasons: Array(n).fill("모은 돈이 적어서"), src: "ai" } }, src: "ai" } });
      });
      await page.goto("/");
      await page.evaluate((m) => {
        localStorage.setItem("cr:v10:profile", JSON.stringify({ name: "테스트", major: "경영학과" }));
        localStorage.setItem("cr:v10:selection", JSON.stringify({ worldIds: ["developer", "marketer"], months: m, startYm: "2026-12", mode: "live" }));
      }, months);
      let t = Date.now();
      await page.goto("/live");
      await page.getByRole("status").filter({ hasText: "다 살아봤어요" }).waitFor({ timeout: 600_000 });
      rows.push(`| 실시간 30번 × 진로 2개 끝까지(AI 가짜, ${months}개월) | 화면 | ${secs(Date.now() - t)} | ${secs(await longest(page))} |`);
      t = Date.now();
      await page.reload();
      await page.getByRole("status").filter({ hasText: "다 살아봤어요" }).waitFor({ timeout: 120_000 });
      rows.push(`| 끝난 실시간 다시 열기(${months}개월) | 화면 | ${secs(Date.now() - t)} | ${secs(await longest(page))} |`);
      t = Date.now();
      await page.getByRole("button", { name: /세계선 지도·대화·리포트에서 이어 보기/ }).click();
      await page.waitForURL(/multiverse/, { timeout: 300_000 });
      rows.push(`| 실시간 → 세계선 지도 잇기(1,000번 없을 때, Worker, ${months}개월) | Worker | ${secs(Date.now() - t)} | ${secs(await longest(page))} |`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server.pid) process.kill(-server.pid);
  }
  console.log("| 계산 | 어디서 | 걸린 시간 | 화면이 가장 오래 멈춘 시간 |\n|---|---|---|---|");
  console.log(rows.join("\n"));
})();

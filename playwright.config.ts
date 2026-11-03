// 화면 흐름 테스트. 실행: npx playwright test (개발 서버가 떠 있으면 그걸 쓰고, 없으면 띄운다)
// 배포 사이트 확인: BASE_URL=https://coinif.vercel.app npx playwright test (개발 서버를 띄우지 않는다)
// GEMINI_API_KEY가 있으면 요약에 AI를 한 번 부른다(실패해도 목업으로 끝까지 간다).
import { defineConfig, devices } from "@playwright/test";

const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  workers: 1, // 깔린 Chrome을 여러 개 동시에 띄우면 가끔 시작에서 멈춘다(browser.newContext 2분 초과)
  // 브라우저는 이 컴퓨터에 깔린 Chrome을 쓴다(Playwright 전용 Chromium 다운로드가 막히는 환경이 있어서)
  use: { baseURL: remote ?? "http://localhost:3000", ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" },
  webServer: remote ? undefined : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});

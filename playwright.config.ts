// 화면 흐름 테스트. 실행: npx playwright test (개발 서버가 떠 있으면 그걸 쓰고, 없으면 띄운다)
// 배포 사이트 확인: BASE_URL=https://coinif.vercel.app npx playwright test (개발 서버를 띄우지 않는다)
// AI는 기본으로 안 부른다(무료 키 하루 한도를 테스트가 쓰지 않게, 목업으로 끝까지 간다). 키로 돌리려면 E2E_REAL_AI=1, 틀린 키로 실제 실패를 보려면 E2E_BAD_KEY=1.
import { defineConfig, devices } from "@playwright/test";

const remote = process.env.BASE_URL;
// 개발 서버와 같은 플래그를 테스트도 보게 한다(flags.spec). 이미 있는 환경 변수는 덮어쓰지 않는다.
if (!remote) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // 파일이 없으면 기본값(전부 끔)
  }
  process.env.SHARE_MEMORY = "1"; // 공유 링크를 메모리에(실제 표 0007 없이 흐름을 본다)
  if (process.env.E2E_BAD_KEY) {
    process.env.GEMINI_API_KEY = "invalid-key-for-test";
    process.env.GEMINI_TIER = "";
  } else if (!process.env.E2E_REAL_AI) {
    process.env.GEMINI_API_KEY = ""; // Next는 이미 있는 환경 변수를 .env.local로 덮어쓰지 않는다
    process.env.GEMINI_TIER = "";
  }
}

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 }, // 개발 서버가 화면을 처음 컴파일할 때 5초를 넘긴다
  workers: 1, // 깔린 Chrome을 여러 개 동시에 띄우면 가끔 시작에서 멈춘다(browser.newContext 2분 초과)
  // 브라우저는 이 컴퓨터에 깔린 Chrome을 쓴다(Playwright 전용 Chromium 다운로드가 막히는 환경이 있어서)
  use: { baseURL: remote ?? "http://localhost:3000", ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" },
  webServer: remote ? undefined : { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});

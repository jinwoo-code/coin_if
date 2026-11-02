// 화면 흐름 테스트. 실행: npx playwright test (개발 서버가 떠 있으면 그걸 쓰고, 없으면 띄운다)
// GEMINI_API_KEY가 있으면 요약에 AI를 한 번 부른다(실패해도 목업으로 끝까지 간다).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  use: { baseURL: "http://localhost:3000", ...devices["iPhone 13"], browserName: "chromium" },
  webServer: { command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
});

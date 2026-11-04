// 기능 플래그: 꺼져 있으면(기본) 화면에 안 보이고 API는 404. 켜 놓고 돌리면 로그인 없는 응답(401)과 화면이 나오는지 본다.
import { expect, test } from "@playwright/test";

const on = (name: string) => process.env[name] === "1";

test("꺼진 기능은 화면과 API에서 안 보인다", async ({ page, request }) => {
  const counselor = on("NEXT_PUBLIC_FEATURE_COUNSELOR");
  const mail = on("NEXT_PUBLIC_FEATURE_CHECKIN_MAIL");
  const secret = { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "x"}` } };

  expect((await request.get("/api/counselor")).status()).toBe(counselor ? 401 : 404);
  expect((await request.get("/api/org/share")).status()).toBe(counselor ? 200 : 404);
  expect((await request.post("/api/org/share", { data: { on: true } })).status()).toBe(counselor ? 403 : 404);
  expect((await request.get("/api/cron/checkin", secret)).status()).toBe(mail ? 401 : 404);
  expect((await request.post("/api/live/refund", { data: {} })).status()).toBe(on("NEXT_PUBLIC_FEATURE_LIVE_REFUND") ? 400 : 404);
  expect((await page.goto("/counselor"))?.status()).toBe(counselor ? 200 : 404);

  await page.goto("/privacy");
  await expect(page.getByText("Vercel: 웹 서버")).toBeVisible();
  await expect(page.getByText(/Resend/)).toHaveCount(mail ? 1 : 0);
  await expect(page.getByText(/상담 선생님/)).toHaveCount(counselor ? 1 : 0);
});

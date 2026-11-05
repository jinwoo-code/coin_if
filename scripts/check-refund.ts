// 실시간 판단 토큰 돌려주기를 실제 DB에서 확인한다. 시연용 가상 학생의 원장에 테스트 행을 넣고, 돌려받은 뒤, 넣은 행을 지운다.
// 실행: npx tsx@4.19.2 --env-file=.env.local --tsconfig tsconfig.json scripts/check-refund.ts
// 로그인 쿠키가 필요한 라우트 대신, 라우트가 부르는 refundLive를 직접 부른다. 테스트 결제 충전은 결제창을 거치지 않고 topup 행으로 흉내 낸다.
import { createClient } from "@supabase/supabase-js";
import { DEMO_PROFILE } from "../lib/demo";
import { liveForkCount } from "../lib/live";
import { refundLive } from "../lib/live-refund";
import { getWorld } from "../lib/worlds";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const assert = (ok: boolean, msg: string) => {
  console.log(`${ok ? "통과" : "실패"}: ${msg}`);
  if (!ok) process.exitCode = 1;
};

void (async () => {
  const { data: demo, error } = await admin.from("profiles").select("user_id").eq("demo", true).limit(1).single();
  if (error || !demo) throw new Error(`가상 학생을 못 찾음: ${error?.message}`);
  const userId = demo.user_id as string;
  const key = `t${Date.now().toString(36)}`;
  const ref = `live_simulate:${userId}:${key}`;
  const input = { key, profile: DEMO_PROFILE, worldIds: ["developer", "civil-servant"], months: 36, startYm: "2026-12" };
  const total = input.worldIds.reduce((s, id) => s + liveForkCount(DEMO_PROFILE, getWorld(id), input.months, input.startYm), 0);
  const balance = async () => ((await admin.from("token_ledger").select("amount").eq("user_id", userId)).data ?? []).reduce((s, r) => s + (r.amount as number), 0);
  const refs = [`topup:${key}`, ref, `refund:${ref}`];
  const logTag = `check-refund-${key}`;
  const b0 = await balance();
  try {
    const put = await admin.from("token_ledger").insert([
      { user_id: userId, amount: 4, reason: "topup", ref: `topup:${key}` },
      { user_id: userId, amount: -4, reason: "live_simulate", ref },
    ]);
    if (put.error) throw new Error(put.error.message);
    // AI가 전체의 절반쯤 답하고 실패한 상황: 호출 기록을 그만큼 넣는다
    const calls = Math.floor(total / 2);
    const logs = await admin.from("usage_logs").insert(Array.from({ length: calls }, () => ({ user_id: userId, org_id: null, feature: "judge_live", model: logTag, input_tokens: 0, output_tokens: 0, cost_krw: 0 })));
    if (logs.error) throw new Error(logs.error.message);
    const expected = Math.floor(4 * (1 - calls / total));
    const got = await refundLive(admin, userId, input);
    assert(got === expected, `전체 ${total}곳 중 AI ${calls}곳이면 4토큰 중 ${expected}개 돌려줌(받은 값 ${got})`);
    const row = (await admin.from("token_ledger").select("amount, reason").eq("ref", `refund:${ref}`).maybeSingle()).data;
    assert(row?.amount === expected && row?.reason === "refund", `원장에 refund 행이 들어감(${JSON.stringify(row)})`);
    assert((await balance()) === b0 + expected, `잔액 = 처음 ${b0} + 충전 4 − 사용 4 + 반환 ${expected}`);
    const again = await refundLive(admin, userId, input);
    assert(again === 0, "같은 실행은 두 번 돌려주지 않음");
    const none = await refundLive(admin, userId, { ...input, key: `${key}x` });
    assert(none === 0, "뺀 적 없는 실행은 안 돌려줌");
  } finally {
    await admin.from("token_ledger").delete().in("ref", refs);
    await admin.from("usage_logs").delete().eq("model", logTag);
    assert((await balance()) === b0, "테스트 행을 지워 잔액이 처음과 같음");
  }
})();

// AI 원가 실측 표. usage_logs(실제 호출의 토큰 수)를 lib/pricing.ts 단가로 다시 계산한다(단가를 고치면 지난 기록도 새 단가로).
// 로그가 없으면 "실측 없음"만 출력한다. 추정값을 지어내지 않는다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/cost-report.ts [--days 30]
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Log = { user_id: string | null; feature: string; model: string; input_tokens: number; output_tokens: number; created_at: string };

const won = (n: number) => `${n.toFixed(n < 10 ? 2 : 1)}원`;
const pad = (s: string | number, n: number) => String(s).padStart(n);

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { costKrw, KRW_PER_USD, PRICES } = await import("../lib/pricing");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요해요.");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const i = process.argv.indexOf("--days");
  const days = i > 0 ? Number(process.argv[i + 1]) : 30;
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const logs: Log[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("usage_logs").select("user_id, feature, model, input_tokens, output_tokens, created_at").gte("created_at", since).order("id").range(from, from + 999);
    if (error) throw error;
    logs.push(...(data as Log[]));
    if (!data || data.length < 1000) break;
  }

  console.log(`AI 원가 실측 (최근 ${days}일, 환율 ${KRW_PER_USD}원/USD 가정, 단가 lib/pricing.ts)\n`);
  if (!logs.length) {
    console.log("실측 없음: usage_logs에 기록이 없어요. 앱에서 AI 기능을 써 본 뒤 다시 실행해 주세요.");
    return;
  }

  const unknown = new Set(logs.filter((l) => !PRICES[l.model]).map((l) => l.model));
  const cost = (l: Log) => costKrw(l.model, l.input_tokens, l.output_tokens) ?? 0;

  // 기능별
  const byFeature = new Map<string, Log[]>();
  for (const l of logs) byFeature.set(l.feature, [...(byFeature.get(l.feature) ?? []), l]);
  console.log("기능            호출   평균 입력   평균 출력   1회 평균 원가   합계");
  for (const [f, ls] of [...byFeature].sort((a, b) => b[1].length - a[1].length)) {
    const n = ls.length;
    const sum = ls.reduce((s, l) => s + cost(l), 0);
    const avgIn = Math.round(ls.reduce((s, l) => s + l.input_tokens, 0) / n);
    const avgOut = Math.round(ls.reduce((s, l) => s + l.output_tokens, 0) / n);
    console.log(`${f.padEnd(14)} ${pad(n, 5)} ${pad(avgIn, 10)} ${pad(avgOut, 10)} ${pad(won(sum / n), 14)} ${pad(won(sum), 9)}`);
  }

  // 학생 1명(로그인한 사람) 기준: 기간 안에 쓴 AI 원가 합계
  const byUser = new Map<string, number>();
  for (const l of logs) if (l.user_id) byUser.set(l.user_id, (byUser.get(l.user_id) ?? 0) + cost(l));
  const total = logs.reduce((s, l) => s + cost(l), 0);
  console.log(`\n전체 ${logs.length}회, 합계 ${won(total)}`);
  if (byUser.size) {
    const per = [...byUser.values()].sort((a, b) => a - b);
    const mid = per[Math.floor(per.length / 2)];
    console.log(`로그인한 학생 ${per.length}명: 1명당 가운데 값 ${won(mid)}, 평균 ${won(per.reduce((s, v) => s + v, 0) / per.length)}, 최대 ${won(per[per.length - 1])}`);
  } else {
    console.log("로그인한 학생의 기록이 없어 1명당 원가는 실측 없음(로그인 안 한 호출만 있음).");
  }
  if (unknown.size) console.log(`\n주의: 단가가 없는 모델 ${[...unknown].join(", ")}은 0원으로 셌어요. lib/pricing.ts에 추가해 주세요.`);
  const assumed = [...new Set(logs.map((l) => l.model))].filter((m) => PRICES[m]?.note.startsWith("가정값"));
  if (assumed.length) console.log(`주의: ${assumed.join(", ")}의 단가는 가정값(공식 가격표에 없음)이에요.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

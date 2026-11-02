// 시연용 가상 학생 30명을 '경기과기대 시범'(GTEC-DEMO)에 넣는다. 대학 대시보드가 비어 보이지 않게 하려는 것.
// - 시뮬레이션 숫자는 전부 엔진(buildMultiverse·levers)이 낸 값. AI는 부르지 않는다.
// - 가상 학생은 profiles.demo = true. 대시보드에 "시연용 가상 데이터"로 표시된다. 로그인할 수 없는 계정(비밀번호 없음)이다.
// 실행:   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/seed-demo.ts          (.env.local에 Supabase 키 3개 필요, Node 22+)
// 지우기: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/seed-demo.ts --remove
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const N = 30;
const DOMAIN = "demo.invalid"; // 메일이 갈 수 없는 예약 도메인
const email = (i: number) => `demo-student-${String(i + 1).padStart(2, "0")}@${DOMAIN}`;
// 전문대 학생이 많이 고를 법한 진로. 앞쪽일수록 자주 뽑힌다(5명 넘게 모이는 항목이 생기게).
const POOL = ["developer", "civil-servant", "data-analyst", "marketer", "app-dev", "security", "hr", "accountant"];

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { DEMO_PROFILE } = await import("../lib/demo");
  const { buildMultiverse, topLeverTitles } = await import("../lib/multiverse");
  const { seededRandom } = await import("../lib/engine");
  const { WORLDS } = await import("../lib/worlds");
  const { nextMonthYm } = await import("../lib/calendar");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요해요.");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 이미 있는 가상 학생
  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email?.endsWith(`@${DOMAIN}`)) existing.set(u.email, u.id);
    if (data.users.length < 200) break;
  }

  if (process.argv.includes("--remove")) {
    for (const [mail, id] of existing) {
      const { error } = await admin.auth.admin.deleteUser(id); // 프로필·시뮬레이션·원장은 cascade로 같이 지워진다
      console.log(error ? `실패 ${mail}: ${error.message}` : `지움 ${mail}`);
    }
    return;
  }

  const { data: org } = await admin.from("organizations").select("id, name").eq("invite_code", "GTEC-DEMO").single();
  if (!org) throw new Error("GTEC-DEMO 대학이 없어요. 0004_orgs.sql을 먼저 적용해 주세요.");

  const startYm = nextMonthYm();
  const months = 36;
  for (let i = 0; i < N; i++) {
    const rand = seededRandom(`seed-demo-${i}`);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
    // 예시 인물에서 조금씩 바꾼 가상 학생(성격·준비도·생활 조건)
    const values = [...DEMO_PROFILE.values].sort(() => rand() - 0.5);
    const profile = {
      ...DEMO_PROFILE,
      name: `가상 학생 ${i + 1}`,
      values,
      bigFive: Object.fromEntries(Object.entries(DEMO_PROFILE.bigFive).map(([k, v]) => [k, Math.min(5, Math.max(1, v + Math.round((rand() - 0.5) * 4) / 2))])) as unknown as typeof DEMO_PROFILE.bigFive,
      spec: { ...DEMO_PROFILE.spec, certs: rand() < 0.5 ? [] : DEMO_PROFILE.spec.certs, projects: Math.floor(rand() * 4), internMonths: rand() < 0.3 ? 3 : 0, gpa: Math.round((2.8 + rand() * 1.5) * 10) / 10 },
      readiness: { coding: Math.floor(rand() * 4) },
      life: { ...DEMO_PROFILE.life, savings: Math.round(rand() * 800), studyHours: 3 + Math.floor(rand() * 8), partTimeHours: pick([0, 8, 12, 20]) },
    };

    let userId = existing.get(email(i));
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email: email(i), email_confirm: true, user_metadata: { demo: true } });
      if (error) throw error;
      userId = data.user.id;
    }
    await admin.from("profiles").update({ data: profile, demo: true }).eq("user_id", userId);
    await admin.from("memberships").upsert({ user_id: userId, org_id: org.id, role: "student" }, { onConflict: "user_id,org_id" });

    // 진로 2개(앞쪽 진로가 더 자주 뽑히게 제곱 분포)
    const careers = new Set<string>();
    while (careers.size < 2) careers.add(POOL[Math.floor(rand() ** 1.6 * POOL.length)]);
    for (const career of careers) {
      const world = WORLDS.find((w) => w.id === career);
      if (!world) continue;
      const { mv } = buildMultiverse(profile, world, months, startYm);
      const levers = topLeverTitles(profile, world, months, startYm);
      const { error } = await admin.from("simulations").upsert(
        { user_id: userId, run_key: `seed-demo-${i}-${career}`, career, months, start_month: startYm, summary: mv, scenes: {}, levers },
        { onConflict: "user_id,run_key" },
      );
      if (error) throw error;
    }
    console.log(`${email(i)} → ${[...careers].join(", ")}`);
  }
  console.log(`\n${org.name}에 가상 학생 ${N}명을 넣었어요(시연용 가상 데이터).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

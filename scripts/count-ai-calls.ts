// 시연 점검용: 어떤 시각 이후 배포본이 AI를 몇 번 불렀는지(Supabase usage_logs, 기능별). 키 값은 찍지 않는다.
// npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/count-ai-calls.ts 2026-11-08T08:00:00Z
// 시각을 안 주면 최근 30분. 로그인 안 한 예시 인물 호출도 남는다(user 칸만 비어 있음).
const since = process.argv[2] ?? new Date(Date.now() - 30 * 60_000).toISOString();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !key) {
  console.log("NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 없어요(.env.local).");
  process.exit(1);
}
async function main() {
  const r = await fetch(`${url}/rest/v1/usage_logs?select=feature,model,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const rows = (await r.json()) as { feature: string; model: string; created_at: string }[];
  if (!Array.isArray(rows)) {
    console.log("읽기 실패", r.status);
    return;
  }
  const byFeature: Record<string, number> = {};
  for (const x of rows) byFeature[x.feature] = (byFeature[x.feature] ?? 0) + 1;
  console.log(`${since} 이후 AI 호출 ${rows.length}번`, JSON.stringify(byFeature));
  if (rows.length) console.log(`처음 ${rows[0].created_at}, 마지막 ${rows.at(-1)!.created_at}`);
}
main();

// 브라우저 저장(lib/store.ts) ↔ 계정. 로그인한 본인 행만 읽고 쓴다(RLS, anon 키 + 세션).
// GET: 동의 여부와 계정에 저장된 프로필·시뮬레이션. POST: 브라우저의 프로필·시뮬레이션을 올린다.
import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ user: null });
  const [{ data: prof }, { data: sims }] = await Promise.all([
    sb.from("profiles").select("data, consent_at, consent_version").eq("user_id", user.id).maybeSingle(),
    sb.from("simulations").select("run_key, career, months, start_month, summary, chosen_line, scenes, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  return NextResponse.json({
    user: { id: user.id, email: user.email },
    consented: Boolean(prof?.consent_at) && prof?.consent_version === CONSENT_VERSION,
    profile: prof?.data ?? null,
    simulations: sims ?? [],
  });
}

interface SimRow {
  run_key: string;
  career: string;
  months: number;
  start_month: string;
  summary: unknown;
  chosen_line: string | null;
  scenes: unknown;
}

export async function POST(req: Request) {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const { data: prof } = await sb.from("profiles").select("consent_at, consent_version").eq("user_id", user.id).maybeSingle();
  if (!prof?.consent_at || prof.consent_version !== CONSENT_VERSION) return NextResponse.json({ error: "동의가 필요해요" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { profile?: unknown; simulations?: SimRow[] } | null;
  if (!body) return NextResponse.json({ error: "형식이 맞지 않아요" }, { status: 400 });

  if (body.profile) {
    const { error } = await sb.from("profiles").update({ data: body.profile }).eq("user_id", user.id);
    if (error) console.error("[동기화 실패] profile", error.message);
  }
  const rows = (body.simulations ?? [])
    .filter((s) => s && typeof s.run_key === "string" && typeof s.career === "string" && Number.isFinite(s.months) && typeof s.start_month === "string")
    .slice(0, 10)
    .map((s) => ({ user_id: user.id, run_key: s.run_key, career: s.career, months: s.months, start_month: s.start_month, summary: s.summary, chosen_line: s.chosen_line ?? null, scenes: s.scenes ?? {} }));
  if (rows.length) {
    const { error } = await sb.from("simulations").upsert(rows, { onConflict: "user_id,run_key" });
    if (error) {
      console.error("[동기화 실패] simulations", error.message);
      return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}

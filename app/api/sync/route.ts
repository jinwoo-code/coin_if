// 브라우저 저장(lib/store.ts) ↔ 계정. 로그인한 본인 행만 읽고 쓴다(RLS, anon 키 + 세션).
// GET: 동의 여부와 계정에 저장된 프로필·시뮬레이션. POST: 브라우저의 프로필·시뮬레이션을 올린다. DELETE: '전체 지우기'.
import { NextResponse } from "next/server";
import { CONSENT_VERSION } from "@/lib/consent";
import { scrubStory } from "@/lib/story";
import { topLeverTitles } from "@/lib/multiverse";
import type { Profile } from "@/lib/types";
import { WORLDS } from "@/lib/worlds";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
    // 인생 이야기 원문·근거 인용은 서버에 저장하지 않는다(브라우저가 빼고 보내지만 여기서도 한 번 더 뺀다).
    const data = typeof body.profile === "object" ? scrubStory({ ...(body.profile as Record<string, unknown>), storyRaw: {} }) : body.profile;
    const { error } = await sb.from("profiles").update({ data }).eq("user_id", user.id);
    if (error) console.error("[동기화 실패] profile", error.message);
  }
  const rows = scrubStory(body.simulations ?? [])
    .filter((s) => s && typeof s.run_key === "string" && typeof s.career === "string" && Number.isFinite(s.months) && typeof s.start_month === "string")
    .slice(0, 10)
    .map((s) => ({ user_id: user.id, run_key: s.run_key, career: s.career, months: s.months, start_month: s.start_month, summary: s.summary, chosen_line: s.chosen_line ?? null, scenes: s.scenes ?? {} }));
  if (rows.length) {
    const { error } = await sb.from("simulations").upsert(rows, { onConflict: "user_id,run_key" });
    if (!error) await fillLevers(sb, user.id, body.profile as Profile | undefined);
    if (error) {
      console.error("[동기화 실패] simulations", error.message);
      return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}

// 대학 집계용 '바꿀 수 있는 것' 상위 3개. 아직 없는 행만 엔진으로 한 번 계산한다(같은 입력이면 같은 결과).
async function fillLevers(sb: NonNullable<ReturnType<typeof supabaseServer>>, userId: string, profile?: Profile) {
  if (!profile) return;
  const { data } = await sb.from("simulations").select("run_key, career, months, start_month").eq("user_id", userId).is("levers", null).limit(5);
  for (const s of data ?? []) {
    const world = WORLDS.find((w) => w.id === s.career);
    if (!world) continue;
    try {
      const levers = topLeverTitles(profile, world, s.months, s.start_month);
      await sb.from("simulations").update({ levers }).eq("user_id", userId).eq("run_key", s.run_key);
    } catch (e) {
      console.error("[바꿀 수 있는 것 계산 실패]", s.career, (e as Error).message);
    }
  }
}

// 전체 지우기: 로그인한 본인의 프로필 내용·시뮬레이션·대화를 지운다. 계정·동의·토큰 원장·결제 기록은 남긴다(결제 확인에 필요).
export async function DELETE() {
  const sb = supabaseServer();
  const user = await currentUser();
  if (!sb || !user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  // 대화(chats)는 사용자에게 쓰기 정책이 없어서 service role로, 본인 행만 지운다
  const chats = await supabaseAdmin()?.from("chats").delete().eq("user_id", user.id);
  const sims = await sb.from("simulations").delete().eq("user_id", user.id);
  const prof = await sb.from("profiles").update({ data: null }).eq("user_id", user.id);
  const err = chats?.error ?? sims.error ?? prof.error;
  if (err) {
    console.error("[전체 지우기 실패]", err.message);
    return NextResponse.json({ error: "지우지 못했어요" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// 체크인 메일(하루 한 번, vercel.json crons). 본인이 켠 사람에게만, 차례마다 한 통. 메일에 진로 결과나 답 내용을 넣지 않는다.
// RESEND_API_KEY가 없으면 보내지 않고 몇 명이 대상인지만 돌려준다. CRON_SECRET이 맞아야 돈다(Vercel Cron이 Bearer로 보낸다).
import { NextResponse } from "next/server";
import { FLAGS } from "@/lib/flags";
import { checkinMailRef } from "@/lib/ongoing";
import { normalizeProfile } from "@/lib/profile";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PER_RUN = 100;

export async function GET(req: Request) {
  if (!FLAGS.checkinMail) return NextResponse.json({ error: "지금은 꺼져 있어요" }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "권한이 없어요" }, { status: 401 });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "서버 설정이 없어요" }, { status: 503 });
  const { data: rows, error } = await admin.from("profiles").select("user_id, data").eq("demo", false).eq("data->>checkinMail", "true").limit(1000);
  if (error) return NextResponse.json({ error: "불러오지 못했어요" }, { status: 500 });

  const key = process.env.RESEND_API_KEY;
  const from = process.env.CHECKIN_MAIL_FROM;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://coinif.vercel.app";
  let due = 0;
  let sent = 0;
  for (const row of rows ?? []) {
    const ref = checkinMailRef(normalizeProfile({ name: "", ...(row.data as Partial<Profile>) } as Partial<Profile> & Pick<Profile, "name">));
    if (!ref) continue;
    const { data: done } = await admin.from("checkin_mail_log").select("ref").eq("user_id", row.user_id).eq("ref", ref).maybeSingle();
    if (done) continue;
    due++;
    if (!key || !from || sent >= MAX_PER_RUN) continue;
    const { data: u } = await admin.auth.admin.getUserById(row.user_id);
    const to = u?.user?.email;
    if (!to) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "If:Life: 한 달 체크인할 때예요",
        text: `한 달이 지났어요. 상황 질문 몇 개를 다시 답하면 분신이 나를 얼마나 닮았는지 볼 수 있어요.\n\n${site}/checkin\n\n그만 받으려면 같은 화면에서 '메일 끄기'를 누르세요.`,
      }),
    }).catch(() => null);
    if (!res?.ok) {
      console.error("[체크인 메일 실패]", res?.status);
      continue;
    }
    await admin.from("checkin_mail_log").insert({ user_id: row.user_id, ref });
    sent++;
  }
  return NextResponse.json({ due, sent, keyed: Boolean(key && from) });
}

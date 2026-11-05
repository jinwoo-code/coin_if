// 상담사 공유 링크 만들기·취소. 프리미엄을 연 사람(또는 시연 인물)만 만든다. 링크를 여는 쪽은 로그인이 필요 없다.
import { NextResponse } from "next/server";
import { isDemoPerson } from "@/lib/demo";
import { createShare, revokeShare } from "@/lib/share-store";
import { cleanShared } from "@/lib/shared-report";
import { currentUser } from "@/lib/supabase/server";
import { hasPremium } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > 200_000) return NextResponse.json({ error: "공유본이 너무 커요" }, { status: 413 });
  const report = cleanShared((JSON.parse(body || "null") as { report?: unknown } | null)?.report);
  if (!report) return NextResponse.json({ error: "요청이 잘못됐어요" }, { status: 400 });
  const user = await currentUser();
  if (!isDemoPerson(report.person)) {
    if (!user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    if (!(await hasPremium(user.id))) return NextResponse.json({ error: "프리미엄 리포트를 연 뒤에 공유할 수 있어요" }, { status: 402 });
  }
  const made = await createShare(report, user?.id ?? null);
  if (!made) return NextResponse.json({ error: "링크를 만들지 못했어요" }, { status: 503 });
  return NextResponse.json(made);
}

export async function DELETE(req: Request) {
  const { token, ownerKey } = (await req.json().catch(() => ({}))) as { token?: string; ownerKey?: string };
  if (!token || !ownerKey) return NextResponse.json({ error: "요청이 잘못됐어요" }, { status: 400 });
  return (await revokeShare(token, ownerKey)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "취소하지 못했어요" }, { status: 404 });
}

// 커리어넷 직업가치관검사(대학생·일반): GET은 문항, POST는 답을 제출하고 커리어넷 결과 페이지 주소를 돌려준다.
import { NextResponse } from "next/server";
import { hasCareernet, submitValues, valueQuestions, type ValuesSubmit } from "@/lib/careernet";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasCareernet()) return NextResponse.json({ available: false, items: [] });
  const items = await valueQuestions();
  return NextResponse.json({ available: Boolean(items), items: items ?? [] });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Partial<ValuesSubmit> | null;
  if (!b?.answers || (b.gender !== "남" && b.gender !== "여") || (b.target !== "대학생" && b.target !== "일반")) {
    return NextResponse.json({ error: "답이 모자라요." }, { status: 400 });
  }
  const r = await submitValues({
    answers: b.answers,
    gender: b.gender,
    target: b.target,
    grade: /^[1-6]$/.test(String(b.grade)) ? String(b.grade) : "1",
    startedAt: Number(b.startedAt) || Date.now(),
  });
  if (!r) return NextResponse.json({ error: "커리어넷에 제출하지 못했어요." }, { status: 502 });
  return NextResponse.json(r);
}

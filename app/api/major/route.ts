// 학과정보: 사용자가 쓴 전공 이름을 고용24 표준 학과명으로 바꿔서 진로 추천을 정확하게 한다.
import { NextResponse } from "next/server";
import { searchMajors } from "@/lib/work24";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/(학과|학부|전공|과)$/, "").trim();
  if (q.length < 2) return NextResponse.json({ names: [] });
  // 전체 이름으로 안 나오면 앞 두 글자로 다시 찾는다(예: 컴퓨터모바일융합 → 컴퓨터)
  const found = (await searchMajors(q)) ?? (await searchMajors(q.slice(0, 2))) ?? [];
  const names = Array.from(new Set(found.flatMap((m) => [m.name, m.detail]).filter(Boolean))).slice(0, 10);
  return NextResponse.json({ names });
}

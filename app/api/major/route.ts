// 학과정보: 사용자가 쓴 전공 이름을 고용24 표준 학과명으로 바꿔서 진로 추천을 정확하게 한다.
import { NextResponse } from "next/server";
import { searchMajors } from "@/lib/work24";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/(학과|학부|전공|과)$/, "").trim();
  if (q.length < 2) return NextResponse.json({ names: [] });
  // 전체 이름으로 안 나오면 앞 두 글자로 다시 찾는다(예: 컴퓨터모바일융합 → 컴퓨터)
  const found = (await searchMajors(q)) ?? (await searchMajors(q.slice(0, 2))) ?? [];
  // 표준 학과명(name)만 쓴다. detail은 그 아래 세부 학과(경영학과 → 경영정보학과·국제산업정보학과 …)라
  // 넣으면 '정보'가 개발자 전공 키워드와 겹쳐 경영학과에 개발자가 '내 전공 관련'으로 나왔다(사용성 점검 7번).
  // 검색은 세부 학과 이름에 낱말이 든 다른 학과도 준다(경영 → 사회복지학과·산업공학과). 이름이 내 전공과 같은 쪽만 쓴다.
  const base = (s = "") => s.replace(/\s/g, "").replace(/(학과|학부|전공|과)$/, "");
  const same = found.filter((m) => base(m.name) === q.replace(/\s/g, "") || base(m.detail) === q.replace(/\s/g, ""));
  const names = Array.from(new Set((same.length ? same : found).map((m) => m.name).filter(Boolean))).slice(0, 10);
  return NextResponse.json({ names });
}

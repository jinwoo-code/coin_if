// 고용24 내일배움카드 훈련과정 후보 3개(6개월 취업률 높은 순). 키가 없으면 available: false. 곧 열리는 과정은 취업률이 비어 있을 수 있다.
import { NextResponse } from "next/server";
import { hasWork24, trainingCourses } from "@/lib/work24";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 30);
  if (!q || !hasWork24("training")) return NextResponse.json({ available: false, items: [] });
  const res = await trainingCourses({ keyword: q, months: 3 });
  if (!res) return NextResponse.json({ available: false, items: [] });
  const seen = new Set<string>();
  const items = res.items
    .filter((c) => !seen.has(c.title) && Boolean(seen.add(c.title)))
    .toSorted((a, b) => (b.rate6 ?? -1) - (a.rate6 ?? -1))
    .slice(0, 3);
  return NextResponse.json({ available: true, items });
}

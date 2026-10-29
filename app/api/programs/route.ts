// 고용센터 구직자 취업역량 강화프로그램: 리포트의 '이번 주 할 일' 옆에 실제로 신청할 수 있는 프로그램을 보여 준다.
import { NextResponse } from "next/server";
import { centerPrograms, hasWork24 } from "@/lib/work24";

export async function GET(req: Request) {
  if (!hasWork24("program")) return NextResponse.json({ available: false, items: [] });
  const region = new URL(req.url).searchParams.get("region") ?? "";
  const all = (await centerPrograms(60)) ?? [];
  // 사는 곳 이름이 고용센터 이름에 들어간 것을 먼저
  const words = region === "경기·인천" ? ["경기", "인천", "수원", "성남", "고양", "부천", "안양", "의정부", "안산", "용인", "평택"] : region === "서울" ? ["서울"] : [];
  const near = all.filter((p) => words.some((w) => p.center?.includes(w)));
  return NextResponse.json({ available: true, items: (near.length ? near : all).slice(0, 4) });
}

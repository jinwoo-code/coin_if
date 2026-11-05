// 프리미엄 리포트 '필요한 것' 목록. 저장된 파일(scripts/build-requirements.ts)을 읽는다. family는 코드를 고르는 데만 쓰고 저장하지 않는다.
import { NextResponse } from "next/server";
import { ALL_WORLD_IDS, type MajorFamily } from "@/lib/job-codes";
import { POSTING_NONE } from "@/lib/requirements";
import { requirementsFor } from "@/lib/requirements-server";

const FAMILIES = ["인문", "사회", "자연"];

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const world = sp.get("world") ?? "";
  if (!ALL_WORLD_IDS.includes(world)) return NextResponse.json({ error: "없는 진로예요" }, { status: 404 });
  const f = sp.get("family") ?? "";
  const family = FAMILIES.includes(f) ? (f as MajorFamily) : null;
  return NextResponse.json({ ...(await requirementsFor(world, family)), postingNote: POSTING_NONE });
}

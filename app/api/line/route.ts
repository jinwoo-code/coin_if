// 다른 세계선 하나를 열어 본다: 대표 회차를 다시 굴리고(같은 시드 → 같은 결과) AI가 문장을 입힌다.
import { NextResponse } from "next/server";
import { buildMultiverse, replayLine } from "@/lib/multiverse";
import { normalizeProfile } from "@/lib/profile";
import { scenesOf } from "@/lib/scenes";
import { narrate } from "@/lib/sim";
import type { Profile, Selection } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

export async function POST(req: Request) {
  const body = (await req.json()) as { profile: Profile; selection: Selection; worldId: string; lineId: string };
  const profile = normalizeProfile(body.profile);
  const { months, startYm } = body.selection;
  const world = getWorld(body.worldId);
  const { mv } = buildMultiverse(profile, world, months, startYm);
  const line = mv.lines.find((l) => l.id === body.lineId);
  if (!line) return NextResponse.json({ error: "없는 세계선" }, { status: 404 });
  const path = replayLine(profile, world, months, startYm, line);
  const scenes = await narrate(profile, [world], scenesOf(world, path, line.id, months, startYm, mv.stats));
  return NextResponse.json({ scenes });
}

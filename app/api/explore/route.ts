// "이 갈림길에서 반대로 갔다면": 그 갈림길을 강제로 바꾼 100번을 새로 살아 보고, 대표 회차를 이야기로 보여 준다.
import { NextResponse } from "next/server";
import type { Force } from "@/lib/engine";
import { explore } from "@/lib/multiverse";
import { normalizeProfile } from "@/lib/profile";
import { scenesOf } from "@/lib/scenes";
import { narrate } from "@/lib/sim";
import type { Profile, Selection } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

export async function POST(req: Request) {
  const body = (await req.json()) as { profile: Profile; selection: Selection; worldId: string; force: Force };
  const profile = normalizeProfile(body.profile);
  const { months, startYm } = body.selection;
  const world = getWorld(body.worldId);
  const { stats, paths } = explore(profile, world, months, startYm, body.force);
  // 실제로 그 갈림길을 지난 회차 중 만족도가 가운데인 회차
  const hit = paths.filter((p) => p.months.some((m) => m.event?.id === body.force.eventId));
  const pool = hit.length ? hit : paths;
  const sorted = pool.toSorted((a, b) => a.final.satisfaction - b.final.satisfaction);
  const rep = sorted[Math.floor(sorted.length / 2)];
  const lineId = `explore:${body.force.eventId}:${body.force.choiceIndex ?? body.force.outcome}`;
  const scenes = await narrate(profile, [world], scenesOf(world, rep, lineId, months, startYm, stats));
  return NextResponse.json({ stats, scenes, reached: hit.length });
}

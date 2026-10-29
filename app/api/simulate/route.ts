// 시뮬레이션을 실시간으로 흘려보내는 API(Server-Sent Events).
// 1) 진로마다 100번 살아 보고 세계선 나무를 먼저 보내고 2) AI가 먼저 가는 본선을 역마다 하나씩 보낸다.
import { planStations } from "@/lib/calendar";
import { buildMultiverse, replayLine } from "@/lib/multiverse";
import { normalizeProfile } from "@/lib/profile";
import { scenesOf } from "@/lib/scenes";
import { memoriesOf, narrate } from "@/lib/sim";
import type { Profile, Selection, SimEvent } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

export const dynamic = "force-dynamic";
// 100번 돌리기 + AI 문장 스트리밍이 길어질 수 있다. Vercel 함수 최대 실행 시간(초). Fluid compute(새 프로젝트 기본값)면 Hobby도 300초까지 된다.
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json()) as { profile: Profile; selection: Selection };
  const profile = normalizeProfile(body.profile);
  const { worldIds, months, startYm } = body.selection;
  const worlds = worldIds.map(getWorld);
  const { labels } = planStations(months, startYm);

  const built = worlds.map((w) => buildMultiverse(profile, w, months, startYm).mv);
  const mains: Record<string, SimEvent[]> = {};
  built.forEach((mv, i) => {
    const line = mv.lines.find((l) => l.isMain)!;
    const path = replayLine(profile, worlds[i], months, startYm, line);
    mains[mv.worldId] = scenesOf(worlds[i], path, line.id, months, startYm, mv.stats);
  });

  const encoder = new TextEncoder();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      send({ type: "plan", labels, multiverses: built });
      const done: Record<string, SimEvent[]> = Object.fromEntries(worlds.map((w) => [w.id, []]));
      try {
        // 무료 키의 분당 호출 제한 때문에 4역씩, 모든 진로를 묶어서 부른다.
        for (let from = 0; from < labels.length; from += 4) {
          const chunk = worlds.flatMap((w) => mains[w.id].slice(from, from + 4));
          const memories = Object.fromEntries(worlds.map((w) => [w.id, memoriesOf(done[w.id])]));
          const told = await narrate(profile, worlds, chunk, memories);
          for (let st = from; st < Math.min(labels.length, from + 4); st++) {
            const events = told.filter((e) => e.station === st);
            events.forEach((e) => done[e.worldId].push(e));
            send({ type: "step", station: st, label: labels[st], events });
            await sleep(450);
          }
        }
        send({ type: "done", lines: done });
      } catch (err) {
        console.error(err);
        send({ type: "error", message: "시뮬레이션 중 문제가 생겼어요. 다시 살아보기를 눌러 주세요." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

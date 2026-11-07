// 비교 리포트 + WOOP 실행 계획 + 이번 주 할 일
import { NextResponse } from "next/server";
import { ruleOnly } from "@/lib/ai-guard";
import { generateJSON } from "@/lib/llm";
import { finalFit, getWorld, todoFor } from "@/lib/worlds";
import { won } from "@/lib/format";
import { iGa, waGwa } from "@/lib/josa";
import { obstacleUsesFork, ruleObstacle, shortText, topForks } from "@/lib/woop";
import type { Multiverse, Profile, Report, SimEvent } from "@/lib/types";

// "A와 B 중", "A, B와 C 중"
function wishOf(names: string[]) {
  if (names.length < 2) return `${iGa(names[0] ?? "고른 길")} 내게 맞는지 정하기`;
  const head = names.slice(0, -1).join(", ");
  return `${waGwa(head)} ${names.at(-1)} 중 내게 맞는 길을 정하기`;
}

export async function POST(req: Request) {
  const { profile, multiverses, scenes } = (await req.json()) as { profile: Profile; multiverses: Record<string, Multiverse>; scenes: Record<string, SimEvent[]> };
  const ids = Object.keys(multiverses);

  // 부합도는 AI가 아니라 코드로 계산한다(매번 같은 기준).
  // 한 번의 이야기가 아니라 1,000번 살아본 결과의 가운데 값으로 계산한다.
  const fits = Object.fromEntries(ids.map((id) => [id, finalFit(getWorld(id), profile, multiverses[id].stats)]));
  // 장애물은 이 사람의 시뮬레이션에서 자주 나온 갈림길에서 가져온다.
  const forks = topForks(multiverses);

  const fallback = (): Omit<Report, "worlds"> & { worlds: { worldId: string; good: string; hard: string }[] } => ({
    worlds: ids.map((id) => {
      const evs = (scenes[id] ?? []).filter((e) => e.eventId !== "quiet");
      const good = evs.filter((e) => e.kind === "good").map((e) => e.title);
      const hard = evs.filter((e) => e.kind === "bad").map((e) => e.title);
      return { worldId: id, good: good.slice(0, 2).join(", ") || "큰 굴곡 없이 적응했다", hard: hard.slice(0, 2).join(", ") || "뚜렷한 어려움은 없었다" };
    }),
    woop: {
      // 고민 글을 그대로 끼우면 문장이 깨진다("…모르겠어요 사이에서"). 고른 진로 이름으로 쓴다.
      wish: wishOf(ids.map((id) => getWorld(id).name)),
      outcome: "어느 쪽이든 후회 없이 선택했다고 말할 수 있는 상태",
      obstacle: ruleObstacle(forks, "막상 알아보려니 귀찮고, 거절당할까 봐 미루게 됨"),
      plan: "만약 이번 주 수요일 수업이 끝나면, 관심 있는 길의 현직자 1명에게 메시지를 보낸다",
    },
    todos: ids.map((id) => todoFor(getWorld(id))).slice(0, 3),
    example: { when: "수요일 수업 끝나고", where: "학교 도서관", what: todoFor(getWorld(ids[0])) },
  });

  const brief = ids.map((id) => ({
    worldId: id,
    path: getWorld(id).name,
    hundredRuns: {
      gate: multiverses[id].stats.gate,
      satisfiedShare: multiverses[id].stats.satisfiedShare,
      stressedShare: multiverses[id].stats.stressedShare,
      moneyMedian: won(multiverses[id].stats.final.money.p50),
      lines: multiverses[id].lines.slice(0, 4).map((l) => `${l.title} (${l.count}번, 만족 ${l.satisfiedShare}%)`),
    },
    mainLine: (scenes[id] ?? []).filter((e) => e.eventId !== "quiet").map((e) => `${e.label} ${e.title} → ${e.choice}`),
  }));

  const ai: ReturnType<typeof fallback> = ruleOnly(profile) ? fallback() : await generateJSON<ReturnType<typeof fallback>>({
    tag: "report",
    model: "smart",
    system:
      "너는 진로 상담사다. 시뮬레이션 결과를 정리하고, 효과가 검증된 WOOP 기법(소망-결과-장애물-계획)으로 실행 계획을 세운다. " +
      "한 길을 추천하지 않는다. 한국어로 짧고 구체적으로 쓴다.",
    prompt:
      `학생: ${profile.summary}\n고민: ${profile.dilemma}\n중요한 가치: ${profile.values.join(" > ")}\n현실 제약: ${profile.constraints}\n스펙: ${JSON.stringify(profile.spec)}\n생활 조건: ${JSON.stringify(profile.life)}\n` +
      `시뮬레이션 결과:\n${JSON.stringify(brief, null, 1)}\n` +
      `자주 만난 갈림길: ${forks.map((f) => `${f.worldName} '${f.label}' ${f.share}%`).join(", ") || "없음"}\n\n` +
      `JSON으로 답해라:\n{"worlds":[{"worldId","good": 이 길에서 좋았던 점 한 줄,"hard": 힘든 점 한 줄}],` +
      `"woop":{"wish","outcome","obstacle": 자주 만난 갈림길 이름을 그대로 넣어, 그 갈림길에서 이 학생을 흔들 마음속 걸림돌 한 문장,"plan": "만약 ~하면, ~한다" 형태로 이번 주에 할 수 있는 구체적 행동},` +
      `"todos": 이번 주에 할 수 있는 작은 실험 3개(각 20자 안팎),` +
      `"example":{"when": 언제(15자 안팎),"where": 어디서(15자 안팎),"what": todos 중 하나}}`,
    fallback,
  });

  const report: Report = {
    worlds: ids.map((id) => {
      const w = ai.worlds?.find((x) => x.worldId === id) ?? fallback().worlds.find((x) => x.worldId === id)!;
      return { worldId: id, fit: fits[id], good: w.good, hard: w.hard };
    }),
    woop: ai.woop ? { ...ai.woop, obstacle: obstacleUsesFork(ai.woop.obstacle ?? "", forks) ? ai.woop.obstacle : ruleObstacle(forks, ai.woop.obstacle ?? "") } : fallback().woop,
    todos: ai.todos?.length ? ai.todos.slice(0, 3) : fallback().todos,
    example: shortText(ai.example?.what, 60) ? { when: shortText(ai.example?.when), where: shortText(ai.example?.where), what: shortText(ai.example?.what, 60) } : fallback().example,
    woopForks: forks,
  };
  return NextResponse.json(report);
}

// 서버 전용: 세계선의 장면에 AI가 문장을 입힌다.
// 숫자(사건, 선택, 상태값)는 전부 규칙 엔진이 정했고, AI는 문장만 쓴다. 그래서 이야기와 통계가 어긋나지 않는다.
import { generateJSON } from "./llm";
import { badWords, PHASE_WORD, phaseOf, stripRoleTags } from "./narrate-check";
import type { Profile, SimEvent, WorldTemplate } from "./types";

function profileBrief(p: Profile): string {
  return [
    `이름: ${p.name}, 전공: ${p.major} (${p.spec.school} ${p.spec.status})`,
    `고민: ${p.dilemma}`,
    `경험: ${p.experiences}`,
    `현실 제약: ${p.constraints}, 사는 곳 ${p.life.region}, 한 달 생활비 ${p.life.livingCost}만원`,
    `중요한 가치(순서대로): ${p.values.join(" > ")}`,
    p.wants.hates.length ? `싫어하는 것: ${p.wants.hates.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

interface Beat {
  key: string;
  narration: string;
  choice: string;
}

const keyOf = (s: SimEvent) => `${s.worldId}|${s.lineId}|${s.station}`;

// 장면들에 문장을 입힌다(조용한 장면은 그대로). 한 번에 최대 16장면.
// feature는 원가 기록(usage_logs)에 남는 기능 이름: 처음 살아보기 simulate, 다른 세계선 열기 line, 갈림길 바꿔 보기 explore.
export async function narrate(profile: Profile, worlds: WorldTemplate[], scenes: SimEvent[], memories: Record<string, string[]> = {}, feature: "simulate" | "line" | "explore" = "simulate"): Promise<SimEvent[]> {
  const targets = scenes.filter((s) => s.eventId !== "quiet");
  if (targets.length === 0) return scenes;
  const out = new Map<string, Beat>();
  const worldOf = (s: SimEvent) => worlds.find((x) => x.id === s.worldId)!;
  // 장면 처지에 있을 수 있는 인물만 넘긴다(학생 장면에 입사 동기, 수험 장면에 민원인이 나오지 않게).
  const fitsOf = (s: SimEvent) => (n: WorldTemplate["npcs"][number]) => npcFits(worldOf(s), n, s);
  const ask = (chunk: SimEvent[], avoid: Record<string, string[]> = {}) =>
    generateJSON<Beat[]>({
      tag: `${feature} narrate x${chunk.length}`,
      model: "fast",
      system:
        "너는 진로 시뮬레이션의 이야기 작가다. 이미 정해진 사건과 주인공의 선택을 현실적인 문장으로 풀어 쓴다. " +
        "사건이나 선택, 숫자를 바꾸거나 새로 지어내지 않는다. 과장하지 말고 있을 법한 수준으로, 한국어로 쓴다. " +
        "주인공의 지금 처지(phase)를 반드시 지킨다: 학생·수험생·구직 중이면 직장·동료·상사·출근 이야기를 쓰지 않는다.",
      prompt:
        `주인공 정보:\n${profileBrief(profile)}\n\n` +
        `아래 각 항목에 대해 JSON 배열로 답해라. 각 원소는 {"key","narration","choice"}.\n` +
        `- narration: 1~2문장, 과거형. situation을 주인공의 경험·제약·처지(phase)가 묻어나게 다시 쓴다. people이 있으면 그중 한 명의 반응을 그 호칭 그대로 넣고(괄호나 관계 표시는 붙이지 않는다), people이 비어 있으면 다른 인물을 지어내지 않는다.\n` +
        `- avoid가 있으면 그 말을 쓰지 않는다(처지와 안 맞는 말).\n` +
        `- choice: decided(주인공이 실제로 한 선택)를 주인공 입장의 과거형 한 문장으로. 내용은 바꾸지 않는다.\n\n` +
        JSON.stringify(
          chunk.map((s) => {
            const w = worldOf(s);
            const status = s.eventStatus ?? s.status;
            return {
              key: keyOf(s),
              when: s.label,
              path: w.name,
              phase: `${PHASE_WORD[phaseOf(status)]} · ${status}`,
              people: w.npcs.filter(fitsOf(s)).map((n) => ({ 호칭: n.name, 성격: n.persona })),
              event: s.title,
              situation: s.narration,
              decided: s.choice,
              recent: (memories[s.worldId] ?? []).slice(-3),
              ...(avoid[keyOf(s)]?.length ? { avoid: avoid[keyOf(s)] } : {}),
            };
          }),
          null,
          1,
        ),
      fallback: () => [],
    });
  // 받은 문장을 다듬고 처지와 안 맞는 말이 있는지 본다. 걸리면 한 번 다시 쓰게 하고, 그래도 걸리면 원래 사건 글을 쓴다.
  const accept = (chunk: SimEvent[], beats: Beat[] | unknown) => {
    const bad: Record<string, string[]> = {};
    if (!Array.isArray(beats)) return bad;
    for (const b of beats as Beat[]) {
      const s = chunk.find((x) => keyOf(x) === b?.key);
      if (!s || typeof b.narration !== "string") continue;
      const narration = stripRoleTags(b.narration, worldOf(s));
      const hits = badWords(narration, s, worldOf(s), fitsOf(s));
      if (hits.length) bad[b.key] = hits;
      else out.set(b.key, { ...b, narration });
    }
    return bad;
  };
  let redone = 0;
  let dropped = 0;
  for (let i = 0; i < targets.length; i += 16) {
    const chunk = targets.slice(i, i + 16);
    const bad = accept(chunk, await ask(chunk));
    const again = chunk.filter((s) => bad[keyOf(s)]);
    if (again.length) {
      redone += again.length;
      const still = accept(again, await ask(again, bad));
      dropped += Object.keys(still).length;
    }
  }
  if (redone) console.log(`[서술] 처지와 안 맞는 말로 다시 쓴 장면 ${redone}개, 그래도 걸려 원래 글을 쓴 장면 ${dropped}개`);
  return scenes.map((s) => {
    const b = out.get(keyOf(s));
    return b ? { ...s, narration: b.narration || s.narration, choice: b.choice || s.choice } : s;
  });
}

export function memoriesOf(scenes: SimEvent[]) {
  return scenes.filter((s) => s.eventId !== "quiet").map((s) => `${s.label}: ${s.title}${s.choice ? `. ${s.choice}` : ""} (${s.status})`);
}

// 등장인물별 호출(기본 켬, NPC_AGENTS=0이면 끔): 큰 갈림길 장면에서 그 처지에 있을 수 있는 인물을 따로 불러 그 사람 입장의 한마디를 받는다. 값은 문장뿐이고 엔진 숫자에 안 들어간다.
// 호출 수 = 큰 갈림길 장면(한 삶에서 진로마다 최대 NPC_SCENES) × 인물(최대 NPC_PEOPLE). 진로 하나에 최대 6번.
export const npcAgentsOn = () => process.env.NPC_AGENTS !== "0";
export const NPC_SCENES = 3;
const NPC_PEOPLE = 2;

// 그 장면의 처지에 있을 수 있는 인물인가. 직장 사람은 일하는 동안만, 스터디원은 시험 준비하는 동안만, 창업 멘토·공동창업자는 창업 중에만.
export function npcFits(world: WorldTemplate, npc: WorldTemplate["npcs"][number], scene: SimEvent) {
  // 장면 칸이 1년이면 칸 끝의 처지와 사건 때 처지가 다르다. 사건이 일어난 달의 처지로 본다.
  const status = scene.eventStatus ?? scene.status;
  if (/고객|클라이언트|파트너/.test(npc.role)) return false; // 일로 만나는 바깥 사람은 내 진로 고민을 모른다
  const working = /개월차$/.test(status);
  if (npc.role === "수험 동료" || /스터디/.test(npc.name)) return !working && /수험|시험 준비/.test(status);
  if (world.archetype === "startup" && /멘토|공동창업/.test(npc.name)) return working || /창업 준비/.test(status);
  return working;
}

// 처지에 맞는 인물이 없는 장면은 건너뛴다(호출도 안 한다). used = 이 삶에서 진로마다 이미 인물을 부른 장면 수.
export function npcTargets(world: WorldTemplate, scenes: SimEvent[], used = 0) {
  return scenes
    .filter((s) => s.worldId === world.id && s.branch === "choice" && s.choice && world.npcs.some((n) => npcFits(world, n, s)))
    .slice(0, Math.max(0, NPC_SCENES - used))
    .flatMap((scene) =>
      world.npcs
        .filter((n) => npcFits(world, n, scene))
        .slice(0, NPC_PEOPLE)
        .map((npc) => ({ scene, npc })),
    );
}

export async function addReactions(profile: Profile, worlds: WorldTemplate[], scenes: SimEvent[], feature = "simulate", used: Record<string, number> = {}): Promise<SimEvent[]> {
  const jobs = worlds.flatMap((w) => {
    const targets = npcTargets(w, scenes, used[w.id] ?? 0);
    used[w.id] = (used[w.id] ?? 0) + new Set(targets.map((t) => t.scene)).size;
    return targets.map((t) => ({ ...t, world: w }));
  });
  if (!jobs.length) return scenes;
  const got = await Promise.all(
    jobs.map(async ({ scene, npc, world }) => {
      const r = await generateJSON<{ line?: unknown } | null>({
        tag: `${feature} npc`,
        model: "fast",
        system: `너는 진로 이야기 속 인물 '${npc.name}'(${npc.role})이다. 성격: ${npc.persona}. 주인공의 선택을 듣고 네 입장에서 한마디만 한다. 주인공의 지금 처지에서 나올 수 있는 말만 하고, 처지에 없는 직장·시험·일을 지어내지 않는다. 사건이나 선택을 바꾸지 않고, 숫자를 쓰지 않는다. 40자 안팎의 한국어 말투로 쓴다.`,
        prompt: `주인공: ${profile.name}, ${world.name} 진로, 지금 처지: ${scene.eventStatus ?? scene.status}\n일어난 일: ${scene.title}. ${scene.narration}\n주인공의 선택: ${scene.choice}\nJSON으로만 답해라: {"line": "한마디"}`,
        fallback: () => null,
      });
      const line = typeof r?.line === "string" ? r.line.trim() : "";
      return line && line.length <= 80 && !/\d/.test(line) ? { scene, reaction: { name: npc.name, role: npc.role, line } } : null;
    }),
  );
  const byScene = new Map<SimEvent, { name: string; role: string; line: string }[]>();
  for (const g of got) if (g) byScene.set(g.scene, [...(byScene.get(g.scene) ?? []), g.reaction]);
  return scenes.map((s) => (byScene.has(s) ? { ...s, reactions: byScene.get(s) } : s));
}

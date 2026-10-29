// 서버 전용: 세계선의 장면에 AI가 문장을 입힌다.
// 숫자(사건, 선택, 상태값)는 전부 규칙 엔진이 정했고, AI는 문장만 쓴다. 그래서 이야기와 통계가 어긋나지 않는다.
import { generateJSON } from "./llm";
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
export async function narrate(profile: Profile, worlds: WorldTemplate[], scenes: SimEvent[], memories: Record<string, string[]> = {}): Promise<SimEvent[]> {
  const targets = scenes.filter((s) => s.eventId !== "quiet");
  if (targets.length === 0) return scenes;
  const out = new Map<string, Beat>();
  for (let i = 0; i < targets.length; i += 16) {
    const chunk = targets.slice(i, i + 16);
    const beats = await generateJSON<Beat[]>({
      tag: `narrate x${chunk.length}`,
      model: "fast",
      system:
        "너는 진로 시뮬레이션의 이야기 작가다. 이미 정해진 사건과 주인공의 선택을 현실적인 문장으로 풀어 쓴다. " +
        "사건이나 선택, 숫자를 바꾸거나 새로 지어내지 않는다. 과장하지 말고 있을 법한 수준으로, 한국어로 쓴다.",
      prompt:
        `주인공 정보:\n${profileBrief(profile)}\n\n` +
        `아래 각 항목에 대해 JSON 배열로 답해라. 각 원소는 {"key","narration","choice"}.\n` +
        `- narration: 1~2문장, 과거형. situation을 주인공의 경험·제약·처지(status)가 묻어나게 다시 쓰고, people 중 한 명의 반응을 이름으로 넣는다.\n` +
        `- choice: decided(주인공이 실제로 한 선택)를 주인공 입장의 과거형 한 문장으로. 내용은 바꾸지 않는다.\n\n` +
        JSON.stringify(
          chunk.map((s) => {
            const w = worlds.find((x) => x.id === s.worldId)!;
            return {
              key: keyOf(s),
              when: s.label,
              path: w.name,
              status: s.status,
              people: w.npcs.map((n) => `${n.name}(${n.role}): ${n.persona}`),
              event: s.title,
              situation: s.narration,
              decided: s.choice,
              recent: (memories[s.worldId] ?? []).slice(-3),
            };
          }),
          null,
          1,
        ),
      fallback: () => [],
    });
    if (Array.isArray(beats)) beats.forEach((b) => b?.key && out.set(b.key, b));
  }
  return scenes.map((s) => {
    const b = out.get(keyOf(s));
    return b ? { ...s, narration: b.narration || s.narration, choice: b.choice || s.choice } : s;
  });
}

export function memoriesOf(scenes: SimEvent[]) {
  return scenes.filter((s) => s.eventId !== "quiet").map((s) => `${s.label}: ${s.title}${s.choice ? `. ${s.choice}` : ""} (${s.status})`);
}

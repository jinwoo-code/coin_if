// 프리미엄 리포트(5토큰, 로그인 필요). 같은 시뮬레이션 묶음이면 다시 열어도 다시 빼지 않는다.
// 숫자(세계선 비교 표, 바꿀 수 있는 것 전체)는 브라우저가 엔진으로 계산해 보여 주고,
// 여기서는 '그 길로 갈 것 같을 때 할 일' 문장만 AI가 쓴다. 상황은 엔진이 낸 세계선 중에서만 고른다.
import { NextResponse } from "next/server";
import { isDemoPerson } from "@/lib/demo";
import { ruleOnly } from "@/lib/ai-guard";
import { generateJSON } from "@/lib/llm";
import { paywall, spend } from "@/lib/tokens";
import type { Multiverse, PremiumItem, Profile, SimEvent } from "@/lib/types";
import { getWorld, todoFor } from "@/lib/worlds";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { profile, multiverses, scenes, runKeys } = (await req.json()) as {
    profile: Profile;
    multiverses: Record<string, Multiverse>;
    scenes: Record<string, SimEvent[]>;
    runKeys: string[];
  };
  const ids = Object.keys(multiverses);
  // 시연 인물은 로그인 없이 볼 수 있다(발표 백업). 그 밖에는 5토큰, 대학 계약이면 포함.
  const paid = isDemoPerson(profile) ? ({ ok: true, charged: false, unlimited: false, balance: 0 } as const) : await spend("premium_report", [...runKeys].sort().join("|"), { requireLogin: true });
  if (!paid.ok) return paywall(paid);

  // 진로마다 만족하며 끝난 비율이 가장 낮은 세계선 2개 = 막히는 길(엔진 값). 너무 드문 길(살아본 횟수의 3% 미만)과
  // 다른 진로로 갈아탄 길(그 뒤를 살아보지 않아 만족 비율이 의미 없음)은 뺀다.
  const stuck = ids.flatMap((id) =>
    multiverses[id].lines
      .filter((l) => l.count >= multiverses[id].stats.runs * 0.03 && !l.switched)
      .toSorted((a, b) => a.satisfiedShare - b.satisfiedShare)
      .slice(0, 2)
      .map((l) => ({ key: `${id}/${l.id}`, worldId: id, lineId: l.id, line: l.title, share: Math.round((l.count / multiverses[id].stats.runs) * 100), satisfied: l.satisfiedShare, stressed: l.stressedShare })),
  );

  // key = 진로/세계선(세계선 id는 진로가 달라도 겹칠 수 있다)
  const fallback = (): { items: { key: string; steps: string[] }[] } => ({
    items: stuck.map((s) => ({
      key: s.key,
      steps: [todoFor(getWorld(s.worldId)), "같은 길을 먼저 간 선배 1명에게 그때 어떻게 했는지 묻기", "한 달 뒤 조건을 바꿔 다시 살아보기"],
    })),
  });

  // 실패하면 generateJSON이 같은 rule 객체를 돌려준다. 그걸로 AI 문장인지 가린다.
  const rule = fallback();
  const ai: ReturnType<typeof fallback> = ruleOnly(profile) ? rule : await generateJSON<ReturnType<typeof fallback>>({
    tag: "premium_report",
    model: "smart",
    system:
      "너는 진로 상담사다. 시뮬레이션에서 학생이 자주 막힌 세계선마다, 그 길로 가고 있다고 느낄 때 할 수 있는 구체적 행동을 쓴다. " + "주어진 숫자를 바꾸거나 새 숫자를 만들지 않는다. 한 길을 추천하지 않는다. 한국어, 행동마다 30자 안팎.",
    prompt:
      `학생: ${profile.summary}\n중요한 가치: ${profile.values.join(" > ")}\n현실 제약: ${profile.constraints}\n` +
      `막힌 세계선(엔진 결과):\n${stuck.map((s) => `- [${s.key}] ${getWorld(s.worldId).name}: ${s.line} (살아본 횟수의 ${s.share}%, 만족 ${s.satisfied}%, 스트레스 높음 ${s.stressed}%)`).join("\n")}\n` +
      `이 학생이 본선에서 겪은 힘든 일:\n${ids.flatMap((id) => (scenes[id] ?? []).filter((e) => e.kind === "bad").map((e) => `- ${getWorld(id).short} ${e.label}: ${e.title}`)).join("\n")}\n\n` +
      `JSON으로 답해라: {"items":[{"key": 위 [ ] 안의 값 그대로, "steps": 할 일 3개}]}`,
    fallback: () => rule,
  });

  // AI가 {"items":[…]} 대신 배열만 줄 때가 있다(2026-11-07 실측). 둘 다 받는다.
  const aiItems = ai === rule ? [] : Array.isArray(ai) ? (ai as ReturnType<typeof fallback>["items"]) : (ai.items ?? []);
  const items: PremiumItem[] = stuck.map((s) => {
    const got = aiItems.find((x) => x?.key === s.key && Array.isArray(x.steps) && x.steps.length);
    const w = got ?? rule.items.find((x) => x.key === s.key)!;
    return { worldId: s.worldId, lineId: s.lineId, line: s.line, share: s.share, satisfied: s.satisfied, steps: w.steps.slice(0, 3), ai: !!got };
  });
  return NextResponse.json({ items, charged: paid.charged, unlimited: paid.unlimited, balance: paid.balance });
}

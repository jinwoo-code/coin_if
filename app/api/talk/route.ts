// '그때의 나'와 대화. 시뮬레이션 기억을 근거로, 사용자의 말투로 답한다.
import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/llm";
import { getWorld } from "@/lib/worlds";
import { memoriesOf } from "@/lib/sim";
import { won } from "@/lib/format";
import type { ChatMessage, Profile, SimEvent } from "@/lib/types";

// 위기 신호가 보이면 시뮬레이션 대신 도움받을 곳을 안내한다.
const CRISIS_WORDS = ["죽고 싶", "죽고싶", "자살", "자해", "사라지고 싶", "살기 싫"];
const CRISIS_REPLY =
  "지금 많이 힘든 것 같아. 이건 시뮬레이션 속 내가 답할 일이 아니라 진짜 사람이 함께 들어 줘야 하는 이야기야. " +
  "자살예방상담전화 109, 정신건강위기상담 1577-0199에 연락하면 24시간 이야기를 들어 줘. 학교 학생상담센터도 좋아.";

export async function POST(req: Request) {
  const { profile, worldId, scenes, lineTitle, months, history, message } = (await req.json()) as {
    profile: Profile;
    worldId: string;
    scenes: SimEvent[];
    lineTitle: string;
    months: number;
    history: ChatMessage[];
    message: string;
  };

  if (CRISIS_WORDS.some((w) => message.includes(w))) {
    return NextResponse.json({ reply: CRISIS_REPLY, memory: null, crisis: true });
  }

  const world = getWorld(worldId);
  const years = months >= 12 ? `${Math.round((months / 12) * 10) / 10}년` : `${months}개월`;

  const events = scenes.filter((e) => e.eventId !== "quiet");
  const last = scenes[scenes.length - 1];
  // 목업: 질문에 맞는 기억 하나를 골라 짧게 답한다.
  const fallback = () => {
    if (events.length === 0) return { reply: "기억이 아직 흐릿해. 시뮬레이션을 먼저 끝까지 살아 줘.", memory: null };
    const bads = events.filter((e) => e.kind === "bad");
    const goods = events.filter((e) => e.kind === "good");
    const bad = (bads.length ? bads : events).toSorted((a, b) => (b.delta.stress ?? 0) - (a.delta.stress ?? 0))[0];
    const good = (goods.length ? goods : events).filter((e) => e !== bad).toSorted((a, b) => (b.delta.satisfaction ?? 0) - (a.delta.satisfaction ?? 0))[0] ?? bad;
    const lastEv = events[events.length - 1];
    const memo = (e: typeof bad) => `${e.label}: ${e.title}`;
    if (/후회/.test(message))
      return {
        reply: `후회까진 아니야. ${bad.label}에 “${bad.title}” 때는 진짜 그만두고 싶었는데, ${good.label}에 “${good.title}” 일이 있어서 버텼어.`,
        memory: memo(bad),
      };
    if (/힘들|어려|최악/.test(message))
      return { reply: `${bad.label}에 “${bad.title}” 그때가 제일 힘들었어. 그때 내 선택은 “${bad.choice}”였고, 지금 생각하면 그게 최선이었는지는 잘 모르겠어.`, memory: memo(bad) };
    if (/돈|연봉|월급/.test(message))
      return { reply: `지금 모아 둔 돈은 ${won(last.state.money)} 정도야.${last.salary ? ` 연봉은 ${won(last.salary)}.` : " 아직 월급은 없어."} ${last.state.money < 0 ? "솔직히 빠듯해." : "넉넉하진 않아도 버틸 만해."}`, memory: null };
    return {
      reply: `가장 최근 큰일은 ${lastEv.label}에 “${lastEv.title}”였어. 그때 내 선택은 “${lastEv.choice}”였어. 지금은 ${last.status}. 너라면 어떻게 했을 것 같아?`,
      memory: memo(lastEv),
    };
  };

  const result = await generateJSON<{ reply: string; memory: string | null }>({
    tag: "talk",
    model: "smart",
    system:
      `너는 ${profile.name} 본인이다. 지금으로부터 ${years} 뒤, '${world.name}' 길을 실제로 걸어온 미래의 나로서 과거의 나와 대화한다. ` +
      `말투: ${profile.speechStyle}. 과거의 나에게 하듯 친근한 반말로 말한다. ` +
      `반드시 아래 기억에 있는 일만 근거로 말하고, 없는 사건을 지어내지 않는다. 2~4문장으로 솔직하게 답한다. ` +
      `이 길을 가라/가지 말라고 단정하지 않는다. 결정은 과거의 나에게 맡긴다.`,
    prompt:
      `나에 대한 정보: ${profile.summary}\n중요한 가치: ${profile.values.join(" > ")}\n` +
      `이 세계선: ${lineTitle}\n지금 처지: ${last?.status ?? ""}, 모은 돈 ${won(last?.state.money ?? 0)}, 연봉 ${last?.salary ? won(last.salary) : "없음"}, 만족도 ${last?.state.satisfaction ?? 0}/100, 스트레스 ${last?.state.stress ?? 0}/100\n` +
      `이 길에서 겪은 기억:\n${memoriesOf(scenes).map((m) => `- ${m}`).join("\n")}\n\n` +
      `지금까지 대화:\n${history.map((h) => `${h.role === "user" ? "과거의 나" : "미래의 나"}: ${h.text}`).join("\n")}\n` +
      `과거의 나: ${message}\n\n` +
      `JSON으로 답해라: {"reply": 답변, "memory": 답변에서 언급한 기억을 "시점: 사건" 형태로, 없으면 null}`,
    fallback,
  });

  return NextResponse.json(result);
}

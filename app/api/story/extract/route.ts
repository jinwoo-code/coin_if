// 인생 이야기 원문 → 구조화된 값(StorySignals). 처리만 하고 원문은 저장하지도, 로그에 남기지도 않는다.
// 뽑은 값은 화면에서 사용자가 확인한 것만 프로필에 들어간다. 근거가 원문에 없는 값은 lib/story.ts가 버린다.
import { NextResponse } from "next/server";
import { hasCrisis } from "@/lib/crisis";
import { generateJSON } from "@/lib/llm";
import { mockSignals, sanitizeSignals, VALUE_KEYS } from "@/lib/story";

const MAX = 4000; // 한 번에 받는 원문 길이(자)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { qa?: { q: string; a: string }[] } | null;
  const qa = (body?.qa ?? []).filter((x) => x && typeof x.q === "string" && typeof x.a === "string" && x.a.trim()).slice(0, 10);
  if (!qa.length) return NextResponse.json({ error: "답이 없어요" }, { status: 400 });
  const answers = qa.map((x) => x.a.trim()).join("\n").slice(0, MAX);
  const crisis = hasCrisis(answers);

  const raw = await generateJSON<unknown>({
    tag: "story extract",
    model: "smart",
    system:
      "너는 진로 상담 기록을 정리하는 사람이다. 학생이 직접 쓴 답에서 아래 값만 뽑는다. " +
      "근거(evidence)는 학생이 쓴 문장을 한 글자도 바꾸지 말고 짧게 그대로 옮긴다. 근거가 없으면 지어내지 말고 null(목록은 빈 배열)로 둔다. " +
      "짐작하지 않는다. 상처·건강 같은 민감한 내용은 값으로 만들지 않는다.",
    prompt:
      `학생의 답:\n${qa.map((x) => `Q. ${x.q}\nA. ${x.a.trim()}`).join("\n\n").slice(0, MAX + 1000)}\n\n` +
      "JSON으로 답해라:\n" +
      '{"decisionStyle": {"value": "impulsive"(일단 하고 봄)|"deliberate"(따져 보고 정함)|"follow"(주변 의견을 따름), "evidence": 인용, "confidence": 0~1} 또는 null,\n' +
      ' "persistence": {"value": 1~5(끝까지 해 낸 경험이 많을수록 큼), "evidence": 인용, "confidence": 0~1} 또는 null,\n' +
      ' "familyExpectation": {"value": "none"|"stable"(안정적인 일)|"specific"(특정 직업), "job": 특정 직업이면 그 이름, "strength": 1~5, "evidence": 인용} 또는 null,\n' +
      ' "regretType": {"value": "inaction"(안 해서 후회)|"action"(해서 후회)|"none", "evidence": 인용} 또는 null,\n' +
      ` "coreValues": [{"value": ${VALUE_KEYS.map((v) => `"${v}"`).join("|")} 중 하나, "evidence": 인용}] (최대 4개, 없으면 []),\n` +
      ' "runwayMonths": {"value": 집 지원 없이 버틸 수 있는 개월 수(학생이 직접 말한 경우만), "evidence": 인용} 또는 null}',
    fallback: () => mockSignals(answers),
  });

  return NextResponse.json({ signals: sanitizeSignals(raw, answers), crisis });
}

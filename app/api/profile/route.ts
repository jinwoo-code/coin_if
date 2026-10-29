// 인터뷰 답변 → 'AI가 이해한 나'(Profile)
import { NextResponse } from "next/server";
import { eulReul } from "@/lib/josa";
import { generateJSON } from "@/lib/llm";
import { normalizeProfile } from "@/lib/profile";
import type { Profile } from "@/lib/types";

export async function POST(req: Request) {
  const body = normalizeProfile((await req.json()) as Profile);
  const answers = `고민: ${body.dilemma}\n경험: ${body.experiences}\n현실 제약: ${body.constraints}`;

  const extra = await generateJSON<{ summary: string; speechStyle: string }>({
    tag: "profile",
    model: "smart",
    system: "너는 진로 상담사다. 학생의 답변을 읽고 그 사람을 짧고 따뜻하게 요약한다. 한국어로 쓴다.",
    prompt:
      `학생 이름: ${body.name}, 전공: ${body.major} (${body.spec.school} ${body.spec.status})\n중요한 가치: ${body.values.join(" > ")}\n` +
      `성격(1~5): ${JSON.stringify(body.bigFive)}\n행동 성향(1~5): ${JSON.stringify(body.behavior)}\n` +
      `생활 조건: 모은 돈 ${body.life.savings}만원, 매달 지원 ${body.life.support}만원, 하루 공부 가능 ${body.life.studyHours}시간, 주당 알바 ${body.life.partTimeHours}시간\n` +
      `싫은 것: ${body.wants.hates.join(", ") || "없음"}\n학생이 직접 쓴 답변:\n${answers}\n\n` +
      `JSON으로 답해라: {"summary": 이 학생을 2문장으로 요약(판단하지 말고 들은 대로), ` +
      `"speechStyle": 학생 답변의 말투 특징을 1문장으로(존댓말/반말, 문장 길이, 자주 쓰는 표현 등)}`,
    fallback: () => ({
      summary: `${eulReul(body.values[0])} 가장 중요하게 여기면서 “${body.dilemma}” 사이에서 고민하고 있어요.`,
      speechStyle: "짧고 솔직하게 말하고, 고민을 털어놓을 때는 반말을 섞는 편",
    }),
  });

  const profile: Profile = { ...body, summary: extra.summary, speechStyle: extra.speechStyle };
  return NextResponse.json(profile);
}

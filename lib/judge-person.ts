// AI 분신 판단에 주는 '이 사람' 설명(app/api/judge, scripts/compare-modes.ts). 확인한 값만(이야기 원문·근거 인용·채점용 답 없음).
// 고치면 JUDGE_PROMPT_VERSION(lib/judge.ts)을 올린다.
import norms from "@/data/norms.json";
import { LABEL, scrubStory } from "./story";
import type { Profile } from "./types";

const B5: Record<string, string> = { O: "개방성", C: "성실성", E: "외향성", A: "친화성", N: "신경성" };
const BH: Record<string, string> = { persistence: "끈기", risk: "위험 감수", coping: "스트레스 대처", social: "도움 청하기" };

export function personText(p: Profile) {
  const st = p.story ? scrubStory(p.story) : null;
  const lines = [
    `가치관(중요한 순서): ${p.values.join(" > ") || "안 고름"}`,
    `성격(1~5, 괄호는 비교 집단 평균): ${Object.entries(B5)
      .map(([k, n]) => `${n} ${p.bigFive[k as keyof typeof p.bigFive]}(${norms.bigFive.mean[k as keyof typeof norms.bigFive.mean]})`)
      .join(", ")}`,
    `상황 질문 성향(1~5, 괄호는 평균): ${Object.entries(BH)
      .map(([k, n]) => `${n} ${p.behavior[k as keyof typeof p.behavior]}(${norms.behavior.mean[k as keyof typeof norms.behavior.mean]})`)
      .join(", ")}`,
  ];
  if (p.wants?.hates?.length) lines.push(`싫은 것: ${p.wants.hates.join(", ")}`);
  lines.push(`모은 돈 ${p.life.savings}만원, 집 지원 월 ${p.life.support}만원, 생활비 월 ${p.life.livingCost}만원`);
  if (st?.decisionStyle) lines.push(`결정 방식(본인 확인): ${LABEL.decisionStyle[st.decisionStyle.value]}`);
  if (st?.familyExpectation)
    lines.push(
      `가족 기대(본인 확인): ${LABEL.familyExpectation[st.familyExpectation.value]}${st.familyExpectation.value === "specific" && st.familyExpectation.job ? `(${st.familyExpectation.job})` : ""}${st.familyExpectation.value !== "none" ? `, 신경 쓰는 정도 ${st.familyExpectation.strength}/5` : ""}`,
    );
  if (st?.regretType) lines.push(`후회(본인 확인): ${LABEL.regretType[st.regretType.value]}`);
  if (st?.coreValues?.length) lines.push(`이야기에서 드러난 핵심 가치: ${st.coreValues.map((c) => c.value).join(", ")}`);
  if (st?.runwayMonths) lines.push(`집 지원 없이 버틸 수 있는 기간: ${st.runwayMonths.value}개월`);
  const corr = (p.corrections ?? []).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.to]: (acc[c.to] ?? 0) + 1 }), {});
  if (Object.keys(corr).length)
    lines.push(
      `시뮬레이션에서 직접 고친 선택: ${Object.entries(corr)
        .map(([t, n]) => `${t === "push" ? "밀어붙이는 쪽" : t === "change" ? "바꾸는 쪽" : "신중한 쪽"} ${n}번`)
        .join(", ")}`,
    );
  if (p.summary) lines.push(`요약: ${p.summary}`);
  return lines.join("\n");
}

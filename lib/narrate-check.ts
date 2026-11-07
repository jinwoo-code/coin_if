// 서술 AI 문장이 그 장면의 처지와 맞는지 본다(코드 규칙, AI 안 씀).
// 처지는 엔진의 statusOf 글에서 나눈다: 재직 / 수험 / 학생 / 군 / 구직(그 밖).
import type { SimEvent, WorldTemplate } from "./types";

export type Phase = "재직" | "수험" | "학생" | "군" | "구직";

export function phaseOf(status: string): Phase {
  if (/개월차$/.test(status)) return "재직";
  if (/군 복무/.test(status)) return "군";
  if (/학교 다니며|학과 다시|졸업 앞두고/.test(status)) return "학생";
  if (/수험|시험 준비/.test(status)) return "수험";
  return "구직";
}

export const PHASE_WORD: Record<Phase, string> = {
  재직: "일하는 중(직장인)",
  수험: "시험 준비 중(수험생, 아직 합격 전)",
  학생: "학생(아직 졸업 전, 직장 없음)",
  군: "군 복무 중",
  구직: "직장 없이 준비·구직 중",
};

// 일하지 않는 처지에서 나오면 안 되는 말. 재직이 아닌데 동료·상사·출근이 나오면 '학생 장면의 입사 동기' 같은 모순이 된다.
const WORK_ONLY = ["입사 동기", "직장 동료", "팀장", "차장", "실장", "반장", "수간호사", "주무관", "사수", "출근", "퇴근", "근무 중", "민원인"];

// 이 장면에 나올 수 있는 인물(엔진 처지 기준). sim.ts의 npcFits와 같은 규칙을 쓰려고 받아 온다.
export function badWords(text: string, scene: SimEvent, world: WorldTemplate, fits: (npc: WorldTemplate["npcs"][number]) => boolean, original = scene.narration): string[] {
  const phase = phaseOf(scene.eventStatus ?? scene.status);
  const hits = new Set<string>();
  // 처지에 없는 인물의 이름
  // 일로 만나는 바깥 사람(고객·민원인 등)은 따로 부르지는 않지만 일하는 장면에는 나와도 된다.
  const outside = (role: string) => /고객|클라이언트|파트너/.test(role);
  for (const n of world.npcs) if (!fits(n) && !(phase === "재직" && outside(n.role)) && n.name.length >= 2 && text.includes(n.name)) hits.add(n.name);
  // 일하는 처지가 아니면 직장 말. 단, 사건 원문(엔진이 정한 글)에 이미 있는 말은 허용한다(예: 합격 장면의 '첫 출근').
  if (phase !== "재직") for (const w of WORK_ONLY) if (text.includes(w) && !scene.title.includes(w) && !original.includes(w)) hits.add(w);
  return [...hits];
}

// 인물 이름 뒤에 붙은 역할 표시 '(동료)', '(선배)' 같은 괄호를 지운다. AI가 입력 형식을 그대로 옮겨 쓸 때가 있다.
export function stripRoleTags(text: string, world: WorldTemplate) {
  const roles = [...new Set(world.npcs.map((n) => n.role))].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!roles.length) return text;
  return text.replace(new RegExp(`\\s?\\((?:${roles.join("|")})\\)`, "g"), "");
}

// 장면 안 같은 문장 되풀이 지우기. AI가 다시 쓴 문장 뒤에 사건 원문을 한 번 더 붙일 때가 있다
// ('…2주 단위 개발이 이어졌다고 말했다. 큰 사고 없이 2주 단위 개발이 이어졌다.').
// 앞 문장과 글자 두 개씩 묶음이 60% 넘게 겹치는 뒤 문장을 뺀다(기준 0.6은 가정값, 낱말 비교라 다른 표현은 못 잡음).
export function sentencesOf(text: string) {
  return (text.match(/[^.!?。]+[.!?。]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
}
const bigrams = (s: string) => {
  const t = s.replace(/[\s.,!?'"“”‘’·…]/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};
export function overlap(a: string, b: string) {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const g of x) if (y.has(g)) n++;
  return n / Math.min(x.size, y.size);
}
export const DUP_OVERLAP = 0.6;
export function duplicateSentences(text: string) {
  const ss = sentencesOf(text);
  const dup: number[] = [];
  ss.forEach((s, i) => {
    if (ss.slice(0, i).some((t, j) => !dup.includes(j) && overlap(s, t) >= DUP_OVERLAP)) dup.push(i);
  });
  return dup;
}
export function dropDuplicateSentences(text: string) {
  const dup = duplicateSentences(text);
  if (!dup.length) return text;
  return sentencesOf(text)
    .filter((_, i) => !dup.includes(i))
    .join(" ");
}

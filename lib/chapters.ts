// 정밀 단계: 인생 이야기 6장. docs/검사-설계-근거.md '검사 깊이'·'인생 이야기'.
// 장마다 시작 질문 2개, 답 하나에 AI 꼬리 질문 최대 2개(/api/story/followup). 답할 때마다 이 기기에 저장해서 나갔다 와도 이어서 한다.
// 원문은 profile.storyRaw[장 id]에만(이 기기). 장이 끝나면 /api/story/extract로 값을 뽑고 '맞나요?'에서 확인한 값만 profile.story에 합친다.
import type { Profile } from "./types";

export const MAX_FOLLOWS = 2;

export const CHAPTERS: { id: string; title: string; starts: string[] }[] = [
  { id: "childhood", title: "어린 시절", starts: ["어릴 때 시간 가는 줄 모르고 했던 게 뭐예요?", "어릴 때 어른들한테 자주 들은 말이 있어요?"] },
  { id: "school", title: "학창 시절", starts: ["학교 다닐 때 끝까지 해 본 것과 중간에 그만둔 게 있어요?", "그때 진로는 어떻게 정했어요?"] },
  { id: "family", title: "가족과 집", starts: ["가족은 내 진로에 대해 뭐라고 해요?", "집에서 생활비를 언제까지, 어느 정도 지원받을 수 있어요? 말하기 싫으면 넘어가도 돼요."] },
  { id: "work", title: "일·알바·동아리", starts: ["해 본 알바나 동아리, 프로젝트 중 기억에 남는 게 뭐예요?", "그 일이 힘들었던 순간엔 어떻게 했어요?"] },
  { id: "decisions", title: "큰 결정과 후회", starts: ["지금까지 내린 가장 큰 결정은 뭐였고, 어떻게 정했어요?", "가장 후회하는 선택이 있어요? 해서 후회한 것도, 안 해서 후회한 것도 좋아요."] },
  { id: "future", title: "가치관과 미래", starts: ["10년 뒤 어떤 하루를 보내고 있으면 좋겠어요?", "일을 고를 때 절대 포기할 수 없는 게 하나 있다면요?"] },
];

// 한 장의 대화. 저장은 storyRaw[장 id]에 `${i}:q`, `${i}:a`, `${i}:f`(꼬리 질문이면 "1"), `${i}:s`(넘어감이면 "1"), done("1").
export interface Turn {
  q: string;
  a: string;
  follow: boolean;
  skipped: boolean;
}

export function readTurns(raw: Record<string, string> | undefined): Turn[] {
  const out: Turn[] = [];
  for (let i = 0; raw && raw[`${i}:q`] !== undefined; i++) out.push({ q: raw[`${i}:q`], a: raw[`${i}:a`] ?? "", follow: raw[`${i}:f`] === "1", skipped: raw[`${i}:s`] === "1" });
  return out;
}

export function writeTurns(turns: Turn[], done = false): Record<string, string> {
  const out: Record<string, string> = {};
  turns.forEach((t, i) => {
    out[`${i}:q`] = t.q;
    out[`${i}:a`] = t.a;
    if (t.follow) out[`${i}:f`] = "1";
    if (t.skipped) out[`${i}:s`] = "1";
  });
  if (done) out.done = "1";
  return out;
}

export const answered = (t: Turn) => !t.skipped && t.a.trim().length > 0;

// 다음에 물을 시작 질문(없으면 null = 이 장의 질문은 끝)
export function nextStart(chapterId: string, turns: Turn[]): string | null {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  const asked = turns.filter((t) => !t.follow).length;
  return ch?.starts[asked] ?? null;
}

// 지금 스레드(마지막 시작 질문 이후)의 꼬리 질문 수
export function followsSinceStart(turns: Turn[]) {
  let n = 0;
  for (let i = turns.length - 1; i >= 0 && turns[i].follow; i--) n++;
  return n;
}

export const chapterDone = (p: Profile, id: string) => p.storyRaw[id]?.done === "1";
export const chaptersDone = (p: Profile) => CHAPTERS.filter((c) => chapterDone(p, c.id)).length;

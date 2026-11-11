// 마스코트 갈래의 이 기기 저장값(이야기 장 열림, 발견한 모습). 계정에 안 올린다.
// 저장이 막힌 브라우저(사생활 보호 창 등)에서도 화면이 멈추지 않게 전부 try/catch.
import { store } from "@/lib/store";
import type { Mood } from "@/components/mascot";

export type Chapter = { title: string; body: string[]; mood: Mood; unlock: "open" | "profile" | "lines" | "report"; hint: string };

export const CHAPTERS: Chapter[] = [
  {
    title: "1장. 갈림길 마을",
    mood: "think",
    unlock: "open",
    hint: "",
    body: ["길이 여러 갈래로 나뉘는 마을이 있었어요.", "사람들은 갈림길 앞에서 오래 서 있었어요. 저 길 끝에 무엇이 있는지 아무도 미리 볼 수 없었거든요."],
  },
  {
    title: "2장. 노란 새싹",
    mood: "surprise",
    unlock: "open",
    hint: "",
    body: ["어느 밤, 사람들의 망설임이 가장 많이 쌓인 갈림길 한가운데서 작고 노란 동그라미가 톡 하고 솟아났어요.", "머리에는 파란 새싹이 하나. 여러 갈래 길 앞에서 태어났다고, 사람들은 '갈래'라고 불렀어요."],
  },
  {
    title: "3장. 천 번의 발걸음",
    mood: "happy",
    unlock: "profile",
    hint: "검사를 마치면 열려요",
    body: ["갈래에게는 신기한 재주가 있었어요. 한 사람의 삶을 그 사람처럼 천 번 살아 보고 돌아오는 거예요.", "그래서 갈래는 그 사람을 먼저 알아야 했어요. 무엇을 아끼는지, 어떤 때 지치는지요."],
  },
  {
    title: "4장. 갈래 길 지도",
    mood: "cheer",
    unlock: "lines",
    hint: "살아 보기를 한 번 하면 열려요",
    body: ["천 번을 다녀온 갈래는 지도를 그렸어요. 정답 하나가 아니라, 어느 길로 몇 번 갔는지를요.", "자주 간 길은 굵게, 드문 길은 가늘게. 그리고 갈림길마다 '보통은 이렇고, 너라면 이렇더라'고 적어 두었어요."],
  },
  {
    title: "5장. 말하지 않는 것",
    mood: "base",
    unlock: "report",
    hint: "리포트를 보면 열려요",
    body: ["사람들이 물었어요. \"그래서 어느 길로 가야 해?\"", "갈래는 고개를 저었어요. 길은 직접 고르는 거니까요. 갈래가 해 줄 수 있는 건 '이 길은 이랬어'와 '이번 주엔 이걸 해 보자'까지예요."],
  },
  {
    title: "6장. 갈래의 비밀",
    mood: "sleepy",
    unlock: "report",
    hint: "리포트를 보면 열려요",
    body: ["사실 갈래도 아직 자기 길을 고르는 중이에요.", "그래서 오늘도 누군가의 갈림길 옆에서 함께 서 있어요. 혼자 고민하지 않아도 된다고, 먼저 다녀와 보겠다고요."],
  },
];


export type Have = { profile: boolean; lines: boolean; report: boolean };

export function unlockState(): Have {
  try {
    return {
      profile: !!store.getProfile(),
      lines: Object.keys(store.getMultiverses() ?? {}).length > 0,
      report: !!store.getReport(),
    };
  } catch {
    return { profile: false, lines: false, report: false };
  }
}

export const chapterOpen = (c: Chapter, h: Have) => c.unlock === "open" || h[c.unlock];

const SEEN = "cr:galae:seenChapters";
const FOUND = "cr:galae:found";

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

// 새로 열렸는데 아직 안 읽은 장(가장 앞 장 번호, 1부터). 없으면 null.
export function newChapter(): number | null {
  const h = unlockState();
  const open = CHAPTERS.filter((c) => chapterOpen(c, h)).length;
  const seen = Math.max(2, readNum(SEEN));
  return open > seen ? seen + 1 : null;
}

export function markChaptersSeen(h: Have = unlockState()) {
  try {
    localStorage.setItem(SEEN, String(CHAPTERS.filter((c) => chapterOpen(c, h)).length));
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
}

export const DISCOVERIES: { key: string; mood: Mood; label: string; hint: string }[] = [
  { key: "grabbed", mood: "grabbed", label: "잡힌 갈래", hint: "잡아서 끌어 보세요" },
  { key: "thrown", mood: "surprise", label: "날아간 갈래", hint: "세게 던져 보세요" },
  { key: "dizzy", mood: "dizzy", label: "어지러운 갈래", hint: "빠르게 여러 번" },
  { key: "sleepy", mood: "sleepy", label: "조는 갈래", hint: "가만히 1분" },
  { key: "secret", mood: "think", label: "비밀 말한 갈래", hint: "열 번 눌러 보세요" },
  { key: "cheer", mood: "cheer", label: "응원하는 갈래", hint: "리포트에서 만나요" },
];

export function foundList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOUND) ?? "[]");
  } catch {
    return [];
  }
}

export function markFound(key: string) {
  try {
    const l = foundList();
    if (!l.includes(key)) localStorage.setItem(FOUND, JSON.stringify([...l, key]));
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
}

// 성격 검사 Mini-IPIP(Donnellan 외 2006, 5요인 × 4문항 = 20문항). IPIP 공개 문항이라 상업적 사용도 허용된다(ipip.ori.org).
// IPIP 50의 부분집합이라 번역을 새로 하지 않고 lib/tests.ts의 같은 문항을 쓴다. 답도 answers.ipip에 같이 저장한다.
// 대조표와 교체 이유: docs/검사-설계-근거.md 'Mini-IPIP'.
import { IPIP50, scoreScale, type ScaleItem } from "./tests";
import type { BigFive } from "./types";

// Mini-IPIP 원 논문의 1~20번 순서. 값은 IPIP 50 문항 id.
export const MINI_IDS = ["b1", "b17", "b23", "b39", "b15", "b6", "b22", "b28", "b9", "b20", "b31", "b42", "b33", "b29", "b10", "b16", "b32", "b18", "b19", "b30"];
export const MINI_ITEMS: ScaleItem[] = MINI_IDS.map((id) => IPIP50.find((i) => i.id === id)!);
export const IPIP_REST_IDS = IPIP50.filter((i) => !MINI_IDS.includes(i.id)).map((i) => i.id);

export const miniDone = (answers: Record<string, number> | undefined) => MINI_IDS.every((id) => answers?.[id] !== undefined);
export const scoreMini = (answers: Record<string, number>) => scoreScale(MINI_ITEMS, answers, ["O", "C", "E", "A", "N"]) as BigFive;

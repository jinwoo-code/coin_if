// 서술 AI 처지 검사 단위 테스트(AI 안 부름): 처지 나누기, 처지에 안 맞는 말, 역할 괄호 지우기.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-narrate.ts
import { badWords, phaseOf, stripRoleTags } from "../lib/narrate-check";
import { npcFits } from "../lib/sim";
import type { SimEvent } from "../lib/types";
import { getWorld } from "../lib/worlds";

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "통과" : "실패"} ${name}${ok ? "" : `: ${JSON.stringify(got)} ≠ ${JSON.stringify(want)}`}`);
};

eq("처지: 재직", phaseOf("300인 이상 병원 2개월차"), "재직");
eq("처지: 학생(국가시험)", phaseOf("졸업 앞두고 국가시험 준비"), "학생");
eq("처지: 수험", phaseOf("수험생"), "수험");
eq("처지: 학교 다니며 시험 준비", phaseOf("학교 다니며 시험 준비"), "학생");
eq("처지: 구직", phaseOf("면허 따고 구직 중"), "구직");
eq("처지: 군", phaseOf("군 복무 중"), "군");

const scene = (worldId: string, status: string, narration = "", title = "사건"): SimEvent =>
  ({ worldId, lineId: "x", station: 0, month: 3, label: "", eventId: "e", title, kind: "neutral", narration, choice: "", choiceIndex: 0, reason: "", delta: {}, state: { skill: 0, stress: 0, satisfaction: 0, relation: 0, money: 0 }, status, eventStatus: status, salary: 0, freq: 0, routine: false, minor: [] }) as SimEvent;
const check = (worldId: string, status: string, text: string, original = "") => {
  const w = getWorld(worldId);
  const s = scene(worldId, status, original);
  return badWords(text, s, w, (n) => npcFits(w, n, s));
};

const nurse = getWorld("nurse");
const peer = nurse.npcs.find((n) => n.role === "동료")!.name;
eq("학생 장면의 입사 동기", check("nurse", "졸업 앞두고 국가시험 준비", `${peer}는 모의고사 준비가 잘 되는지 물었다.`).length > 0, true);
eq("재직 장면의 입사 동기는 괜찮음", check("nurse", "300인 이상 병원 8개월차", `${peer}가 커피를 건넸다.`), []);
eq("수험 장면의 민원인", check("civil-servant", "수험생", "민원인처럼 날카로운 마음이 들었다."), ["민원인"]);
eq("재직 공무원의 민원인", check("civil-servant", "지방직 9급 3개월차", "민원인이 크게 항의했다."), []);
eq("수험 장면의 스터디원은 괜찮음", check("civil-servant", "수험생", "스터디원 정과 공부 인증을 주고받았다."), []);
eq("사건 원문에 있던 말은 허용", check("developer", "학교 다니며 취업 준비", "다음 달 첫 출근이다.", "최종 합격 연락을 받았다. 다음 달 첫 출근이다."), []);
eq("구직 장면의 출근", check("developer", "취업 준비 중", "아침마다 출근하는 친구가 부러웠다.").includes("출근"), true);

eq("역할 괄호 지우기", stripRoleTags(`입사 동기 이수아(동료)는 물었다. 박 수간호사(윗사람)도 웃었다.`, nurse), "입사 동기 이수아는 물었다. 박 수간호사도 웃었다.");
eq("다른 괄호는 그대로", stripRoleTags("기출(2025년)을 풀었다.", nurse), "기출(2025년)을 풀었다.");

console.log(fail ? `\n실패 ${fail}개` : "\n전부 통과");
process.exitCode = fail ? 1 : 0;

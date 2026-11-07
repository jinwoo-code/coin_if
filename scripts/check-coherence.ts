// 상태 모순 세기: 53개 진로 × 1,000번 × 인물 3명(10년)에서 한 삶 안의 앞뒤가 안 맞는 사건을 센다. 전부 0이어야 한다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-coherence.ts [--runs 1000] [--months 120] [--only id,id]
//  1. 취업 후 구직 사건: 일하는 중인 달에 '일 안 할 때만' 사건(구직·수험)
//  2. 긴 구직이 너무 이름: '1년 가까이 자리를 못 잡았다'(긴 구직)가 구직 시작(졸업·면허 등 요구 상태·퇴사 중 늦은 때) 9개월 안
//  3. 합격 후 불합격: 그 시험·면허에 붙은 뒤(떨어짐 사건이 막아 둔 합격 상태가 켜진 뒤) 또 '떨어졌다' 사건.
//     면허를 딴 뒤 병원 면접에서 떨어지는 건 다른 관문이라 모순이 아니다(일하는 중의 면접 탈락은 1번이 센다).
//  4. 퇴사 없이 첫 출근: 일하는 중에 다시 일 시작 사건(이직 보기는 사건이 아니라 선택이라 제외)
//  5. 장면 머리 처지: 장면의 큰 사건이 '일 안 할 때만' 사건인데 머리에 보이는 처지가 재직
import { DEMOS } from "../lib/demo";
import { runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import { scenesOf } from "../lib/scenes";
import { statsOf } from "../lib/multiverse";
import { WORLDS } from "../lib/worlds";
import type { EventCard, Path, Profile } from "../lib/types";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const RUNS = Number(arg("--runs") ?? 1000);
const MONTHS = Number(arg("--months") ?? 120);
const only = arg("--only")?.split(",");
const START = "2026-12";

const avg = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: ["안정", "성장", "돈", "여유"],
  spec: { school: "4년제", status: "졸업예정", gradIn: 3, gpa: 3.5, certs: [], toeic: null, projects: 1, workMonths: 6, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 50, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 8, partTimeHours: 0 },
});
const people: [string, Profile][] = [
  ["평균", avg],
  ["김민준", DEMOS.developer.profile],
  ["이서연", DEMOS.nurse.profile],
];

type Kind = "jobless-while-employed" | "long-hunt-early" | "fail-after-pass" | "hire-while-employed" | "scene-status";
const LABEL: Record<Kind, string> = {
  "jobless-while-employed": "취업 후 구직 사건",
  "long-hunt-early": "긴 구직이 너무 이름",
  "fail-after-pass": "합격 후 불합격",
  "hire-while-employed": "퇴사 없이 첫 출근",
  "scene-status": "장면 머리 처지",
};
const isFail = (e: EventCard) => /떨어졌다|불합격/.test(e.title);

function check(path: Path, gradIn: number, add: (k: Kind, at: string) => void) {
  let employed = false;
  let leftAt = -1;
  const flagAt = new Map<string, number>();
  for (const m of path.months) {
    const e = m.event;
    if (e) {
      const where = `${m.month}개월 ${e.id}`;
      if (e.needsNoJob && employed) add("jobless-while-employed", where);
      if (e.hires && employed) add("hire-while-employed", where);
      if (e.branchLabel === "긴 구직") {
        const start = Math.max(gradIn - (e.gradGrace ?? 0), leftAt, ...(e.requires ?? []).map((id) => flagAt.get(id) ?? 0));
        if (m.month - start < 9) add("long-hunt-early", `${where} (구직 ${m.month - start}개월째)`);
      }
      const blocked = (e.excludes ?? []).filter((f) => flagAt.has(f) && f !== "switched");
      if (isFail(e) && blocked.length) add("fail-after-pass", `${where} (이미 ${blocked.join(", ")})`);
      flagAt.set(e.id, flagAt.get(e.id) ?? m.month);
      const sets = e.choices[m.choiceIndex]?.sets;
      if (sets) flagAt.set(sets, flagAt.get(sets) ?? m.month);
    }
    const now = m.salary > 0;
    if (employed && !now) {
      leftAt = m.month;
    }
    employed = now;
  }
}

const total: Record<Kind, number> = { "jobless-while-employed": 0, "long-hunt-early": 0, "fail-after-pass": 0, "hire-while-employed": 0, "scene-status": 0 };
const examples: string[] = [];
const t0 = Date.now();
for (const w of WORLDS) {
  if (only && !only.includes(w.id)) continue;
  for (const [who, p] of people) {
    const paths = runAll(p, w, MONTHS, START, undefined, RUNS);
    const stats = statsOf(p, w, paths);
    const add = (k: Kind, at: string) => {
      total[k]++;
      if (examples.length < 30) examples.push(`${w.id} · ${who} · ${LABEL[k]}: ${at}`);
    };
    for (const path of paths) check(path, p.spec.gradIn, add);
    // 장면 머리 처지는 화면에 그리는 단위라 앞 50개 삶만 본다(장면 만들기가 무거워서)
    for (const path of paths.slice(0, 50)) {
      for (const s of scenesOf(w, path, "check", MONTHS, START, stats)) {
        const ev = w.events.find((e) => e.id === s.eventId);
        const head = s.eventStatus ?? s.status;
        if (ev?.needsNoJob && !ev.hires && /개월차/.test(head)) add("scene-status", `${s.label} ${s.eventId} / ${head}`);
      }
    }
  }
}
console.log(`| 모순 | 개수 |\n|---|---|`);
for (const k of Object.keys(total) as Kind[]) console.log(`| ${LABEL[k]} | ${total[k]} |`);
console.log(`\n${RUNS}번 × ${MONTHS}개월 × 인물 ${people.length}명, ${((Date.now() - t0) / 1000).toFixed(0)}초`);
if (examples.length) console.log("\n예시:\n" + examples.join("\n"));
const bad = Object.values(total).reduce((a, b) => a + b, 0);
process.exitCode = bad ? 1 : 0;

// 내 조건이 합격·취업 확률을 몇 배로 바꾸는지 계산한다.
// 기준(배수 1.0)은 '평범한 조건의 지원자'다. 배수 자체는 공개 통계가 없어서 우리가 정한 가정값이며,
// 화면에 "왜 이 배수인지"를 같이 보여 줘서 사용자가 판단할 수 있게 한다.
// 전공·진로와 상관없이 같은 방식: 진로 파일이 정한 준비도 질문(readiness)과 자격증(certs)으로 계산한다.
import { answerOf, READINESS } from "./readiness";
import type { FactorKey, FactorNote, Profile, WorldTemplate } from "./types";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

type Calc = (p: Profile, w: WorldTemplate) => { mult: number; why: string[] };

// 자격증 이름 비교(띄어쓰기·대소문자 무시, '컴활1급'과 '컴퓨터활용능력 1급' 같은 표기 차이 일부 흡수)
const norm = (s: string) => s.replace(/\s/g, "").toLowerCase().replace("컴퓨터활용능력", "컴활").replace("한국사능력검정시험", "한국사");
export function hasCert(p: Profile, cert: string) {
  const c = norm(cert);
  return p.spec.certs.some((x) => norm(x).includes(c) || c.includes(norm(x)));
}

const CALCS: Record<FactorKey, { label: string; calc: Calc }> = {
  jobReady: {
    label: "직무 준비도",
    calc: (p, w) => {
      const s = p.spec;
      const why: string[] = [];
      let m = 1;
      for (const id of w.readiness) {
        const q = READINESS[id];
        if (!q) continue;
        const o = q.options[answerOf(p.readiness, id)];
        m *= o.mult;
        why.push(`${q.label}: ${o.t}`);
      }
      const certs = w.certs.filter((c) => hasCert(p, c)).slice(0, 2);
      if (certs.length) (m *= 1.12 ** certs.length), why.push(certs.join("·"));
      if (s.internMonths > 0) (m *= 1.15), why.push(`인턴·현장실습 ${s.internMonths}개월`);
      if (s.projects >= 2) (m *= 1.1), why.push(`프로젝트·작품 ${s.projects}개`);
      else if (s.projects === 0) (m *= 0.9), why.push("끝까지 해 본 프로젝트·작품 없음");
      if (s.awards > 0) (m *= 1.05), why.push(`수상 ${s.awards}회`);
      if (s.gpa !== null && s.gpa >= 3.8) (m *= 1.05), why.push(`학점 ${s.gpa}`);
      if (s.toeic && s.toeic >= 800 && (w.archetype === "open" || w.archetype === "public")) (m *= 1.08), why.push(`토익 ${s.toeic}`);
      return { mult: clamp(m, 0.15, 2.8), why };
    },
  },
  examPower: {
    label: "시험 공부량",
    calc: (p, w) => {
      const why: string[] = [];
      // 근로·알바 시간만큼 하루 공부 시간이 줄어든다고 본다.
      const lost = (p.life.partTimeHours / 7) * 0.8;
      const eff = Math.max(0, p.life.studyHours - lost);
      // 공시 준비생 하루 평균 8.7시간을 1.0으로 둔다(이대중 외, 「7급, 9급 공무원시험 합격자 실태에 관한 연구」).
      let m = clamp(eff / 8.7, 0.15, 1.3);
      why.push(`하루 실제 공부 ${Math.round(eff * 10) / 10}시간${lost >= 0.5 ? `(알바로 ${Math.round(lost * 10) / 10}시간 줄어듦)` : ""}`);
      m *= 1 + 0.08 * (p.bigFive.C - 3);
      why.push(`성실성 ${p.bigFive.C}점`);
      if (w.id === "civil-servant" && (hasCert(p, "한국사1급") || hasCert(p, "한국사2급"))) (m *= 1.05), why.push("한국사 자격증(한국사 과목 기초)");
      return { mult: clamp(m, 0.1, 1.6), why };
    },
  },
  region: {
    label: "사는 곳",
    calc: (p) => {
      const t: Record<Profile["life"]["region"], number> = { 서울: 1, "경기·인천": 0.95, "지방 광역시": 0.8, "그 외 지역": 0.65 };
      return { mult: t[p.life.region], why: [`${p.life.region}(일자리가 수도권에 몰려 있음)`] };
    },
  },
  school: {
    label: "학력",
    calc: (p) => {
      const t: Record<Profile["spec"]["school"], number> = { 고졸: 0.7, 전문대: 0.85, "4년제": 1, 대학원: 1.1 };
      return { mult: t[p.spec.school], why: [p.spec.school] };
    },
  },
  persistence: {
    label: "끈기",
    calc: (p) => ({ mult: clamp(1 + 0.1 * (p.behavior.persistence - 3), 0.8, 1.2), why: [`상황 질문 끈기 ${p.behavior.persistence}점`] }),
  },
  military: {
    label: "병역",
    // 실제 배수(입대 전 회사 채용 ×0.5)는 엔진에서 시기에 맞춰 적용한다.
    calc: (p) => ({ mult: 1, why: [p.life.military === "미필" && p.life.enlistIn !== null ? `${p.life.enlistIn}개월 뒤 입대(입대 전엔 회사 채용 확률 절반으로 가정)` : p.life.military] }),
  },
};

export function factorMult(p: Profile, w: WorldTemplate, keys: FactorKey[] | undefined): number {
  if (!keys) return 1;
  return keys.reduce((m, k) => m * CALCS[k].calc(p, w).mult, 1);
}

export function factorNotes(p: Profile, w: WorldTemplate, keys: FactorKey[]): FactorNote[] {
  return keys.map((k) => {
    const { mult, why } = CALCS[k].calc(p, w);
    return { key: k, label: CALCS[k].label, mult: r2(mult), why: why.join(", ") };
  });
}

// 시작 역량(0~100): 그 길의 준비도 배수에서 정한다.
export function startSkill(p: Profile, w: WorldTemplate): number {
  return clamp(Math.round(35 * CALCS[w.startSkill].calc(p, w).mult), 10, 80);
}

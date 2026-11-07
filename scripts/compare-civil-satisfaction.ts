// 9급 합격자 만족(엔진) vs 공식 재직자 만족도 비교표 → docs/공무원-만족-비교.md. 비교만 하고 엔진은 안 고친다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/compare-civil-satisfaction.ts
import { writeFileSync } from "node:fs";
import { DEMOS } from "../lib/demo";
import { outcomeOf, runAll } from "../lib/multiverse";
import { normalizeProfile } from "../lib/profile";
import type { Path, Profile } from "../lib/types";
import { getWorld } from "../lib/worlds";

const avg = normalizeProfile({
  name: "평균",
  dilemma: "검증",
  values: [],
  spec: { school: "4년제", status: "졸업", gradIn: 0, gpa: 3.5, certs: [], toeic: null, projects: 1, workMonths: 6, internMonths: 0, awards: 0, github: null },
  life: { savings: 500, support: 50, livingCost: 90, military: "해당없음", enlistIn: null, region: "경기·인천", studyHours: 8, partTimeHours: 0 },
});
const people: [string, Profile][] = [
  ["평범한 지원자(가치관 안 고름)", avg],
  ["김민준(예시)", DEMOS.developer.profile],
  ["이서연(예시)", DEMOS.nurse.profile],
];
const median = (xs: number[]) => {
  const s = xs.toSorted((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const w = getWorld("civil-servant");
const rows: string[] = [];
for (const [who, p] of people)
  for (const months of [36, 120]) {
    const paths = runAll(p, w, months, "2026-12");
    const o = outcomeOf(paths);
    const stay = paths.filter((x: Path) => x.employedAt !== null && !x.otherPath);
    rows.push(`| ${who} | ${months / 12}년 | ${o.gate.share}% | ${o.gate.stayedSatisfied}% | ${median(stay.map((x) => x.final.satisfaction))} | ${o.gate.left}% |`);
  }

const md = `# 9급 합격자 만족: 엔진 vs 공식 조사(비교만)

\`scripts/compare-civil-satisfaction.ts\`로 만든다. 엔진은 고치지 않았다. 측정 방식이 달라 숫자를 그대로 맞대면 안 된다(아래 '주의').

## 엔진(1,000번, 2026-12 시작)

| 인물 | 기간 | 합격 | 남은 합격자 중 만족(60 이상) | 남은 합격자 만족도 가운데 값(100점) | 합격 뒤 그만두고 다른 길 |
|---|---|---|---|---|---|
${rows.join("\n")}

## 공식 조사

| 조사 | 대상 | 항목 | 값 | 출처 |
|---|---|---|---|---|
| 2025 공직생활실태조사(한국행정연구원) | 중앙+광역 재직 5년차 이하 | 직무만족 인식(5점 평균) | 3.40 | 뉴시스 2026-04-08 보도(https://v.daum.net/v/20260408060430175) |
| 같음 | 기초 재직 5년차 이하 | 직무만족 인식(5점 평균) | 3.27 | 같음 |
| 같음 | 중앙+광역 전체 2,217명 | 직무만족 인식(5점 평균) | 3.43(2024 3.34) | 같음 |
| 같음 | 8~9급 | 이직 의향(5점 평균) | 중앙+광역 3.41, 기초 3.44 | 같음 |
| 2022 공직생활실태조사 | 재직 5년 이하(전 직급) | '기회가 되면 이직' 그렇다 | 62.8% | 샐러던트리포트 2023-05-31(https://www.saladentreport.co.kr/news/articleView.html?idxno=1680) |
| 2023 공무원총조사(인사혁신처) | 공무원 전체 | 공직생활에 보람을 느낌 | 41.5%(못 느낌 21.3%) | 인사혁신처 보도자료 2024-04-30(https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&mode=view&cntId=3873) |
| 고용24 직업정보(2025) | 일반행정공무원 재직자 | 직업 만족도(100점) | 69.9 | data/jobdata/extra-facts.json |

## 주의

- 9급만 따로 낸 직무만족 숫자는 찾지 못했다(보고서 원문 PDF는 못 봄). 5년차 이하·8~9급 값으로 대신했다.
- 공직생활실태조사는 5점 평균, 엔진은 '60 이상인 사람 비율'과 100점 가운데 값이다. 5점 3.40을 100점으로 펴면 (3.40−1)÷4×100 = 60이지만, 문항과 척도가 달라 같은 값이라는 뜻이 아니다.
- 엔진의 '그만두고 다른 길'은 실제로 그만둔 비율이고, 조사의 이직 의향은 마음만 있는 비율이다. 크기를 비교하면 안 된다.
- 고용24 69.9점은 경력 전체 재직자 응답이다.
- 판단: 엔진의 남은 합격자 만족 가운데 값이 고용24 69.9보다 낮으면 엔진이 9급 재직을 공식 응답보다 나쁘게 그린다는 뜻이다(진단 문서 \`docs/만족-비율-진단.md\`와 같은 방향). 고칠지는 팀장 결정.
`;
writeFileSync("docs/공무원-만족-비교.md", md);
console.log(rows.join("\n"));

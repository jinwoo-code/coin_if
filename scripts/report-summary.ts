// 시연 인물 3건의 리포트 요약표(필요한 것 상위 5개와 근거, 증거물 2개, 계획 전→후) → docs/리포트-요약표.md
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/report-summary.ts
import { readFileSync, writeFileSync } from "node:fs";
import { DEMO_PROFILE, NURSE_DEMO_PROFILE } from "@/lib/demo";
import { buildEvidence, buildExamPlan, isExamWorld } from "@/lib/evidence";
import { gapItems, prioritize } from "@/lib/gap";
import { gapDeltas } from "@/lib/gap-sim";
import { majorFamily } from "@/lib/job-codes";
import { planHorizon, planInput, planRerun } from "@/lib/plan-sim";
import type { RequirementsFile } from "@/lib/requirements";
import { buildPlan } from "@/lib/schedule";
import type { Profile } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const START = "2026-12"; // 2026-11에 화면을 연 것과 같은 시작 달. 시험형은 시작 달에 따라 값이 크게 달라진다(아래 문장)
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function section(who: string, p: Profile, id: string, tries: { months: number; weekly?: number }[]) {
  const w = getWorld(id);
  const f = JSON.parse(readFileSync(`data/requirements/${id}.json`, "utf8")) as RequirementsFile;
  const fam = majorFamily(p.major);
  const req = (fam && f.byFamily?.[fam]) || f.default;
  const gaps = gapItems(req, p, w);
  const rows = prioritize(gaps, w, p, gapDeltas(p, w, 36, START, gaps));
  const out: string[] = [`## ${w.name} (${who})`, "", "**필요한 것 상위 5개**", "", "| 순위 | 항목 | 지금 | 근거 |", "|---|---|---|---|"];
  const LABEL: Record<string, string> = { have: "있음", partial: "부분적", none: "없음" };
  rows.slice(0, 5).forEach((r, i) => out.push(`| ${i + 1} | ${cell(r.title)}${r.item.required ? " (필수)" : ""} | ${LABEL[r.status] ?? r.status} | ${cell(r.evidence.join(" · "))} |`));

  out.push("", "**증거물 2개**", "", "| 증거물 | 분량(가정값) | 완성 기준 등급 | 완성 기준 첫 줄 |", "|---|---|---|---|");
  if (isExamWorld(w)) {
    // 시험형은 화면과 같이 프로젝트 대신 모의고사 기록과 약점 과목을 본다.
    const e = buildExamPlan(req);
    out.push(`| 모의고사 기록 | ${cell(e.amount)} | assumed | 과목: ${cell(e.subjects.map((x) => x.name).join(", "))} |`);
    out.push(`| 약점 과목 정리 | 기록을 넣으면 평균이 낮은 과목부터 | assumed | 점수를 넣기 전에는 판단하지 않음 |`);
  } else {
    buildEvidence(req, w, gaps).cards.slice(0, 2).forEach((c) => out.push(`| ${cell(`${c.form}${c.unit ? `: ${c.unit}` : ""}`)} | ${cell(c.amount)} | ${c.checksGrade} | ${cell(c.checks[0] ?? "없음")} |`));
  }

  out.push("", "**계획 넣고 다시 살아 보기(1,000번)**", "", "| 기간 | 주당 공부 | 전 → 후 | 넣은 조건 |", "|---|---|---|---|");
  for (const t of tries) {
    const plan = buildPlan(rows, p, w, 36, { months: t.months, weekly: t.weekly });
    const r = planRerun(p, w, planHorizon(plan), START, planInput(plan, rows, w))!;
    out.push(`| ${r.months}개월 | ${plan.weekly}시간 | ${r.before}% → ${r.after}% | ${cell(r.applied.map((a) => `${a.month}개월째 ${a.label}`).join(", ")) || "없음"} |`);
  }
  out.push("");
  return out.join("\n");
}

const doc = [
  "# 리포트 요약표",
  "",
  `\`scripts/report-summary.ts\`로 만든 표입니다. 인물은 팀이 정한 가상 시연 인물이고, 값은 시작 달 ${START} 기준 엔진 계산이고, 배포 화면과는 몇 %p 다를 수 있습니다(9급 주 71시간: 화면 62%, 표 64%).`,
  "계획을 제때 다 해낸다는 가정의 값이라 실제 효과가 아니고, 배수 대부분은 가정값입니다. 합격·취업을 보장하지 않습니다.",
  "9급 3년 안 값은 같은 사람도 시작 달에 따라 달라집니다(2026-12 41%, 2027-01 36%, 2027-03 25%, 2027-06 43%). 원인은 아직 확인하지 않았습니다.",
  "",
  section("김민준", DEMO_PROFILE, "developer", [{ months: 36 }]),
  section("이서연", NURSE_DEMO_PROFILE, "nurse", [{ months: 36 }, { months: 60 }]),
  section("김민준", DEMO_PROFILE, "civil-servant", [{ months: 36 }, { months: 36, weekly: 71 }]),
].join("\n");
writeFileSync("docs/리포트-요약표.md", doc);
console.log(doc);

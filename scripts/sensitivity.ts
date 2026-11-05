// 민감도 분석: data/weights.json의 가중치를 하나씩 0배·0.5배·2배로 바꿔서 결과가 얼마나 움직이는지 본다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/sensitivity.ts   (약 5분, 결과는 docs/민감도-분석.md)
//
// - 더하는 값(add·slope·share·scale)은 값 × 배율, 배수(mult·table·options)는 값 ^ 배율(0배 = 효과 없음 = ×1).
// - 회차 시드는 그대로라서, 차이는 가중치 때문에 생긴 것만 남는다. 다만 선택 하나가 바뀌면 그 뒤 인생이 통째로 달라질 수 있어서,
//   '같은 가중치로 회차만 바꿨을 때' 변화(표본 잡음)를 같이 적는다. 이보다 작은 변화는 100번 돌리기로는 구분하기 어렵다.
// - 지표: 합격·취업률(기간 안에 일을 시작한 비율, %p), 평균 기간(붙은 사람의 첫 출근 달, 개월), 세계선 이동(앞 두 갈림길로 묶은 분포의 총변동거리, %p).
import { writeFileSync } from "node:fs";
import { runAll } from "../lib/multiverse";
import type { Path, Profile } from "../lib/types";
import { PERSONAS } from "./personas";
import { resetScales, setScale, WEIGHTS } from "../lib/weights";
import { getWorld } from "../lib/worlds";

const RUNS = 200;
const MONTHS = 36; // 화면 기본 기간(3년)
const START = "2026-11";
const SCALES = [0, 0.5, 2];
// 유형 틀마다 하나 이상 + 상세판 4개
const CAREERS = ["developer", "marketer", "civil-servant", "data-analyst", "teacher-elem", "nurse", "ux-designer", "chef", "researcher", "startup"];

interface Metrics {
  hire: number; // %
  months: number; // 붙은 사람 평균 첫 출근 달(개월)
  lines: Map<string, number>; // 앞 두 갈림길 → 비율
}

function metrics(paths: Path[]): Metrics {
  const hired = paths.filter((x) => x.employedAt !== null);
  const lines = new Map<string, number>();
  for (const x of paths) {
    const k = x.signature.slice(0, 2).join(">") || "-";
    lines.set(k, (lines.get(k) ?? 0) + 1 / paths.length);
  }
  return { hire: (hired.length / paths.length) * 100, months: hired.length ? hired.reduce((s, x) => s + x.employedAt! + 1, 0) / hired.length : NaN, lines };
}

const tv = (a: Map<string, number>, b: Map<string, number>) => {
  let d = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) d += Math.abs((a.get(k) ?? 0) - (b.get(k) ?? 0));
  return (d / 2) * 100;
};

interface Delta {
  hire: number;
  months: number;
  lines: number;
}
const diff = (a: Metrics, b: Metrics): Delta => ({ hire: b.hire - a.hire, months: Number.isNaN(a.months) || Number.isNaN(b.months) ? 0 : b.months - a.months, lines: tv(a.lines, b.lines) });

const cells = PERSONAS.flatMap((ps) => CAREERS.map((c) => ({ ps, world: getWorld(c) })));
const run = (p: Profile, worldId: string) => metrics(runAll(p, getWorld(worldId), MONTHS, START, undefined, RUNS));

// 기준값
resetScales();
const baseM = cells.map(({ ps, world }) => run(ps.p, world.id));

// 표본 잡음: 같은 가중치, 회차 시드만 다르게(이름을 바꾸면 seedFor가 달라진다)
const noise = cells.map(({ ps, world }, i) => diff(baseM[i], run({ ...ps.p, name: `${ps.p.name}#다른 회차` }, world.id)));
const noiseOf = (k: keyof Delta) => {
  const xs = noise.map((d) => Math.abs(d[k])).toSorted((a, b) => a - b);
  return { median: xs[Math.floor(xs.length / 2)], p90: xs[Math.floor(xs.length * 0.9)] };
};

// 가중치 하나씩
interface Row {
  key: string;
  byScale: { scale: number; worst: Delta; where: { hire: string; months: string; lines: string }; mean: Delta }[];
  score: number;
  perPersona: Record<string, number>;
}
const rows: Row[] = [];
const keys = Object.keys(WEIGHTS).filter((k) => !k.startsWith("reason.") && !k.startsWith("report.") && !k.startsWith("salary.") && !k.startsWith("retrain.")); // reason.*은 이유 문장에만 쓴다
const t0 = Date.now();
keys.forEach((key, ki) => {
  const perPersona: Record<string, number> = {};
  const byScale = SCALES.map((scale) => {
    resetScales();
    setScale(key, scale);
    const ds = cells.map(({ ps, world }, i) => {
      const d = diff(baseM[i], run(ps.p, world.id));
      perPersona[ps.id] = Math.max(perPersona[ps.id] ?? 0, Math.abs(d.hire), d.lines);
      return d;
    });
    const worstOf = (k: keyof Delta) => ds.reduce((bi, d, i) => (Math.abs(d[k]) > Math.abs(ds[bi][k]) ? i : bi), 0);
    const where = (k: keyof Delta) => `${cells[worstOf(k)].ps.id}·${cells[worstOf(k)].world.short}`;
    const mean = (k: keyof Delta) => ds.reduce((s, d) => s + Math.abs(d[k]), 0) / ds.length;
    return {
      scale,
      worst: { hire: ds[worstOf("hire")].hire, months: ds[worstOf("months")].months, lines: ds[worstOf("lines")].lines },
      where: { hire: where("hire"), months: where("months"), lines: where("lines") },
      mean: { hire: mean("hire"), months: mean("months"), lines: mean("lines") },
    };
  });
  resetScales();
  rows.push({ key, byScale, score: Math.max(...byScale.map((b) => Math.max(Math.abs(b.worst.hire), b.worst.lines))), perPersona });
  process.stderr.write(`\r${ki + 1}/${keys.length} ${Math.round((Date.now() - t0) / 1000)}초`);
});
process.stderr.write("\n");
rows.sort((a, b) => b.score - a.score);

// ---------- 출력 ----------
const f1 = (x: number) => (Math.abs(x) < 0.05 ? "0" : `${x > 0 ? "+" : ""}${x.toFixed(1)}`);
const short = (v: unknown) => (Array.isArray(v) ? `[${v.join(", ")}]` : typeof v === "object" ? `{${Object.values(v as object).join(", ")}}` : String(Math.round((v as number) * 1000) / 1000));
const nh = noiseOf("hire");
const nm = noiseOf("months");
const nl = noiseOf("lines");
// 지표마다 자기 잡음과 비교한다(합격률은 합격률 잡음, 세계선은 세계선 잡음)
const real = (r: Row) => r.byScale.some((b) => Math.abs(b.worst.hire) > nh.p90 || b.worst.lines > nl.p90);

const out: string[] = [];
out.push("# 가중치 민감도 분석");
out.push("");
out.push(`\`scripts/sensitivity.ts\`로 만든 문서(${new Date().toISOString().slice(0, 10)}). 다시 돌리면 덮어쓴다.`);
out.push("");
out.push("## 어떻게 쟀나");
out.push("");
out.push(`- \`data/weights.json\`의 가중치 ${keys.length}개를 **하나씩** 0배·0.5배·2배로 바꾸고 나머지는 그대로 둔다.`);
out.push("  - 더하는 값(add·slope·share·scale)은 값 × 배율. 배수(mult·table·options)는 값 ^ 배율이라 0배면 효과가 없어지고(×1), 2배면 1에서 두 배 멀어진다(×1.12 → ×1.25).");
out.push(`- 대표 인물 5명 × 진로 ${CAREERS.length}개(${CAREERS.map((c) => getWorld(c).short).join(", ")}) = ${cells.length}칸. 칸마다 ${RUNS}번, ${MONTHS / 12}년(화면 기본 기간), 시작 ${START}.`);
out.push("- 지표");
out.push("  - **합격·취업률**: 기간 안에 일을 시작한 회차 비율. 바뀐 크기(%p).");
out.push("  - **평균 기간**: 붙은 회차의 첫 출근 달 평균. 바뀐 크기(개월). 3년 안에 붙은 사람끼리라 길어지면 오히려 빠지는 사람이 생긴다.");
out.push("  - **세계선 이동**: 앞 두 갈림길로 묶은 세계선 비율이 얼마나 옮겨 갔나(총변동거리, %p). 0이면 같은 분포, 100이면 전혀 다른 분포.");
out.push("- 표의 숫자는 50칸 중 **가장 크게 바뀐 칸**의 값이다. 괄호 안은 50칸 평균(절댓값).");
out.push("- 회차 시드는 그대로라서 차이는 가중치에서 온다. 다만 선택 하나가 바뀌면 그 뒤가 통째로 달라질 수 있어서, 아래 '표본 잡음'보다 작은 변화는 의미 있게 보기 어렵다.");
out.push("");
out.push("### 표본 잡음(기준)");
out.push("");
out.push(
  `가중치는 그대로 두고 회차만 다른 ${RUNS}번을 다시 돌렸을 때 변화(50칸): 합격·취업률 가운데 ${nh.median.toFixed(1)}%p·상위 10% ${nh.p90.toFixed(1)}%p, 평균 기간 가운데 ${nm.median.toFixed(1)}개월·상위 10% ${nm.p90.toFixed(1)}개월, 세계선 이동 가운데 ${nl.median.toFixed(1)}%p·상위 10% ${nl.p90.toFixed(1)}%p.`,
);
out.push("");
out.push(
  `→ 합격·취업률 변화가 **${nh.p90.toFixed(1)}%p 이하**이고 세계선 이동이 **${nl.p90.toFixed(1)}%p 이하**면 '잡음 수준'으로 표시했다(한 칸에서 그만큼은 회차 운으로도 나온다). 가중치 비교는 같은 회차 시드를 쓰므로 실제 잡음은 이보다 작다. 보수적인 기준이다.`,
);
out.push("");
out.push("### 대표 인물");
out.push("");
out.push("공통: 4년제 졸업, 경기·인천, 저축 500만 원, 집 지원 월 60만 원, 생활비 90만 원, 하루 공부 6시간, 주 10시간 알바, 준비도 질문은 답하지 않음(진로마다 기본 보기).");
out.push("");
for (const ps of PERSONAS) out.push(`- **${ps.id}**: ${ps.desc}`);
out.push("");
out.push("## 결과: 변화가 큰 순서");
out.push("");
out.push("| 순위 | 가중치 | 지금 값 | 크기 | 합격·취업률 %p (0× / 0.5× / 2×) | 평균 기간 개월 (0× / 0.5× / 2×) | 세계선 이동 %p (0× / 0.5× / 2×) | 가장 크게 바뀐 칸 |");
out.push("|---:|---|---|---|---|---|---|---|");
const cell = (r: Row, k: keyof Delta) => r.byScale.map((b) => `${k === "lines" ? b.worst.lines.toFixed(1) : f1(b.worst[k])}`).join(" / ") + ` (${r.byScale.map((b) => b.mean[k].toFixed(1)).join(" / ")})`;
rows.forEach((r, i) => {
  const w = WEIGHTS[r.key];
  const big = r.byScale.reduce((a, b) => (Math.max(Math.abs(b.worst.hire), b.worst.lines) > Math.max(Math.abs(a.worst.hire), a.worst.lines) ? b : a));
  // 잡음 대비 더 크게 넘은 쪽을 보여 준다
  const where = Math.abs(big.worst.hire) / nh.p90 >= big.worst.lines / nl.p90 ? `${big.where.hire} (${big.scale}×, 합격률)` : `${big.where.lines} (${big.scale}×, 세계선)`;
  out.push(`| ${i + 1} | \`${r.key}\` | ${short(w.value)} | ${w.magnitude === "fitted" ? `보정값(${w.n ? `n=${w.n}` : w.note})` : "가정값"} | ${cell(r, "hire")} | ${cell(r, "months")} | ${cell(r, "lines")} | ${real(r) ? where : "잡음 수준"} |`);
});
out.push("");
out.push("## 인물별로 가장 크게 움직이는 가중치");
out.push("");
out.push("인물마다, 그 인물의 진로 10개 중 가장 크게 바뀐 값(합격·취업률 %p와 세계선 이동 %p 중 큰 쪽)으로 줄 세운 상위 5개.");
out.push("");
for (const ps of PERSONAS) {
  const top = rows
    .map((r) => [r.key, r.perPersona[ps.id] ?? 0] as const)
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5);
  out.push(`- **${ps.id}**: ${top.map(([k, v]) => `\`${k}\` ${v.toFixed(1)}`).join(", ")}`);
}
out.push("");
const dead = rows.filter((r) => r.score < 0.05).map((r) => `\`${r.key}\``);
out.push("## 이 인물·진로로는 효과가 없던 가중치");
out.push("");
out.push(
  dead.length
    ? `${dead.join(", ")}. 효과가 없다는 뜻은 아니다. 대표 인물에 해당 조건이 없거나(입대 예정, 고친 선택, 프로젝트 0개), 인물이 고른 보기가 이미 ×1이라서(4년제, 답하지 않은 준비도 질문의 기본 보기가 ×1인 진로) 배율을 바꿔도 1이다. 핵심 가치 섞는 비율(story.coreValueShare)은 부합도·만족에만 들어가서 이 세 지표에는 안 보인다.`
    : "없음.",
);
out.push("");
out.push("## 읽는 법");
out.push("");
out.push("- 위쪽 가중치일수록 값이 틀렸을 때 결과가 많이 틀린다. 파일럿 데이터로 먼저 보정할 대상(`scripts/fit-weights.ts`).");
out.push("- 0×에서 크게 바뀌면 '이 가중치가 없으면 결과가 달라진다' = 지금 결과가 이 가정에 기대고 있다는 뜻.");
out.push("- 2×에서만 크게 바뀌면 지금 값 근처에서는 덜 민감하다.");
out.push("- 숫자는 전부 엔진 값. 가중치 크기는 현재 전부 가정값이다(`data/weights.json`의 magnitude).");
out.push("");

writeFileSync("docs/민감도-분석.md", out.join("\n"));
console.log(out.join("\n"));

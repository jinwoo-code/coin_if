// 53개 진로마다 커리어넷 직업 번호와 고용24 직업 코드 후보를 3개씩 뽑는다(확정 전 팀장 확인용). 이름 검색 결과를 그대로 쓰지 않고, 여러 낱말로 찾아 이름이 가까운 순으로 줄 세운다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/job-code-candidates.ts → data/job-codes.candidates.json, docs/진로-코드-후보.md
import { writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import { JOBCODES } from "@/data/jobcodes";
import { WORLDS } from "@/lib/worlds";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
const arr = <T,>(x: T | T[] | undefined | null): T[] => (x === undefined || x === null || (x as unknown) === "" ? [] : Array.isArray(x) ? x : [x]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CN = process.env.CAREERNET_KEY!;
const JOB = process.env.WORK24_KEY_JOB!;
const WK = "https://www.work24.go.kr/cm/openApi/call/wk";

interface Cand {
  id: string;
  name: string;
  score: number;
  current?: boolean;
  info?: string;
}

const norm = (s: string) => s.replace(/[\s·()（）/,]/g, "");
function bigrams(s: string) {
  const n = norm(s);
  return new Set(Array.from({ length: Math.max(0, n.length - 1) }, (_, i) => n.slice(i, i + 2)));
}
function sim(a: string, b: string) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return norm(a) === norm(b) ? 1 : 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return (2 * hit) / (A.size + B.size);
}

// 이름만으로는 엉뚱한 직업이 먼저 나오는 진로에 더해 찾을 낱말(사람이 정함). 결과를 그대로 쓰지 않고 후보에 넣기만 한다.
const HINTS: Record<string, string[]> = {
  developer: ["웹프로그래머", "응용소프트웨어개발자", "웹개발자"],
  "data-analyst": ["빅데이터", "데이터분석", "통계"],
  marketer: ["마케팅", "브랜드매니저", "광고", "홍보"],
  "game-dev": ["게임프로그래머", "게임"],
  "mech-eng": ["기계공학기술자", "기계설계", "기계"],
  "elec-eng": ["전기공학기술자", "전기안전기술자", "전기"],
  "semi-eng": ["반도체공학기술자", "반도체"],
  "chem-eng": ["화학공학기술자", "화학공학"],
  architect: ["건축가", "건축설계"],
  "civil-eng": ["건축공학기술자", "토목공학기술자", "건설", "현장소장"],
  "food-qc": ["식품공학", "식품"],
  "env-consult": ["환경공학기술자", "환경"],
  researcher: ["자연과학연구원", "사회과학연구원", "연구원", "교수"],
  hr: ["인사사무원", "인사", "총무사무원"],
  sales: ["영업관리", "해외영업", "기술영업", "영업"],
  "trade-log": ["무역", "물류"],
  banker: ["은행", "금융"],
  "pub-office": ["공공기관", "행정사무원", "경영지원사무원", "사무원"],
  hotelier: ["호텔", "호텔관리자", "호텔지배인"],
  pd: ["방송연출", "PD", "프로듀서", "영상편집"],
  "ux-designer": ["UX", "웹디자이너", "디자이너"],
  "visual-designer": ["시각디자이너", "브랜드디자이너", "그래픽디자이너"],
  webtoon: ["웹툰", "만화"],
  fashion: ["의상디자이너", "패션", "머천다이저"],
  musician: ["작곡가", "실용음악", "음악"],
  "teacher-sec": ["중고등학교교사", "중등"],
  startup: ["기업고위임원", "경영자", "창업"],
};

// 찾을 낱말: 이름, 줄임, 지금 고용24 직업명, 흔한 꼬리를 뺀 말
function keywords(name: string, short: string, current?: string) {
  const out = new Set([name, short, current ?? ""]);
  for (const s of [name, short, current ?? ""]) {
    out.add(s.replace(/\(.*\)/, ""));
    out.add(s.replace(/\s*(공무원|기술자|엔지니어|전문가|및 연구원|사무원|개발자|개발|준비|진학|창업|컨설턴트)$/, ""));
    for (const w of s.split(/[\s·/]/)) if (w.length >= 2) out.add(w);
  }
  return [...out].map((s) => s.trim()).filter((s) => s.length >= 2);
}

async function careernet(kw: string): Promise<{ id: string; name: string }[]> {
  try {
    const r = await fetch(`https://www.career.go.kr/cnet/front/openapi/jobs.json?apiKey=${CN}&pageIndex=1&searchJobNm=${encodeURIComponent(kw)}`, { signal: AbortSignal.timeout(15000) });
    const d = (await r.json()) as { jobs?: { job_cd: number | string; job_nm: string }[] };
    return (d.jobs ?? []).map((j) => ({ id: String(j.job_cd), name: j.job_nm }));
  } catch {
    return [];
  }
}

async function work24(kw: string): Promise<{ id: string; name: string }[]> {
  try {
    const u = `${WK}/callOpenApiSvcInfo212L01.do?` + new URLSearchParams({ authKey: JOB, returnType: "XML", target: "JOBCD", srchType: "K", keyword: kw });
    const d = parser.parse(await (await fetch(u, { signal: AbortSignal.timeout(15000) })).text());
    return arr<{ jobCd: string; jobNm: string }>(d?.jobsList?.jobList).map((j) => ({ id: j.jobCd, name: j.jobNm }));
  } catch {
    return [];
  }
}

function top3(found: { id: string; name: string }[], name: string, short: string, hints: string[], current?: { code: string; name: string }): Cand[] {
  const seen = new Map<string, Cand>();
  for (const f of found) if (!seen.has(f.id)) seen.set(f.id, { ...f, score: Math.max(sim(f.name, name), sim(f.name, short), current ? sim(f.name, current.name) : 0, ...hints.map((h) => sim(f.name, h) * 1.1)) });
  if (current) seen.set(current.code, { id: current.code, name: current.name, score: 1, current: true });
  return [...seen.values()].sort((a, b) => b.score - a.score || a.name.length - b.name.length).slice(0, 3);
}

// 후보에 리포트에 쓸 칸이 실제로 오는지
async function careernetInfo(id: string) {
  try {
    const r = await fetch(`https://www.career.go.kr/cnet/front/openapi/job.json?apiKey=${CN}&seq=${id}`, { signal: AbortSignal.timeout(15000) });
    const d = (await r.json()) as { jobReadyList?: Record<string, unknown[]>; departList?: unknown[]; certiList?: unknown[] };
    const ready = Object.values(d.jobReadyList ?? {}).reduce((n, v) => n + (v?.length ?? 0), 0);
    return `준비 ${ready} 학과 ${d.departList?.length ?? 0} 자격 ${d.certiList?.length ?? 0}`;
  } catch {
    return "상세 실패";
  }
}
async function work24Info(id: string) {
  try {
    const u = `${WK}/callOpenApiSvcInfo212D03.do?` + new URLSearchParams({ authKey: JOB, returnType: "XML", target: "JOBDTL", jobGb: "1", jobCd: id, dtlGb: "3" });
    const d = parser.parse(await (await fetch(u, { signal: AbortSignal.timeout(15000) })).text());
    const w = d?.way;
    if (!w) return "상세 없음";
    return `학과 ${arr(w.relMajorList).length} 자격 ${arr(w.relCertList).length}`;
  } catch {
    return "상세 실패";
  }
}

(async () => {
  const out: { worldId: string; name: string; short: string; archetype: string; careernet: Cand[]; work24: Cand[] }[] = [];
  for (const w of WORLDS) {
    const current = JOBCODES[w.id];
    const kws = [...new Set([...keywords(w.name, w.short, current?.name), ...(HINTS[w.id] ?? [])])];
    const cn: { id: string; name: string }[] = [];
    const wk: { id: string; name: string }[] = [];
    for (const kw of kws) {
      cn.push(...(await careernet(kw)));
      wk.push(...(await work24(kw)));
      await sleep(120);
    }
    const a = top3(cn, w.name, w.short, HINTS[w.id] ?? []);
    const b = top3(wk, w.name, w.short, HINTS[w.id] ?? [], current);
    for (const c of a) c.info = await careernetInfo(c.id);
    for (const c of b) c.info = await work24Info(c.id);
    out.push({ worldId: w.id, name: w.name, short: w.short, archetype: w.archetype, careernet: a, work24: b });
    console.log(w.id, a[0]?.name ?? "-", "/", b[0]?.name ?? "-");
  }
  writeFileSync("data/job-codes.candidates.json", JSON.stringify(out, null, 1) + "\n");
  const cell = (cs: Cand[], i: number) => {
    const c = cs[i];
    if (!c) return "-";
    return `${c.current ? "★" : ""}${c.name} (${c.id}) · ${c.info}`.replace(/\|/g, "/");
  };
  const lines = ["# 진로 코드 후보(확정 전)", "", "`scripts/job-code-candidates.ts`가 2026-11-05에 실제 API로 뽑았다. 이름이 가까운 순. ★는 지금 `data/jobcodes.ts`에 정해 둔 값. '준비'는 커리어넷 준비 방법 문장 수, 학과·자격은 칸 수.", "", "| 진로 | 커리어넷 1 | 커리어넷 2 | 커리어넷 3 | 고용24 1 | 고용24 2 | 고용24 3 |", "|---|---|---|---|---|---|---|"];
  for (const r of out) lines.push(`| ${r.name} (\`${r.worldId}\`) | ${cell(r.careernet, 0)} | ${cell(r.careernet, 1)} | ${cell(r.careernet, 2)} | ${cell(r.work24, 0)} | ${cell(r.work24, 1)} | ${cell(r.work24, 2)} |`);
  writeFileSync("docs/진로-코드-후보.md", lines.join("\n") + "\n");
})();

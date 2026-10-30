// 고용24 Open API 연결(서버 전용). 서비스마다 인증키가 따로 나온다.
// 키는 .env.local에만 두고 브라우저로 보내지 않는다. 키가 없거나 호출이 실패하면 null을 돌려줘서 앱이 멈추지 않게 한다.
// 요청 주소와 파라미터는 고용24 Open API 문서(2026.10 기준)를 그대로 따른다.
import { XMLParser } from "fast-xml-parser";
import { NCS } from "@/data/ncs";

const BASE = "https://www.work24.go.kr/cm/openApi/call";

export const KEYS = {
  wanted: process.env.WORK24_KEY_WANTED, // 채용정보
  training: process.env.WORK24_KEY_TRAINING, // 국민내일배움카드 훈련과정
  major: process.env.WORK24_KEY_MAJOR, // 학과정보
  program: process.env.WORK24_KEY_PROGRAM, // 구직자취업역량 강화프로그램
  code: process.env.WORK24_KEY_CODE, // 공통코드
  duty: process.env.WORK24_KEY_DUTY, // 직무정보(표준직무기술서)
  job: process.env.WORK24_KEY_JOB, // 직업정보
};

export function hasWork24(k: keyof typeof KEYS) {
  return Boolean(KEYS[k]);
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

// 한 개면 객체, 여러 개면 배열로 오는 XML을 항상 배열로
export function list<T>(x: T | T[] | undefined | null): T[] {
  if (x === undefined || x === null || (x as unknown) === "") return [];
  return Array.isArray(x) ? x : [x];
}

async function call(path: string, params: Record<string, string | number | undefined>, as: "xml" | "json" = "xml", revalidate = 3600 * 6) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]).toString();
  const url = `${BASE}/${path}?${qs}`;
  try {
    const res = await fetch(url, { next: { revalidate } } as RequestInit);
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
    const data = as === "json" ? JSON.parse(text) : parser.parse(text);
    // 키 권한 문제 등은 HTTP 200에 <GO24><error>…</error></GO24>로 온다(예: 채용정보 '개인회원은 사용할 수 없는 OPEN-API입니다.')
    const apiError = data?.GO24?.error;
    if (apiError) throw new Error(String(apiError));
    return data;
  } catch (err) {
    console.error(`[고용24 실패] ${path}`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------- 채용정보(목록) ----------

export interface Wanted {
  id: string;
  company: string;
  title: string;
  salTpNm: string;
  sal: string;
  minSal: number | null; // 연봉이면 만원 단위로 바꿔 둔다
  maxSal: number | null;
  region: string;
  career: string;
  minEdubg: string;
  closeDt: string;
  url: string;
}

// 임금을 연봉(만원)으로: 연봉 Y는 원 단위, 월급 M은 원 단위로 온다.
function toAnnualMan(v: string | undefined, salTpNm: string): number | null {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  if (!n) return null;
  // 단위가 원으로 오는지 만원으로 오는지 문서에 없어서 크기로 판단한다(연봉 10만 미만이면 이미 만원 단위).
  if (salTpNm.includes("연봉")) return n >= 100000 ? Math.round(n / 10000) : n;
  if (salTpNm.includes("월급")) return n >= 10000 ? Math.round((n * 12) / 10000) : n * 12;
  return null; // 시급·일급은 연봉으로 바꾸지 않는다
}

export async function searchWanted(opts: { keyword: string; region?: string; newbie?: boolean; display?: number; education?: string }) {
  if (!KEYS.wanted) return null;
  const data = await call("wk/callOpenApiSvcInfo210L01.do", {
    authKey: KEYS.wanted,
    callTp: "L",
    returnType: "XML",
    startPage: 1,
    display: opts.display ?? 30,
    keyword: opts.keyword,
    region: opts.region,
    career: opts.newbie ? "N" : undefined,
    education: opts.education,
  });
  const root = data?.wantedRoot;
  if (!root) return null;
  const items: Wanted[] = list<Record<string, string>>(root.wanted).map((w) => ({
    id: w.wantedAuthNo,
    company: w.company,
    title: w.title,
    salTpNm: w.salTpNm ?? "",
    sal: w.sal ?? "",
    minSal: toAnnualMan(w.minSal, w.salTpNm ?? ""),
    maxSal: toAnnualMan(w.maxSal, w.salTpNm ?? ""),
    region: w.region ?? "",
    career: w.career ?? "",
    minEdubg: w.minEdubg ?? "",
    closeDt: w.closeDt ?? "",
    url: w.wantedMobileInfoUrl || w.wantedInfoUrl || "",
  }));
  return { total: Number(root.total ?? 0), items };
}

// ---------- 직업정보(목록) ----------

export async function searchJobs(keyword: string) {
  if (!KEYS.job) return null;
  const data = await call("wk/callOpenApiSvcInfo212L01.do", { authKey: KEYS.job, returnType: "XML", target: "JOBCD", srchType: "K", keyword });
  const root = data?.jobsList;
  if (!root) return null;
  return list<Record<string, string>>(root.jobList).map((j) => ({ code: j.jobCd, name: j.jobNm, groupCode: j.jobClcd, group: j.jobClcdNM }));
}

// ---------- 직업정보(상세: 임금·만족도·전망) ----------

// 진로의 직업코드(data/jobcodes.ts)로 임금 분위·직업 만족도·재직자 전망을 받는다.
// - 임금은 '재직자 전체'(경력 포함) 분위라서 신입 연봉이 아니다. 화면에도 그렇게 적는다.
// - 전망 서술(jobProspect)은 2016년 자료를 인용해 오래돼서 쓰지 않고, 재직자 응답 비율(jobSumProspect)만 쓴다.
export async function jobDetail(code: string) {
  if (!KEYS.job) return null;
  const data = await call("wk/callOpenApiSvcInfo212D04.do", { authKey: KEYS.job, returnType: "XML", target: "JOBDTL", jobGb: "1", jobCd: code, dtlGb: "4" }, "xml", 3600 * 24 * 7);
  const root = data?.salProspect;
  if (!root) return null;
  // 예: "조사년도:2025년, 임금 하위(25%) 6700만원, 평균(50%) 9150만원, 상위(25%) 10900만원"
  const sal = String(root.sal ?? "");
  const num = (re: RegExp) => {
    const m = sal.match(re);
    return m ? Number(m[1]) : null;
  };
  const prospect = list<Record<string, string>>(root.jobSumProspect).map((p) => ({ name: p.jobProspectNm, ratio: Number(p.jobProspectRatio), year: p.jobProspectInqYr }));
  return {
    salYear: num(/조사년도:(\d{4})/),
    salLow: num(/하위\(25%\)\s*(\d+)만원/),
    salMid: num(/평균\(50%\)\s*(\d+)만원/),
    salHigh: num(/상위\(25%\)\s*(\d+)만원/),
    satisfaction: root.jobSatis ? Number(root.jobSatis) : null, // 0~100
    prospect: prospect.filter((p) => Number.isFinite(p.ratio)),
  };
}

// ---------- 학과정보(목록) ----------

export async function searchMajors(keyword: string) {
  if (!KEYS.major) return null;
  const data = await call("wk/callOpenApiSvcInfo213L01.do", { authKey: KEYS.major, returnType: "XML", target: "MAJORCD", srchType: "K", keyword }, "xml", 3600 * 24);
  const root = data?.majorsList;
  if (!root) return null;
  return list<Record<string, string>>(root.majorList).map((m) => ({
    name: m.knowSchDptNm,
    detail: m.knowDtlSchDptNm,
    familyId: m.empCurtState1Id,
    majorId: m.empCurtState2Id,
  }));
}

// ---------- 직무정보(표준직무기술서, JSON) ----------

// 진로의 NCS 직무(data/ncs.ts)에 속한 능력단위 = '실제로 하는 일'. 정해 둔 직무가 없으면 빈 배열(엉뚱한 직무를 보여 주지 않는다).
export async function dutiesFor(worldId: string, limit = 4) {
  if (!KEYS.duty) return null;
  const duties = NCS[worldId] ?? [];
  if (!duties.length) return [];
  const results = await Promise.all(
    duties.map((d) => call("wk/callOpenApiSvcInfo215L01.do", { authKey: KEYS.duty, jobCont: d.q, limit: 60, returnType: "JSON" }, "json", 3600 * 24 * 7)),
  );
  if (results.every((r) => !r || r.message_cd)) return null;
  const units = new Map<string, { name: string; def: string; job: string; field: string }>();
  results.forEach((data, i) => {
    // result는 { "능력단위명": { job_sdvn: 직무(세분류), ablt_def: 정의, ... } } 형태
    const result = (data?.result ?? {}) as Record<string, Record<string, string>>;
    for (const [unit, u] of Object.entries(result)) {
      if (u.job_sdvn === duties[i].name && !units.has(unit)) units.set(unit, { name: unit, def: u.ablt_def, job: u.job_sdvn, field: `${u.job_lcfn} > ${u.job_mcn} > ${u.job_scfn} > ${u.job_sdvn}` });
    }
  });
  return [...units.values()].slice(0, limit);
}

// ---------- 국민내일배움카드 훈련과정 ----------

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export async function trainingCourses(opts: { keyword?: string; ncs1?: string; area1?: string; months?: number }) {
  if (!KEYS.training) return null;
  const now = new Date();
  const until = new Date(now.getTime() + (opts.months ?? 3) * 30 * 24 * 3600 * 1000);
  const data = await call("hr/callOpenApiSvcInfo310L01.do", {
    authKey: KEYS.training,
    returnType: "XML",
    outType: "1",
    pageNum: "1",
    pageSize: "50",
    srchTraStDt: ymd(now),
    srchTraEndDt: ymd(until),
    srchTraProcessNm: opts.keyword,
    srchNcs1: opts.ncs1,
    srchTraArea1: opts.area1,
    sort: "DESC",
    sortCol: "3", // 취업률 높은 순
  });
  const root = data?.HRDNet;
  if (!root) return null;
  const rows = list<Record<string, string>>(root.srchList?.scn_list);
  return {
    total: Number(root.scn_cnt ?? 0),
    items: rows.map((r) => ({
      title: r.title,
      org: r.subTitle,
      start: r.traStartDate,
      end: r.traEndDate,
      rate6: r.eiEmplRate6 ? Number(r.eiEmplRate6) : null, // 6개월 취업률(%)
      rate3: r.eiEmplRate3 ? Number(r.eiEmplRate3) : null,
      cost: r.realMan ? Number(r.realMan) : null,
      url: r.titleLink,
      address: r.address,
    })),
  };
}

// ---------- 구직자취업역량 강화프로그램(고용센터) ----------

export async function centerPrograms(display = 20) {
  if (!KEYS.program) return null;
  const data = await call("wk/callOpenApiSvcInfo217L01.do", { authKey: KEYS.program, returnType: "XML", startPage: 1, display });
  const root = data?.empPgmSchdInviteList;
  if (!root) return null;
  return list<Record<string, string>>(root.empPgmSchdInvite).map((p) => ({
    center: p.orgNm,
    name: p.pgmNm,
    course: p.pgmSubNm,
    target: p.pgmTarget,
    start: p.pgmStdt,
    end: p.pgmEndt,
    time: p.operationTime || p.openTime,
    place: p.openPlcCont,
  }));
}

// ---------- 공통코드: 지역 ----------

export async function regionCodes() {
  if (!KEYS.code) return null;
  const data = await call("wk/callOpenApiSvcInfo21L01.do", { authKey: KEYS.code, returnType: "XML", target: "CMCD", dtlGb: "1" }, "xml", 3600 * 24 * 30);
  const root = data?.cmcdRegion;
  if (!root) return null;
  return list<Record<string, unknown>>(root.oneDepth).map((o) => ({ code: String(o.regionCd), name: String(o.regionNm) }));
}

// 우리 앱의 '사는 곳'을 고용24 지역코드로(코드는 공통코드 API에서 이름으로 찾는다)
export const REGION_NAMES: Record<string, string[]> = {
  서울: ["서울"],
  "경기·인천": ["경기", "인천"],
  "지방 광역시": ["부산", "대구", "광주", "대전", "울산"],
  "그 외 지역": [],
};

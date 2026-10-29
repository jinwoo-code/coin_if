// 고용24 Open API 연결(서버 전용). 서비스마다 인증키가 따로 나온다.
// 키는 .env.local에만 두고 브라우저로 보내지 않는다. 키가 없거나 호출이 실패하면 null을 돌려줘서 앱이 멈추지 않게 한다.
// 요청 주소와 파라미터는 고용24 Open API 문서(2026.10 기준)를 그대로 따른다.
import { XMLParser } from "fast-xml-parser";

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
    return as === "json" ? JSON.parse(text) : parser.parse(text);
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

// 평균 연봉 구간·전망 조건으로 직업 목록 → 직업마다 연봉 구간과 전망을 알 수 있다.
// (직업 상세 API 문서가 아직 없어서, 조건 검색 결과를 모아 '이 직업은 어느 구간'인지 역으로 찾는다.)
export const SAL_BANDS: Record<string, string> = { "10": "3천만원 미만", "20": "3~4천만원", "30": "4~5천만원", "40": "5천만원 이상" };
export const PROSPECTS: Record<string, string> = { "1": "증가", "2": "다소 증가", "3": "유지", "4": "다소 감소", "5": "감소" };

export async function jobsByCondition(avgSal?: string, prospect?: string) {
  if (!KEYS.job) return null;
  const data = await call("wk/callOpenApiSvcInfo212L01.do", { authKey: KEYS.job, returnType: "XML", target: "JOBCD", srchType: "C", avgSal, prospect }, "xml", 3600 * 24);
  const root = data?.jobsList;
  if (!root) return null;
  return list<Record<string, string>>(root.jobList).map((j) => ({ code: j.jobCd, name: j.jobNm }));
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

export async function dutiesFor(jobCont: string, limit = 5) {
  if (!KEYS.duty) return null;
  const data = await call("wk/callOpenApiSvcInfo215L01.do", { authKey: KEYS.duty, jobCont, limit, returnType: "JSON" }, "json", 3600 * 24 * 7);
  if (!data || data.message_cd) return null;
  // result는 { "능력단위명": {...} } 형태
  const result = (data.result ?? {}) as Record<string, Record<string, string>>;
  return Object.values(result).map((u) => ({ name: u.job_sdvn, def: u.ablt_def, field: `${u.job_lcfn} > ${u.job_mcn} > ${u.job_scfn}` }));
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

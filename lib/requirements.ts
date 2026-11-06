// 프리미엄 리포트 1단계: 진로마다 '필요한 것' 목록(RequirementItem[]). docs/리포트-설계-근거.md.
// 여기는 합치기만 한다(네트워크 없음). 자격증·능력 이름은 공식 데이터 또는 공식 문서로 직접 정리한 값(curated)에서만, 시간·출처 없는 경험은 가정값으로 표시한다.
import experience from "@/data/req-experience.json";
import hoursData from "@/data/req-hours.json";

export type ReqKind = "skill" | "cert" | "experience" | "exam" | "step";
export type ReqSource = "ncs" | "careernet" | "work24-job" | "work24-wanted" | "interview" | "curated" | "assumed";
export type ReqGrade = "official" | "curated" | "interview" | "assumed";
export type CertPolicy = "curated-only" | "ai-filter";

export interface RequirementItem {
  id: string;
  kind: ReqKind;
  name: string;
  grade: ReqGrade; // official 공식 API, curated 공식 문서로 직접 정리, interview 현직자, assumed 가정값
  source: ReqSource;
  detail?: string;
  required?: boolean; // 없으면 응시·취득이 안 되는 것
  refUrl?: string;
  alsoIn?: ReqSource[]; // 같은 항목이 나온 다른 출처
  ref?: string; // 출처 이름·URL
  def?: string; // 능력단위 정의
  postingShare?: number; // 공고 등장 비율(0~1). 채용정보 기관 키 전까지 비어 있다
  postingN?: number; // 집계한 공고 수
  hours?: { value: number; grade: "official" | "assumed" | "interview" }; // official은 NCS 훈련 기준 시간
  officialUrl?: string; // 자격증 공식 사이트(시험 일정은 연동하지 않는다)
  ncsCriteria?: string[]; // 능력단위 수행준거(NCS). 포트폴리오 체크리스트
  ncsElements?: { name: string; criteria: string[] }[]; // 능력단위요소별 수행준거. 증거물 완성 기준을 요소마다 하나씩 고른다
  ksa?: string[]; // 공부 목록: 능력단위의 지식·기술 이름(NCS)
  evalConsider?: string[]; // 평가 고려사항(NCS). 증거물 형식의 근거
  positionLevel?: number; // 이 단위를 맡는 가장 낮은 NCS 직책 수준. 신입 순서
  entry?: boolean; // false면 신입 뒤에 익힐 능력(수준 기준은 가정값)
  ncsRelated?: boolean; // NCS 관련자격종목에 있는 자격
}

// 공고 집계가 없을 때 화면 문구. postingShare가 들어오면 안 쓴다.
export const POSTING_NONE = "공고 집계 없음(기관 키 필요)";
export const postingLabel = (i: RequirementItem) => (i.postingShare === undefined ? POSTING_NONE : `공고 ${i.postingN}개 중 ${Math.round(i.postingShare * (i.postingN ?? 0))}개가 요구`);

export interface NcsUnit {
  name: string;
  def: string;
  job: string;
  ksa: string[];
  criteria?: string[];
  elements?: { name: string; criteria: string[] }[];
  evalConsider?: string[];
  trainTime?: number | null;
  positionLevel?: number;
  entry?: boolean;
  ref?: string;
}
export interface NcsBasic {
  name: string;
  desc: string;
  subs: string[];
}
export interface CareernetSource {
  name: string;
  certs: string[];
  departs: string[];
  prep: { kind: "recruit" | "certificate" | "training" | "curriculum"; text: string }[];
}
export interface Work24Source {
  name: string;
  certs: string[];
  majors: string[];
  techn: string;
}
export interface RequirementSources {
  ncs: NcsUnit[];
  careernet: CareernetSource[];
  work24: Work24Source[];
  ncsCerts?: { name: string; job: string }[]; // NCS 관련자격종목
  ncsBasics?: NcsBasic[]; // NCS 직업기초능력(공공기관 사무직)
}
export interface CuratedFile {
  worldId: string;
  checkedAt: string;
  sources: Record<string, { name: string; url: string; version?: string }>;
  certCandidates: string[]; // 시험형·면허형은 자격증 후보가 이것뿐이다
  noBonusNote?: string;
  sourceNote?: string;
  items: { id: string; kind: ReqKind; name: string; detail?: string; grade: "curated" | "assumed"; ref?: string; required?: boolean; officialUrl?: string; hours?: { value: number; grade: "assumed" } }[];
}
export const certPolicyOf = (archetype: string): CertPolicy => (archetype === "exam" || archetype === "license" ? "curated-only" : "ai-filter");
export interface SkillGroup {
  id: string;
  name: string;
  itemIds: string[];
}
export interface FilteredCert {
  name: string;
  why: string;
}
// 팀이 관련 없다고 본 자격을 뺀다(data/cert-exclude.json). 뺀 것은 filter.dropped에 남겨 다시 빌드해도 AI를 안 부른다.
export function applyCertExclude(r: Requirements, exclude: Record<string, string> | undefined): Requirements {
  if (!exclude) return r;
  const hits = r.items.filter((i) => i.kind === "cert" && !i.required && exclude[i.name]);
  if (!hits.length) return r;
  const names = new Set(hits.map((i) => i.name));
  const f = r.filter ?? { mode: "none" as const, dropped: [], invented: 0 };
  return { ...r, items: r.items.filter((i) => !(i.kind === "cert" && names.has(i.name))), filter: { ...f, dropped: [...f.dropped, ...hits.map((i) => ({ name: i.name, why: `팀 검토: ${exclude[i.name]}` }))] } };
}

export interface Requirements {
  worldId: string;
  certPolicy: CertPolicy;
  filter?: { mode: "ai" | "none" | "curated"; dropped: FilteredCert[]; invented: number }; // 걸러진 자격증과 목록에 없어 버린 AI 응답 수
  notes?: string[]; // 가산점 없음 등 진로 전체 안내
  skillGroups?: SkillGroup[]; // 능력단위를 3~4개로 묶은 것. 리포트에서 '할 줄 알아요/조금/아직'으로 묻는다
  items: RequirementItem[];
  prep: { source: ReqSource; ref: string; text: string }[]; // 되는 길(문장. 항목이 아니라 설명)
  majors: string[];
  baseDate: string; // 기준일
  stale: boolean; // 공식 API가 실패해서 지난 값을 쓰면 true
  note?: string;
}

const key = (s: string) => s.replace(/[\s·ㆍ()（）_-]/g, "").toLowerCase();
const certKey = (s: string) => key(s).replace(/\d+급$/, ""); // '응급구조사 1·2급'과 '응급구조사'는 같은 자격

// 고용24 자격 칸은 한 글자열에 여러 개를 줄여 쓴다('정보처리기능사, 산업기사, 기사(국가기술)'). 낱개 이름으로 편다.
const GRADE_WORD = /^(기능사|산업기사|기사|기술사|기능장)$/;
const ALIAS: Record<string, string> = {
  컴퓨터그래픽운용기능사: "컴퓨터그래픽스운용기능사",
  전자계산조직응용기사: "전자계산기조직응용기사",
  전자계산조직응용기술사: "전자계산기조직응용기술사",
  CISA: "정보시스템감사사(CISA)",
  "자동차운전면허 제 1종 보통": "자동차운전면허",
};
export function parseCerts(raw: string): string[] {
  const s = raw
    .replace(/《(일반|예비)》/g, "($1)")
    .replace(/《[^》]*》/g, "")
    .replace(/\((국가기술|국가전문|외국|국가공인 ?민간|비공인 ?민간|이상 [^)]*|문화체육관광부)\)/g, "")
    .replace(/(\d)\s*,\s*(?=\d)/g, "$1·") // 1, 2, 3급 → 1·2·3급
    .replace(/[∙•]/g, ",");
  const out: string[] = [];
  let stem = "";
  for (const part of s.split(",")) {
    const t = part.trim();
    if (!t) continue;
    if (GRADE_WORD.test(t)) {
      if (stem) out.push(stem + t);
      continue;
    }
    const compact = t.replace(/\s+(?=(기능사|산업기사|기사|기술사|기능장)$)/, "");
    stem = compact.match(/^(.+?)(기능사|산업기사|기사|기술사|기능장)$/)?.[1] ?? "";
    out.push(compact);
  }
  return [...new Set(out.map((n) => ALIAS[n] ?? n))];
}

// 자격증 공식 사이트. 시험 일정은 안 붙이고 어디서 확인하는지만. 시행 기관을 확실히 아는 것만, 모르면 비운다.
const KUKSI = /^(간호사|조산사|물리치료사|작업치료사|임상병리사|방사선사|치과위생사|치과기공사|의사|치과의사|한의사|약사|한약사|영양사|위생사|보건교육사|안경사|의지보조기기사|응급구조사)/;
const NOT_QNET = /^(빅데이터분석기사|정보보안기사|정보보안산업기사)/; // 이름은 기사지만 Q-Net 시험이 아니다
const QNET = /(기술사|기능장|산업기사|기사|기능사)$|^(세무사|사회복지사|사회조사분석사|미용사|물류관리사|유통관리사)/;
export function officialUrlOf(cert: string): string | undefined {
  const n = cert.replace(/\s/g, "");
  if (KUKSI.test(n)) return "https://www.kuksiwon.or.kr";
  if (/^(빅데이터분석기사|데이터분석)/.test(n)) return "https://www.dataq.or.kr";
  if (!NOT_QNET.test(n) && QNET.test(n)) return "https://www.q-net.or.kr";
  return undefined;
}

export function hoursOf(kind: "skill" | "cert" | "experience", name: string, assumed?: number): RequirementItem["hours"] {
  const d = hoursData as { defaults: Record<"skill" | "cert" | "experience", number>; certByPattern: { pattern: string; hours: number }[]; byName: Record<string, { value: number; grade: "assumed" | "interview" }> };
  const exact = d.byName[name.replace(/\s/g, "")];
  if (exact) return exact;
  if (assumed !== undefined) return { value: assumed, grade: "assumed" };
  if (kind === "cert") {
    const n = name.replace(/\s/g, "");
    const hit = d.certByPattern.find((p) => new RegExp(p.pattern).test(n));
    return { value: hit?.hours ?? d.defaults.cert, grade: "assumed" };
  }
  return { value: d.defaults[kind], grade: "assumed" };
}

// NCS 직업기초능력 10개. 맞는 직업이 없는 공공기관 사무직의 기본 능력.
const NCS_BASIC = ["의사소통능력", "수리능력", "문제해결능력", "자기개발능력", "자원관리능력", "대인관계능력", "정보능력", "기술능력", "조직이해능력", "직업윤리"];
const BASIC_WORLDS = new Set(["pub-office"]);

export function buildRequirements(worldId: string, archetype: string, src: RequirementSources, baseDate: string, stale = false, note?: string, curated?: CuratedFile | null): Requirements {
  const policy = certPolicyOf(archetype);
  const items: RequirementItem[] = [];
  const byKey = new Map<string, RequirementItem>();
  const add = (i: RequirementItem) => {
    const k = `${i.kind}:${i.kind === "cert" ? certKey(i.name) : key(i.name)}`;
    const old = byKey.get(k);
    if (!old) {
      byKey.set(k, i);
      items.push(i);
      return;
    }
    if (old.source !== i.source && !old.alsoIn?.includes(i.source)) old.alsoIn = [...(old.alsoIn ?? []), i.source];
    if (i.ref && old.ref && !old.ref.includes(i.ref)) old.ref = `${old.ref} · ${i.ref}`;
    if (i.name.length > old.name.length && i.kind === "cert") old.name = i.name;
    if (!old.def && i.def) old.def = i.def;
    if (i.entry) old.entry = true;
  };

  for (const u of src.ncs)
    add({
      id: `ncs:${key(u.name)}`,
      kind: "skill",
      name: u.name,
      grade: "official",
      source: "ncs",
      ref: u.ref ?? `고용24 직무정보(NCS ${u.job})`,
      def: u.def,
      ksa: u.ksa,
      ncsCriteria: u.criteria,
      ncsElements: u.elements,
      evalConsider: u.evalConsider,
      positionLevel: u.positionLevel,
      entry: u.entry,
      hours: u.trainTime ? { value: u.trainTime, grade: "official" } : hoursOf("skill", u.name),
    });
  if (BASIC_WORLDS.has(worldId))
    for (const n of NCS_BASIC) {
      const b = src.ncsBasics?.find((x) => x.name === n);
      add({ id: `ncs-basic:${key(n)}`, kind: "skill", name: n, grade: "official", source: "ncs", ref: "NCS 직업기초능력(ncs.go.kr)", def: b?.desc, ksa: b?.subs, hours: hoursOf("skill", n) });
    }

  // 시험형·면허형의 자격증은 공식 목록을 그대로 쓰지 않는다(경찰에 전자산업기사가 나오는 식이라서). 직접 정리한 후보만.
  if (policy !== "curated-only") {
    for (const c of src.ncsCerts ?? [])
      for (const n of parseCerts(c.name)) add({ id: `cert:${certKey(n)}`, kind: "cert", name: n, grade: "official", source: "ncs", ref: `NCS 관련자격종목(${c.job})`, officialUrl: officialUrlOf(n), hours: hoursOf("cert", n) });
    for (const c of src.careernet)
      for (const n of c.certs.flatMap(parseCerts))
        add({ id: `cert:${certKey(n)}`, kind: "cert", name: n, grade: "official", source: "careernet", ref: `커리어넷 직업정보(${c.name})`, officialUrl: officialUrlOf(n), hours: hoursOf("cert", n) });
    for (const w of src.work24)
      for (const n of w.certs.flatMap(parseCerts))
        add({ id: `cert:${certKey(n)}`, kind: "cert", name: n, grade: "official", source: "work24-job", ref: `고용24 직업정보(${w.name})`, officialUrl: officialUrlOf(n), hours: hoursOf("cert", n) });
  }

  if (curated) {
    for (const c of curated.items) {
      const s = c.ref ? curated.sources[c.ref] : undefined;
      add({
        id: `curated:${c.id}`,
        kind: c.kind,
        name: c.name,
        detail: c.detail,
        grade: c.grade,
        source: c.grade === "curated" ? "curated" : "assumed",
        required: c.required,
        ref: s ? `${s.name}${s.version ? ` (${s.version})` : ""}` : "팀이 정한 가정값",
        refUrl: s?.url,
        officialUrl: c.officialUrl,
        hours: c.hours,
      });
    }
  } else {
    const exp = (experience as unknown as Record<string, { id: string; name: string; hours: number }[]>)[archetype] ?? [];
    for (const e of exp) add({ id: `exp:${archetype}:${e.id}`, kind: "experience", name: e.name, grade: "assumed", source: "assumed", ref: "팀이 정한 가정값", hours: hoursOf("experience", e.name, e.hours) });
  }

  const related = new Set((src.ncsCerts ?? []).flatMap((c) => parseCerts(c.name)).map(certKey));
  for (const i of items) if (i.kind === "cert" && related.has(certKey(i.name))) i.ncsRelated = true;

  const prep = [
    ...src.careernet.flatMap((c) => c.prep.map((p) => ({ source: "careernet" as const, ref: `커리어넷 직업정보(${c.name})`, text: p.text }))),
    ...src.work24.filter((w) => w.techn).map((w) => ({ source: "work24-job" as const, ref: `고용24 직업정보(${w.name})`, text: w.techn })),
  ];
  const majors = [...new Set([...src.careernet.flatMap((c) => c.departs), ...src.work24.flatMap((w) => w.majors)])];
  const notes = [curated?.noBonusNote, curated?.sourceNote].filter((x): x is string => Boolean(x));
  return { worldId, certPolicy: policy, filter: policy === "curated-only" ? { mode: "curated", dropped: [], invented: 0 } : undefined, notes: notes.length ? notes : undefined, items, prep, majors, baseDate, stale, note };
}

// AI 거르기 응답 적용. 후보 id만 믿는다: 목록에 없는 id는 버리고 세고, 답에 없는 자격은 남긴다(모르면 안 지운다).
export function applyCertFilter(r: Requirements, res: { drop?: { id?: string; why?: string }[] } | null): Requirements {
  if (!res) return { ...r, filter: { mode: "none", dropped: [], invented: 0 } };
  const certs = new Map(r.items.filter((i) => i.kind === "cert").map((i) => [i.id, i]));
  const dropIds = new Map<string, string>();
  let invented = 0;
  for (const d of res.drop ?? []) {
    if (d.id && certs.has(d.id)) dropIds.set(d.id, String(d.why ?? "").slice(0, 60));
    else invented++;
  }
  const dropped = [...dropIds].map(([id, why]) => ({ name: certs.get(id)!.name, why }));
  return { ...r, items: r.items.filter((i) => !dropIds.has(i.id)), filter: { mode: "ai", dropped, invented } };
}

export interface RequirementsFile {
  worldId: string;
  builtAt: string;
  default: Requirements;
  byFamily?: Record<string, Requirements>;
}

const nameOfGroup = (items: { name: string }[]) => (items.length > 1 ? `${items[0].name} 등 ${items.length}개` : items[0].name);

// AI 없이 묶기: 4개 이하면 낱개로, 많으면 목록 순서대로 4등분.
export function chunkSkills(items: { id: string; name: string }[]): SkillGroup[] {
  const per = Math.max(1, Math.ceil(items.length / 4));
  const out: SkillGroup[] = [];
  for (let i = 0; i < items.length; i += per) {
    const part = items.slice(i, i + per);
    out.push({ id: `g${out.length + 1}`, name: nameOfGroup(part), itemIds: part.map((x) => x.id) });
  }
  return out;
}

// AI가 묶은 결과 적용. 후보 id만 믿는다: 목록에 없는 id는 버리고 세고, 빠진 능력은 마지막 묶음에 넣는다. 응답이 쓸모없으면 AI 없이 묶는다.
export function applySkillGroups(items: { id: string; name: string }[], res: { groups?: { name?: string; ids?: string[] }[] } | null): { groups: SkillGroup[]; invented: number; ai: boolean } {
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  let invented = 0;
  const groups: SkillGroup[] = [];
  for (const g of res?.groups ?? []) {
    const ids: string[] = [];
    for (const id of g.ids ?? []) {
      if (!known.has(id)) invented++;
      else if (!seen.has(id)) (seen.add(id), ids.push(id));
    }
    if (ids.length) groups.push({ id: `g${groups.length + 1}`, name: String(g.name ?? "").slice(0, 20) || nameOfGroup(items.filter((i) => ids.includes(i.id))), itemIds: ids });
  }
  if (groups.length < 2 || groups.length > 4) return { groups: chunkSkills(items), invented, ai: false };
  const left = items.filter((i) => !seen.has(i.id)).map((i) => i.id);
  groups[groups.length - 1].itemIds.push(...left);
  return { groups, invented, ai: true };
}

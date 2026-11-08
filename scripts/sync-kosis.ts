// KOSIS 고용형태별근로실태조사 '직종, 성별 임금 및 근로조건'(118 / DT_118N_PAYM41)에서 직종(KSCO 7차)별 평균근속년수·근로자수를 받아
// data/kosis/tenure-by-occupation.json에 저장하고, 진로별 근속 목표(청년 18.4개월 × 직종 근속 ÷ 전직종 근속)를 표로 보여 준다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/sync-kosis.ts   (KOSIS_API_KEY 필요, 키는 출력하지 않음)
//       --offline: 저장된 파일로 표만 다시 만든다
import { readFileSync, writeFileSync } from "node:fs";
import targets from "../data/calibration-targets.json";
import ksco from "../data/kosis/ksco-map.json";
import { WORLDS } from "../lib/worlds";

const OUT = "data/kosis/tenure-by-occupation.json";
const ORG = "118";
const TBL = "DT_118N_PAYM41";
const ITEMS = {
  tenure: "13103205070DURATION",
  workers: "13103205070WORKERCNT",
};
const SEX_ALL = "13102732805SEXS.0";

type Row = { name: string; tenure: number; workers: number };
type Saved = {
  source: {
    org: string;
    survey: string;
    table: string;
    tblId: string;
    year: string;
    url: string;
    fetched: string;
  };
  rows: Record<string, Row>;
};

async function fetchTable(): Promise<Saved> {
  const key = process.env.KOSIS_API_KEY;
  if (!key) throw new Error("KOSIS_API_KEY가 없어요(.env.local)");
  const p = new URLSearchParams({
    method: "getList",
    apiKey: key,
    orgId: ORG,
    tblId: TBL,
    itmId: `${ITEMS.tenure} ${ITEMS.workers}`,
    objL1: "ALL",
    objL2: SEX_ALL,
    format: "json",
    jsonVD: "Y",
    prdSe: "Y",
    newEstPrdCnt: "1",
  });
  const res = await fetch(
    `https://kosis.kr/openapi/Param/statisticsParameterData.do?${p}`,
  );
  const text = await res.text();
  let data: {
    C1: string;
    C1_NM: string;
    ITM_ID: string;
    DT: string;
    PRD_DE: string;
  }[];
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`KOSIS 응답을 못 읽었어요(HTTP ${res.status})`);
  }
  if (!Array.isArray(data))
    throw new Error(
      `KOSIS 오류: ${JSON.stringify(data).replaceAll(key, "***")}`,
    );
  const rows: Record<string, Row> = {};
  let year = "";
  for (const x of data) {
    const id = x.C1.replace("210514KSCO7_", "");
    rows[id] ??= { name: x.C1_NM.trim(), tenure: NaN, workers: NaN };
    if (x.ITM_ID === ITEMS.tenure) rows[id].tenure = Number(x.DT);
    if (x.ITM_ID === ITEMS.workers) rows[id].workers = Number(x.DT);
    year = x.PRD_DE;
  }
  return {
    source: {
      org: "고용노동부",
      survey: "고용형태별근로실태조사",
      table: "직종, 성별 임금 및 근로조건(전 연령, 남녀 전체)",
      tblId: `${ORG}/${TBL}`,
      year,
      url: `https://kosis.kr/statHtml/statHtml.do?orgId=${ORG}&tblId=${TBL}`,
      fetched: new Date().toISOString().slice(0, 10),
    },
    rows,
  };
}

async function main() {
  const saved: Saved = process.argv.includes("--offline")
    ? JSON.parse(readFileSync(OUT, "utf8"))
    : await fetchTable();
  if (!process.argv.includes("--offline"))
    writeFileSync(OUT, JSON.stringify(saved, null, 2) + "\n");

  const all = saved.rows["0"];
  const youth = (
    targets as { targets: { id: string; value: number }[] }
  ).targets.find((t) => t.id === "common.firstJobTenure")!.value;
  const map = (
    ksco as {
      map: Record<
        string,
        { code: string | null; match: string; note?: string }
      >;
    }
  ).map;
  const SKIP = new Set(["exam", "public", "grad", "startup"]);

  console.log(
    `# 진로별 근속 목표(${saved.source.survey} ${saved.source.year}, ${saved.source.tblId})\n`,
  );
  console.log(
    `전직종 평균근속 ${all.tenure}년(근로자 ${all.workers.toLocaleString()}명). 진로 목표 = ${youth}개월 × 직종 근속 ÷ ${all.tenure}년. 전 연령 값이라 나이 든 사람이 많은 직종은 길게 나온다(상대값만 씀).\n`,
  );
  console.log(
    "| 진로 | 유형 | KSCO | 직종 | 맞음 | 직종 근속(년) | 배수 | 진로 목표(개월) | 근로자 수 | 보정 대상 |",
  );
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  const miss: string[] = [];
  for (const w of WORLDS) {
    const m = map[w.id];
    const r = m?.code ? saved.rows[m.code] : undefined;
    const ratio = r ? r.tenure / all.tenure : NaN;
    const target = r ? youth * ratio : NaN;
    const use = !SKIP.has(w.archetype) && Boolean(r);
    if (!m || m.match !== "맞음")
      miss.push(
        `${w.short}(${m?.match ?? "코드 없음"}${m?.note ? `: ${m.note}` : ""})`,
      );
    console.log(
      `| ${w.short} | ${w.archetype} | ${m?.code ?? "-"} | ${r?.name ?? "-"} | ${m?.match ?? "없음"} | ${r ? r.tenure : "-"} | ${r ? ratio.toFixed(2) : "-"} | ${r ? target.toFixed(1) : "-"} | ${r ? r.workers.toLocaleString() : "-"} | ${use ? "예" : "아니오(참고)"} |`,
    );
  }
  console.log(
    `\n코드가 '맞음'이 아닌 진로 ${miss.length}개: ${miss.join(", ")}`,
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

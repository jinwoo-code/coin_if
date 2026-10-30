// 고용24 API에서 진로별 '현실 데이터'를 받아 data/jobdata/에 저장한다.
// 실시간으로만 부르지 않고 이렇게 미리 받아 두는 이유: 발표장 네트워크가 끊기거나 호출 제한에 걸려도 근거가 사라지지 않게.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/sync-jobdata.ts   (.env.local에 WORK24_KEY_* 필요)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// .env.local 읽기(lib/work24가 import될 때 키를 읽으므로 먼저)
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

type Fact = { label: string; value: string; source: string; year: string; url?: string };

async function main() {
  const w24 = await import("../lib/work24");
  const { WORLDS } = await import("../lib/worlds");
  const today = new Date().toISOString().slice(0, 10);
  const facts: Record<string, Fact[]> = JSON.parse(readFileSync("data/jobdata/extra-facts.json", "utf8"));
  const market: Record<string, unknown> = {};

  // 직업정보: 연봉 구간·전망별 직업 목록을 한 번씩 받아 두고 이름으로 찾는다.
  const band = new Map<string, string>();
  const prospect = new Map<string, string>();
  for (const k of Object.keys(w24.SAL_BANDS)) for (const j of (await w24.jobsByCondition(k, undefined)) ?? []) band.set(j.name, w24.SAL_BANDS[k]);
  for (const k of Object.keys(w24.PROSPECTS)) for (const j of (await w24.jobsByCondition(undefined, k)) ?? []) prospect.set(j.name, w24.PROSPECTS[k]);
  console.log(`직업정보: 연봉 구간 ${band.size}개, 전망 ${prospect.size}개 직업`);

  for (const w of WORLDS) {
    const got: Fact[] = [];
    const kw = w.short.replace(/[·(].*$/, "").trim();

    // 1) 직업정보: 이름이 비슷한 직업의 평균 연봉 구간·전망
    const jobs = (await w24.searchJobs(kw)) ?? [];
    const hit = jobs.find((j) => band.has(j.name) || prospect.has(j.name));
    if (hit) {
      if (band.has(hit.name)) got.push({ label: `${hit.name} 평균 연봉`, value: band.get(hit.name)!, source: "고용24 직업정보", year: today });
      if (prospect.has(hit.name)) got.push({ label: `${hit.name} 일자리 전망`, value: prospect.get(hit.name)!, source: "고용24 직업정보", year: today });
    }

    // 2) 채용정보: 지금 올라온 신입 공고 수와 제시 연봉(시험·대학원·창업은 공고가 의미 없어서 뺀다)
    if (!["exam", "grad", "startup"].includes(w.archetype)) {
      const r = await w24.searchWanted({ keyword: kw, newbie: true, display: 100 });
      if (r) {
        const sals = r.items.map((i) => i.minSal).filter((x): x is number => x !== null && x > 1500 && x < 15000).sort((a, b) => a - b);
        const med = sals.length ? sals[Math.floor(sals.length / 2)] : null;
        got.push({
          label: `고용24 신입 채용 공고('${kw}')`,
          value: `${r.total.toLocaleString("ko-KR")}건${med ? ` · 제시 연봉 가운데 값 ${med.toLocaleString("ko-KR")}만원(연봉·월급 표기 ${sals.length}건 기준)` : ""}`,
          source: "고용24 채용정보",
          year: today,
        });
        market[w.id] = { newbieTotal: r.total, salaryMedian: med, salarySample: sals.length, at: today };
      }
    }

    // 3) 직무정보: 이 일에서 실제로 하는 일(NCS 능력단위)
    const duties = (await w24.dutiesFor(w.id, 4)) ?? [];
    if (duties.length) got.push({ label: `실제로 하는 일(NCS ${[...new Set(duties.map((d) => d.job))].join(", ")} 능력단위)`, value: duties.map((d) => d.name).join(", "), source: "고용24 직무정보", year: today });

    // 4) 국비 훈련과정: 이 분야 과정의 6개월 취업률(국비 교육 갈림길의 근거)
    if (["open", "portfolio", "trade"].includes(w.archetype)) {
      const t = await w24.trainingCourses({ keyword: kw, months: 3 });
      const rates = (t?.items ?? []).map((i) => i.rate6).filter((x): x is number => x !== null && x > 0).sort((a, b) => a - b);
      if (t && t.total > 0)
        got.push({
          label: `'${kw}' 국비 훈련과정(3개월 안 개강)`,
          value: `${t.total}개${rates.length ? ` · 6개월 취업률 가운데 값 ${rates[Math.floor(rates.length / 2)]}%` : ""}`,
          source: "고용24 국민내일배움카드 훈련과정",
          year: today,
        });
    }

    // 고용24에서 온 예전 값은 바꾸고, 사람이 손으로 넣은 값은 남긴다.
    facts[w.id] = [...(facts[w.id] ?? []).filter((f) => !f.source.startsWith("고용24")), ...got];
    console.log(`${w.short}: ${got.length}개`);
  }

  writeFileSync("data/jobdata/extra-facts.json", JSON.stringify(facts, null, 2));
  writeFileSync("data/jobdata/market.json", JSON.stringify(market, null, 2));
  console.log("저장: data/jobdata/extra-facts.json, data/jobdata/market.json");
}

main();

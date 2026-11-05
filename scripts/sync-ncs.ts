// NCS 직무 데이터를 받아 data/ncs/{직무코드}.json으로 저장한다. 앱은 이 파일로 만든 목록만 읽는다(배포에서 이 키를 안 쓴다).
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json --env-file=.env.local scripts/sync-ncs.ts [--only 20010202,...]
// 호출이 실패한 직무는 파일을 안 바꾸고 끝에 이름을 적는다.
import { readFileSync, writeFileSync } from "node:fs";
import type { NcsDutyFile, NcsDutyUnit } from "@/lib/ncs-data";

const BASE = "https://apis.data.go.kr/B490007/ncsInfo";
const raw = (process.env.DATA_GO_KR_KEY ?? "").trim();
if (!raw) {
  console.log("DATA_GO_KR_KEY가 없어요");
  process.exit(1);
}
const KEY = raw.includes("%") ? raw : encodeURIComponent(raw);
type Json = { data?: any; dataInfo?: { code?: string; message?: string; totCnt?: number } }; // eslint-disable-line @typescript-eslint/no-explicit-any

// 기능마다 초당 30회 제한이 있어(HTTP 429) 전체를 초당 10회로 줄 세운다.
let next = 0;
async function gate() {
  const now = Date.now();
  const at = Math.max(now, next);
  next = at + 100;
  if (at > now) await new Promise((res) => setTimeout(res, at - now));
}

async function call(op: string, params: Record<string, string>, pageNo = 1): Promise<Json> {
  const q = new URLSearchParams({ pageNo: String(pageNo), numOfRows: "1000", returnType: "json", ...params }).toString();
  let last = "";
  for (let i = 0; i < 5; i++) {
    try {
      await gate();
      const r = await fetch(`${BASE}/${op}?serviceKey=${KEY}&${q}`, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = JSON.parse(await r.text()) as Json;
      // 000 정상, 그 밖은 '값 없음'도 빈 데이터로 온다. 키·형식 오류만 실패로 본다.
      if (j.dataInfo?.code === "009") throw new Error(`${op} 인자 오류`);
      return j;
    } catch (e) {
      last = String(e).split(KEY).join("[KEY]");
      await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
    }
  }
  throw new Error(`${op}: ${last.slice(0, 120)}`);
}
async function allRows(op: string, params: Record<string, string>): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const first = await call(op, params);
  const rows = [...(first.data ?? [])];
  const tot = first.dataInfo?.totCnt ?? rows.length;
  for (let p = 2; rows.length < tot; p++) {
    const j = await call(op, params, p);
    if (!j.data?.length) break;
    rows.push(...j.data);
  }
  return rows;
}
const strip = (s: string) => String(s ?? "").replace(/^\s*\d+\s*[.)]\s*/, "").trim();
const uniq = (a: string[]) => [...new Set(a.filter(Boolean))];
const pool = async <T,>(items: T[], n: number, f: (t: T) => Promise<void>) => {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await f(items[i++]);
  }));
};

async function one(dutyCd: string, dutyNm: string, dutyDef: string, withBasics: boolean): Promise<NcsDutyFile> {
  const [unitRows, ksa, csdr, clpos] = await Promise.all([allRows("ncsCompeUnitInfo", { dutyCd }), allRows("ncsKsaInfo", { dutyCd }), call("ncsTrainCsdrInfo", { dutyCd }), call("ncsClposInfo", { dutyCd })]);
  const units: NcsDutyUnit[] = [];
  const basics = new Map<string, { name: string; desc: string; subs: string[] }>();
  await pool(unitRows, 4, async (u) => {
    const cd = String(u.compUnitCd);
    const [ev, tr, jb] = await Promise.all([call("ncsEvalInfo", { dutyCd, compUnitCd: cd }), call("ncsCompeTrainInfo", { dutyCd, compUnitCd: cd }), withBasics ? call("ncsjobInfo", { dutyCd, compUnitCd: cd }) : Promise.resolve({ data: [] } as Json)]);
    const mine = ksa.filter((k) => String(k.compUnitCd) === cd);
    const names = uniq(mine.map((k) => String(k.compUnitFactrName ?? "")));
    units.push({
      compUnitCd: cd,
      ncsClCd: String(u.ncsClCd ?? ""),
      name: strip(u.compUnitName),
      def: String(u.compUnitDef ?? ""),
      level: Number(u.compUnitLevel) || 0,
      trainTime: tr.data?.timeData?.[0]?.trainTime ?? null,
      elements: names.map((n) => ({ name: strip(n), criteria: uniq(mine.filter((k) => k.compUnitFactrName === n && k.gbnName === "수행준거").map((k) => strip(k.gbnVal))) })),
      knowledge: uniq(mine.filter((k) => k.gbnName === "지식").map((k) => strip(k.gbnVal))),
      skills: uniq(mine.filter((k) => k.gbnName === "기술").map((k) => strip(k.gbnVal))),
      attitude: uniq(mine.filter((k) => k.gbnName === "태도").map((k) => strip(k.gbnVal))),
      evalConsider: uniq((ev.data?.csdrData ?? []).map((c: { defText?: string }) => strip(c.defText ?? ""))),
      evalMethodCodes: uniq((ev.data?.evalData ?? []).map((e: { evalTypeCd?: string; evalMethCd?: string }) => `${e.evalTypeCd}-${e.evalMethCd}`)),
    });
    for (const b of (jb.data ?? []) as { mainName: string; mainDesc: string; subName: string }[]) {
      const old = basics.get(b.mainName) ?? { name: b.mainName, desc: b.mainDesc, subs: [] };
      if (!old.subs.includes(b.subName)) old.subs.push(b.subName);
      basics.set(b.mainName, old);
    }
  });
  const levels = (clpos.data?.clposData ?? []) as { clposName: string; clposLevel: number; clposNo: string }[];
  const links = (clpos.data?.clposCompeData ?? []) as { clposNo: string; compeUnitName: string }[];
  return {
    dutyCd,
    dutyNm,
    dutyDef,
    fetchedAt: new Date().toISOString().slice(0, 10),
    units: units.toSorted((a, b) => a.compUnitCd.localeCompare(b.compUnitCd)),
    certs: uniq(((csdr.data ?? []) as { itemCd: string; defText: string }[]).filter((x) => x.itemCd === "01").map((x) => strip(x.defText))),
    positions: levels.map((l) => ({ level: l.clposLevel, name: l.clposName, units: uniq(links.filter((x) => x.clposNo === l.clposNo).map((x) => strip(x.compeUnitName))) })),
    basics: withBasics ? [...basics.values()] : undefined,
  };
}

(async () => {
  const cfg = JSON.parse(readFileSync("data/ncs/duties.json", "utf8")) as { worlds: Record<string, { dutyCd: string; name: string }[]> };
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
  const pub = new Set(cfg.worlds["pub-office"].map((d) => d.dutyCd));
  const list = [...new Map(Object.values(cfg.worlds).flat().map((d) => [d.dutyCd, d.name])).entries()].filter(([c]) => !only || only.includes(c));
  const defs = new Map<string, string>();
  for (const row of await allRows("ncsDutyInfo", {})) defs.set(String(row.dutyCd), row.dutyNm + "\u0000" + (row.dutyDef ?? ""));
  const failed: string[] = [];
  await pool(list, 3, async ([cd, nm]) => {
    try {
      const [apiName, def] = (defs.get(cd) ?? `${nm}\u0000`).split("\u0000");
      if (apiName !== nm) throw new Error(`이름이 달라요: ${apiName}`);
      const f = await one(cd, nm, def, pub.has(cd));
      if (!f.units.length) throw new Error("능력단위 없음");
      writeFileSync(`data/ncs/${cd}.json`, JSON.stringify(f, null, 1) + "\n");
      const noT = f.units.filter((u) => u.trainTime === null).length;
      const noC = f.units.filter((u) => !u.elements.some((e) => e.criteria.length)).length;
      console.log(`${cd} ${nm}: 단위 ${f.units.length} 시간없음 ${noT} 준거없음 ${noC} 자격 ${f.certs.length} 직책 ${f.positions.map((p) => p.level).join("/")}`);
    } catch (e) {
      failed.push(`${cd} ${nm}: ${String(e).slice(0, 120)}`);
    }
  });
  console.log(`끝: ${list.length - failed.length}/${list.length}`);
  if (failed.length) console.log("실패\n" + failed.join("\n"));
})();

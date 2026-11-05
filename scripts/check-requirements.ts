// 필요한 것 목록 단위 테스트(네트워크 없음). 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-requirements.ts
import assert from "node:assert/strict";
import { ALL_WORLD_IDS, codesFor, majorFamily } from "@/lib/job-codes";
import { existsSync, readFileSync } from "node:fs";
import { applyCertFilter, buildRequirements, certPolicyOf, officialUrlOf, parseCerts, postingLabel, POSTING_NONE, type RequirementsFile, type RequirementSources } from "@/lib/requirements";
import { curatedOf, resolveSources, type Snapshot } from "@/lib/requirements-build";
import { getWorld } from "@/lib/worlds";

const empty: RequirementSources = { ncs: [], careernet: [], work24: [] };
let n = 0;
const t = async (name: string, f: () => void | Promise<void>) => {
  await f();
  n++;
  console.log("통과", name);
};

(async () => {
  await t("줄인 자격 이름을 낱개로 편다", () => {
    assert.deepEqual(parseCerts("정보처리기능사, 산업기사, 기사(국가기술)"), ["정보처리기능사", "정보처리산업기사", "정보처리기사"]);
    assert.deepEqual(parseCerts("시각디자인 산업기사, 기사(국가기술)"), ["시각디자인산업기사", "시각디자인기사"]);
    assert.deepEqual(parseCerts("정보보안기사∙산업기사(국가기술)"), ["정보보안기사", "정보보안산업기사"]);
    assert.deepEqual(parseCerts("사회복지사 1, 2급(국가전문)"), ["사회복지사 1·2급"]);
    assert.deepEqual(parseCerts("건설기계산업기사, 기사, 기술사(국가기술), 건설안전산업기사, 기사"), ["건설기계산업기사", "건설기계기사", "건설기계기술사", "건설안전산업기사", "건설안전기사"]);
    assert.deepEqual(parseCerts("미용사《일반》(국가기술)"), ["미용사(일반)"]);
    assert.deepEqual(parseCerts("CISA《국제공인정보시스템 감사사》(외국)"), ["정보시스템감사사(CISA)"]);
  });
  await t("두 출처의 같은 자격은 하나로 합치고 출처를 남긴다", () => {
    const r = buildRequirements(
      "x",
      "open",
      { ...empty, careernet: [{ name: "가", certs: ["정보처리기사", "응급구조사"], departs: [], prep: [] }], work24: [{ name: "나", certs: ["정보처리기능사, 기사(국가기술)", "응급구조사 1, 2급(국가전문)"], majors: [], techn: "" }] },
      "2026-11-05",
    );
    const certs = r.items.filter((i) => i.kind === "cert");
    assert.equal(certs.filter((c) => c.name === "정보처리기사").length, 1);
    assert.deepEqual(certs.find((c) => c.name === "정보처리기사")?.alsoIn, ["work24-job"]);
    assert.equal(certs.filter((c) => c.name.startsWith("응급구조사")).length, 1);
    assert.equal(certs.length, 3);
  });
  await t("공고 비율은 비어 있고, 값이 들어오면 문구가 바뀐다", () => {
    const r = buildRequirements("developer", "open", { ...empty, ncs: [{ name: "화면 구현", def: "", job: "응용SW엔지니어링", ksa: [] }] }, "2026-11-05");
    for (const i of r.items) {
      assert.equal(i.postingShare, undefined);
      assert.equal(postingLabel(i), POSTING_NONE);
    }
    assert.equal(postingLabel({ ...r.items[0], postingShare: 0.5, postingN: 100 }), "공고 100개 중 50개가 요구");
  });
  await t("공공기관 사무직은 NCS 직업기초능력 10개가 들어간다", () => {
    const r = buildRequirements("pub-office", "public", empty, "2026-11-05");
    assert.equal(r.items.filter((i) => i.id.startsWith("ncs-basic:")).length, 10);
    assert.equal(buildRequirements("developer", "open", empty, "2026-11-05").items.filter((i) => i.id.startsWith("ncs-basic:")).length, 0);
  });
  await t("전공 계열로 코드를 고른다", () => {
    assert.equal(majorFamily("컴퓨터공학과"), "자연");
    assert.equal(majorFamily("경영학과"), "사회");
    assert.equal(majorFamily("국어국문학과"), "인문");
    assert.equal(majorFamily(""), null);
    assert.notDeepEqual(codesFor("researcher", "자연"), codesFor("researcher", "사회"));
    assert.deepEqual(codesFor("teacher-sec", "인문").careernet, ["406"]);
    assert.deepEqual(codesFor("teacher-sec", "자연").careernet, ["1089"]);
    assert.deepEqual(codesFor("teacher-sec", null).careernet, ["406"]);
    assert.deepEqual(codesFor("startup"), { careernet: [], work24: [] });
  });
  await t("공식 API가 실패하면 마지막 값과 그 기준일", async () => {
    const snap: Snapshot = { date: "2026-10-01", ncs: { developer: [{ name: "옛 능력", def: "", job: "j", ksa: [] }] }, careernet: {}, work24: {} };
    const fail = { ncs: async () => null, careernet: async () => null, work24: async () => null };
    const a = await resolveSources("developer", null, fail, snap, "2026-11-05");
    assert.equal(a.stale, true);
    assert.equal(a.baseDate, "2026-10-01");
    assert.equal(a.src.ncs[0].name, "옛 능력");
    const ok = { ncs: async () => [{ name: "새 능력", def: "", job: "j", ksa: [] }], careernet: async () => null, work24: async () => null };
    const b = await resolveSources("startup", null, ok, snap, "2026-11-05");
    assert.equal(b.stale, false);
    assert.equal(b.baseDate, "2026-11-05");
    assert.equal(b.src.ncs[0].name, "새 능력");
  });
  await t("공식 사이트는 아는 것만", () => {
    assert.equal(officialUrlOf("정보처리기사"), "https://www.q-net.or.kr");
    assert.equal(officialUrlOf("간호사"), "https://www.kuksiwon.or.kr");
    assert.equal(officialUrlOf("빅데이터분석기사"), "https://www.dataq.or.kr");
    assert.equal(officialUrlOf("정보보안기사"), undefined);
    assert.equal(officialUrlOf("리눅스마스터"), undefined);
  });
  const srcCerts: RequirementSources = { ...empty, work24: [{ name: "경찰", certs: ["전자산업기사(국가기술)"], majors: [], techn: "" }], careernet: [{ name: "경찰", certs: ["자동차운전면허"], departs: [], prep: [] }] };
  await t("시험형·면허형 자격증은 직접 정리한 목록뿐", () => {
    assert.equal(certPolicyOf("exam"), "curated-only");
    assert.equal(certPolicyOf("license"), "curated-only");
    assert.equal(certPolicyOf("open"), "ai-filter");
    const r = buildRequirements("police", "exam", srcCerts, "2026-11-05", false, undefined, curatedOf("police"));
    assert.equal(
      r.items.some((i) => i.name === "전자산업기사"),
      false,
    );
    assert.ok(r.items.some((i) => i.name.startsWith("무도 단증")));
    assert.ok(r.items.filter((i) => i.kind === "cert").every((i) => i.source === "curated"));
    assert.ok(r.notes?.[0].includes("가산점이 없습니다"));
  });
  await t("시험형·면허형은 모두 정리 파일이 있고, 후보·출처가 맞다", () => {
    for (const id of ALL_WORLD_IDS) {
      const c = curatedOf(id);
      if (["exam", "license"].includes(getWorld(id).archetype)) assert.ok(c?.certCandidates.length, id);
      if (!c) continue;
      const ids = new Set(c.items.map((i) => i.id));
      for (const x of c.certCandidates) assert.ok(ids.has(x), `${id} ${x}`);
      for (const i of c.items) {
        if (i.grade === "curated") assert.ok(i.ref && c.sources[i.ref]?.url, `${id} ${i.id}`);
        if (i.hours) assert.equal(i.hours.grade, "assumed");
      }
      for (const i of c.items.filter((i) => i.kind === "cert")) assert.ok(c.certCandidates.includes(i.id), `${id} 후보 빠짐 ${i.id}`);
    }
  });
  await t("AI 거르기: 없는 id는 버리고 세고, 실패면 안 지운다", () => {
    const r = buildRequirements("x", "open", { ...empty, careernet: [{ name: "가", certs: ["정보처리기사", "조리기능장"], departs: [], prep: [] }] }, "2026-11-05");
    const cook = r.items.find((i) => i.name === "조리기능장")!;
    const a = applyCertFilter(r, {
      drop: [
        { id: cook.id, why: "무관" },
        { id: "지어낸-id", why: "?" },
      ],
    });
    assert.equal(
      a.items.some((i) => i.name === "조리기능장"),
      false,
    );
    assert.ok(a.items.some((i) => i.name === "정보처리기사"));
    assert.deepEqual(a.filter, { mode: "ai", dropped: [{ name: "조리기능장", why: "무관" }], invented: 1 });
    const b = applyCertFilter(r, null);
    assert.equal(b.items.length, r.items.length);
    assert.equal(b.filter?.mode, "none");
  });
  await t("저장된 목록: 53개 모두 있고 공고 비율은 비어 있다", () => {
    for (const id of ALL_WORLD_IDS) {
      const p = `data/requirements/${id}.json`;
      assert.ok(existsSync(p), p);
      const f = JSON.parse(readFileSync(p, "utf8")) as RequirementsFile;
      for (const r of [f.default, ...Object.values(f.byFamily ?? {})])
        for (const i of r.items) {
          assert.equal(i.postingShare, undefined);
          assert.ok(i.grade, `${id} ${i.id}`);
        }
    }
  });
  await t("53개 진로 모두 코드 표에 있고 유형 틀이 있다", () => {
    assert.equal(ALL_WORLD_IDS.length, 53);
    for (const id of ALL_WORLD_IDS) assert.ok(getWorld(id).archetype, id);
  });
  console.log(`${n}개 통과`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

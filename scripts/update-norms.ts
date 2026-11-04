// 비교 집단 평균(data/norms.json)을 파일럿 동의자 평균으로 바꾼다. 지금은 노인 표본 평균이라 청년이 30명 모이면 바꾼다.
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/update-norms.ts data/pilot/profiles.json          # 보기만
//   npx tsx@4.19.2 --tsconfig tsconfig.json scripts/update-norms.ts data/pilot/profiles.json --apply  # 바꾸기(30명 이상일 때만)
// 입력: fit-weights.ts와 같은 Supabase profiles 내보내기(data/pilot/, 커밋 금지). 파일럿 동의가 있고 빠지지 않은 사람, 시연용 제외.
// 바꾼 뒤에는 기준 비율이 평균 인물로 잰 값이라 scripts/measure-base.ts → check-base.ts → check-all.ts → validate.ts를 돌린다.
import { readFileSync, writeFileSync } from "node:fs";
import type { Profile } from "../lib/types";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const OUT = opt("--out") ?? "data/norms.json"; // 시험용
const MIN_N = 30;
if (!file) throw new Error("입력 파일을 주세요. 예: scripts/update-norms.ts data/pilot/profiles.json");

const raw = JSON.parse(readFileSync(file, "utf8")) as ({ data?: Profile; demo?: boolean } & Partial<Profile>)[];
const people = raw
  .filter((r) => !r.demo && !(r.data as { demo?: boolean } | undefined)?.demo)
  .map((r) => (r.data ?? r) as Profile)
  .filter((p) => p.pilot?.consentAt && !p.pilot.withdrawnAt);

const round = (x: number) => Math.round(x * 100) / 100;
function stats<K extends string>(rows: Record<K, number>[], keys: K[]) {
  const mean = {} as Record<K, number>;
  const sd = {} as Record<K, number>;
  for (const k of keys) {
    const xs = rows.map((r) => r[k]);
    const m = xs.reduce((a, c) => a + c, 0) / xs.length;
    mean[k] = round(m);
    sd[k] = round(Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / Math.max(1, xs.length - 1)));
  }
  return { mean, sd };
}

// 답한 사람만(문항을 안 풀면 기본값 3이라 평균을 3으로 끌어당긴다)
const b5 = people.filter((p) => p.depth?.bfiItems > 0).map((p) => p.bigFive);
const bh = people.filter((p) => p.depth?.behaviorItems > 0).map((p) => p.behavior);
const norms = JSON.parse(readFileSync("data/norms.json", "utf8"));
const b5New = b5.length ? stats(b5 as unknown as Record<"E" | "A" | "C" | "N" | "O", number>[], ["E", "A", "C", "N", "O"]) : null;
const bhNew = bh.length ? stats(bh as unknown as Record<"persistence" | "risk" | "coping" | "social", number>[], ["persistence", "risk", "coping", "social"]) : null;

console.log(`파일럿 동의자 ${people.length}명, 성격 답한 사람 ${b5.length}명, 상황 질문 답한 사람 ${bh.length}명 (기준 ${MIN_N}명)`);
console.log("성격 지금:", JSON.stringify(norms.bigFive.mean), "\n성격 새 값:", b5New ? JSON.stringify(b5New.mean) : "없음");
console.log("상황 지금:", JSON.stringify(norms.behavior.mean), "\n상황 새 값:", bhNew ? JSON.stringify(bhNew.mean) : "없음");

if (!APPLY) {
  console.log("보기만 했어요. 바꾸려면 --apply");
} else {
  const date = new Date().toISOString().slice(0, 10);
  let changed = false;
  if (b5New && b5.length >= MIN_N) {
    norms.bigFive = {
      source: `파일럿 동의자 ${b5.length}명 평균(${date}, 자기 선택 표본)`,
      previous: norms.bigFive.source,
      caveat: "자기 선택한 소수 표본이다. 대표 표본이 아니다. 앱의 성격 점수는 BFI-10 또는 IPIP 50이 섞여 있다.",
      n: b5.length,
      ...b5New,
    };
    changed = true;
  }
  if (bhNew && bh.length >= MIN_N) {
    norms.behavior = { source: `파일럿 동의자 ${bh.length}명 평균(${date}, 자기 선택 표본)`, previous: norms.behavior.note, n: bh.length, ...bhNew };
    changed = true;
  }
  if (!changed) {
    console.error(`${MIN_N}명이 안 돼서 바꾸지 않았어요.`);
    process.exit(1);
  }
  writeFileSync(OUT, JSON.stringify(norms, null, 2) + "\n");
  console.log(`${OUT}에 썼어요. 이제 measure-base → check-base → check-all → validate를 돌리세요.`);
}

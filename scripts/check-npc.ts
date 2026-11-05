// 등장인물별 호출 점검: 시연 인물로 10년 본선을 끝까지 살아, 처지에 맞는 인물만 불리는지 본다.
// 실행: npx tsx@4.19.2 --tsconfig tsconfig.json scripts/check-npc.ts            (53개 진로, AI 안 부름)
// 실제 대사: npx tsx@4.19.2 --env-file=.env.local --tsconfig tsconfig.json scripts/check-npc.ts --real developer,civil-servant     (진로 하나에 최대 6번 호출, 무료 키는 호출 사이 4.5초)
import { DEMO_PROFILE } from "../lib/demo";
import { buildMultiverse, replayLine } from "../lib/multiverse";
import { scenesOf } from "../lib/scenes";
import { addReactions, npcFits, npcTargets, NPC_SCENES } from "../lib/sim";
import type { SimEvent } from "../lib/types";
import { getWorld, WORLDS } from "../lib/worlds";

const MONTHS = 120;
const START = "2026-12";
function mainScenes(id: string) {
  const world = getWorld(id);
  const { mv } = buildMultiverse(DEMO_PROFILE, world, MONTHS, START);
  const line = mv.lines.find((l) => l.isMain)!;
  return scenesOf(world, replayLine(DEMO_PROFILE, world, MONTHS, START, line), line.id, MONTHS, START, mv.stats) as SimEvent[];
}

const realArg = process.argv.indexOf("--real");
if (realArg >= 0) {
  void (async () => {
    let bad = 0;
    let n = 0;
    for (const id of process.argv[realArg + 1].split(",")) {
      const world = getWorld(id);
      const told = await addReactions(DEMO_PROFILE, [world], mainScenes(id), "check");
      for (const s of told)
        for (const r of s.reactions ?? []) {
          n++;
          const npc = world.npcs.find((x) => x.name === r.name)!;
          if (!npcFits(world, npc, s)) bad++;
          console.log(`${world.short} | ${s.label} | ${s.eventStatus} | ${s.title} → ${s.choice}\n   ${r.name}(${r.role}): "${r.line}"`);
        }
    }
    console.log(`대사 ${n}개, 처지 규칙에 어긋난 대사 ${bad}개(내용은 위 대사를 읽어 확인)`);
  })();
} else {
  let scenesN = 0;
  let calls = 0;
  let wrong = 0;
  let maxCalls = 0;
  for (const w of WORLDS) {
    const scenes = mainScenes(w.id);
    const t = npcTargets(w, scenes);
    scenesN += scenes.filter((s) => s.branch === "choice" && s.choice).length;
    calls += t.length;
    maxCalls = Math.max(maxCalls, t.length);
    if (new Set(t.map((x) => x.scene)).size > NPC_SCENES) wrong++;
    for (const x of t) if (!npcFits(w, x.npc, x.scene)) wrong++;
    // 일 안 하는 장면에 직장 사람이 나오면 안 된다
    for (const x of t) if (!/개월차$/.test(x.scene.eventStatus ?? "") && !/스터디|멘토|공동창업/.test(x.npc.name) && x.npc.role !== "수험 동료") wrong++;
  }
  console.log(`53개 진로 × 10년 본선: 큰 갈림길 장면 ${scenesN}개, 호출 ${calls}번(진로당 최대 ${maxCalls}번), 처지 규칙 위반 ${wrong}개`);
  if (wrong) process.exit(1);
}

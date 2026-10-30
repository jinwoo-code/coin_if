// '지금 현실에서는': 고용24에서 이 진로의 실제 신입 공고, 하는 일, 국비 과정을 바로 가져온다.
// 키가 없거나 실패하면 available: false만 돌려준다(화면은 안내 문구로 대신).
import { NextResponse } from "next/server";
import { dutiesFor, hasWork24, regionCodes, REGION_NAMES, searchWanted, trainingCourses } from "@/lib/work24";
import { getWorld } from "@/lib/worlds";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const world = getWorld(sp.get("world") ?? "");
  const region = sp.get("region") ?? "";
  if (!hasWork24("wanted") && !hasWork24("duty") && !hasWork24("training")) return NextResponse.json({ available: false });

  const kw = world.short.replace(/[·(].*$/, "").trim();
  // 사는 곳 → 고용24 지역코드(시·도 단위)
  let regionCd: string | undefined;
  const names = REGION_NAMES[region] ?? [];
  if (names.length) {
    const codes = (await regionCodes()) ?? [];
    regionCd = codes.filter((c) => names.some((n) => c.name.startsWith(n))).map((c) => c.code).join("|") || undefined;
  }

  const recruit = ["exam", "grad", "startup"].includes(world.archetype);
  const [wanted, duties, training] = await Promise.all([
    recruit ? null : searchWanted({ keyword: kw, newbie: true, region: regionCd, display: 50 }),
    dutiesFor(world.id, 4),
    ["open", "portfolio", "trade"].includes(world.archetype) ? trainingCourses({ keyword: kw, months: 3 }) : null,
  ]);

  const sals = (wanted?.items ?? []).map((i) => i.minSal).filter((x): x is number => x !== null && x > 1500 && x < 15000).sort((a, b) => a - b);
  // 취업률은 과정이 끝난 뒤에야 나와서 곧 열리는 과정은 대부분 비어 있다. 있으면 취업률 높은 순, 없으면 빨리 시작하는 순.
  const courses = (training?.items ?? []).filter((c, i, all) => all.findIndex((x) => x.title === c.title) === i);
  const rated = courses.filter((c) => c.rate6 !== null && c.rate6 > 0).sort((a, b) => b.rate6! - a.rate6!);
  const top = (rated.length ? rated : courses.toSorted((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))).slice(0, 3);
  return NextResponse.json({
    available: true,
    keyword: kw,
    regionLabel: regionCd ? region : "전국",
    wanted: wanted ? { total: wanted.total, salaryMedian: sals.length ? sals[Math.floor(sals.length / 2)] : null, salarySample: sals.length, items: wanted.items.slice(0, 4) } : null,
    duties: duties ?? [],
    ncs: [...new Set((duties ?? []).map((d) => d.job))].join(", "),
    training: training ? { total: training.total, top } : null,
    at: new Date().toISOString().slice(0, 10),
  });
}

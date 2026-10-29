// 규칙 엔진의 한 달 단위 기록(Path)을 화면에 보여 줄 '역' 단위 장면으로 묶는다.
// 브라우저와 서버 양쪽에서 쓴다(서버 전용 코드 import 금지).
import { planStations } from "./calendar";
import type { MonthLog, Path, SimEvent, WorldStats, WorldTemplate } from "./types";

// 한 역(몇 달) 안에서 가장 중요한 일을 고른다: 갈림길·일 시작 > 큰 사건 > 일상
function rank(m: MonthLog) {
  const e = m.event!;
  if (e.branch || e.hires) return 3;
  if (!e.repeatable) return 2;
  return 1;
}

export function scenesOf(world: WorldTemplate, path: Path, lineId: string, months: number, startYm: string, stats: WorldStats): SimEvent[] {
  const { size, labels } = planStations(months, startYm);
  return labels.map((label, station) => {
    const inside = path.months.slice(station * size, station * size + size);
    const last = inside[inside.length - 1];
    const withEvent = inside.filter((m) => m.event);
    const main = withEvent.toSorted((a, b) => rank(b) - rank(a) || a.month - b.month)[0];
    // 같은 역의 변화를 모두 더한다(점수 변화를 한눈에)
    const delta = inside.reduce<Record<string, number>>((acc, m) => {
      for (const [k, v] of Object.entries(m.delta)) acc[k] = (acc[k] ?? 0) + (v ?? 0);
      return acc;
    }, {});
    if (!main) {
      return {
        worldId: world.id,
        lineId,
        station,
        month: last.month,
        label,
        eventId: "quiet",
        title: "조용히 지나간 시간",
        kind: "neutral",
        narration: `${last.status}. 큰일 없이 하루하루가 지나갔다.`,
        choice: "",
        choiceIndex: 0,
        reason: "",
        delta,
        state: last.state,
        status: last.status,
        salary: last.salary,
        freq: 0,
        routine: true,
        minor: [],
      } satisfies SimEvent;
    }
    const e = main.event!;
    return {
      worldId: world.id,
      lineId,
      station,
      month: main.month,
      label,
      eventId: e.id,
      title: main.tierLabel ? `${e.title} · ${main.tierLabel}` : e.title,
      kind: e.kind,
      narration: e.text,
      choice: e.choices[main.choiceIndex]?.text ?? "",
      choiceIndex: main.choiceIndex,
      reason: main.reason,
      tierLabel: main.tierLabel,
      delta,
      state: last.state,
      status: last.status,
      salary: last.salary,
      evidence: e.evidence,
      freq: stats.events[e.id]?.count ?? 0,
      routine: Boolean(e.repeatable) || e.weight === 0, // 일상 사건과 입대·전역 같은 정해진 일은 빈도를 안 보여 줌
      branch: e.branch,
      minor: withEvent.filter((m) => m !== main).map((m) => m.event!.title),
    } satisfies SimEvent;
  });
}

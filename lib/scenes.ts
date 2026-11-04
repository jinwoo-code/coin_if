// 규칙 엔진의 한 달 단위 기록(Path)을 화면에 보여 줄 '역' 단위 장면으로 묶는다.
// 브라우저와 서버 양쪽에서 쓴다(서버 전용 코드 import 금지).
import { planStations } from "./calendar";
import type { ChoiceOdds, MonthLog, Path, SimEvent, WorldStats, WorldTemplate } from "./types";

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
    const b = e.choices[main.choiceIndex]?.base;
    const k = main.pick;
    const odds: ChoiceOdds | undefined =
      b && k
        ? {
            base: Math.round(k.base * 100),
            mine: Math.round(k.mine * 100),
            grade: b.grade,
            ...(b.grade === "assumed" ? {} : { ref: b.ref, n: b.n, population: b.population?.label }),
            otherGroup: k.otherGroup,
            byAi: k.byAi,
            forced: k.forced || undefined,
            situation: k.situation,
            shift: k.shift,
          }
        : undefined;
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
      odds,
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

// 선택 아래 문구. 화면에 보이는 '보통 → 나' 숫자의 차이로 정해서 문구와 숫자 방향이 어긋나지 않게 한다.
// 저장하지 않고 그릴 때 만든다: reason에 이야기 인용이 있을 수 있어 scrubStory가 reason 칸만 보고 지운다.
export const ODDS_MARGIN = 3; // %p, 이 안이면 '비슷하다'(가정값)
export function choiceLine(ev: Pick<SimEvent, "reason" | "odds">) {
  const o = ev.odds;
  if (!o) return "";
  if (o.forced) return ev.reason;
  const d = o.mine - o.base;
  if (d > ODDS_MARGIN) return ev.reason ? `${joinReason(ev.reason)} 보통보다 이쪽을 더 골라요` : "보통보다 이쪽을 더 골라요";
  if (d < -ODDS_MARGIN) return `보통보다 덜 고르는 편이지만, 이번 삶에선 이쪽으로 갔어요${o.situation ? `. ${o.situation}요` : ""}`;
  return "보통 사람과 비슷하게 골랐어요";
}

// AI가 쓴 이유가 문장으로 끝나면 마침표로, '~해서'처럼 이어지면 그대로 잇는다.
function joinReason(r: string) {
  const t = r.replace(/[.。]+$/, "");
  return /[요다]$/.test(t) ? `${t}.` : t;
}

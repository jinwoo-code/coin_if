// 시험형 진로의 기간 끝 상태 세 갈래: 합격(그중 만족) / 아직 준비 중(진행 중이라 만족을 안 셈) / 다른 길(그중 만족).
// 숫자는 전부 엔진 값(lib/multiverse.ts outcomeOf).
import { T } from "@/lib/copy";
import type { WorldStats, WorldTemplate } from "@/lib/types";

export const showsOutcome = (world: WorldTemplate, st: WorldStats) => world.archetype === "exam" && !!st.outcome;

export function OutcomeSplit({ st, gateLabel = "합격" }: { st: WorldStats; gateLabel?: string }) {
  const o = st.outcome;
  if (!o) return null;
  const rows = [
    { k: gateLabel, share: o.gate.share, note: o.gate.share ? `그중 만족 ${o.gate.satisfied}%` : "" },
    { k: "아직 준비 중", share: o.preparing.share, note: o.preparing.share ? "진행 중" : "" },
    { k: "다른 길로 감", share: o.switched.share, note: o.switched.share ? `그중 만족 ${o.switched.satisfied}%` : "" },
  ];
  return (
    <div data-testid="outcome-split">
      <ul className="num grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <li key={r.k} className="min-w-0">
            <p className="text-cap text-muted break-keep">{r.k}</p>
            <p className="text-xl font-extrabold">{r.share}%</p>
            <p className="text-cap text-muted break-keep">{r.note}</p>
          </li>
        ))}
      </ul>
      <details className="mt-2 text-cap text-muted">
        <summary className="min-h-11 cursor-pointer py-2">어떻게 셌나요?</summary>
        <p>
          기간이 끝날 때 어디에 있는지로 나눴어요. 아직 준비 중인 삶은 끝나지 않은 이야기라 만족·불만족으로 세지 않아요. {gateLabel}한 사람 중 {o.gate.left}%는 나중에 그만두고 다른 길로 갔고, 그 사람들은 &apos;그중 만족&apos;에 안 들어가요(남은 사람 중 만족 {o.gate.stayedSatisfied}%).
        </p>
        <p className="mt-1">
          다른 길은 어떤 일인지 몰라서 보통 회사 일 중 하나를 고르고 그 일의 사건 몇 가지만 살아 본 값이에요. 그 일을 구하는 속도(한 달 약 9%)와 연봉도 {T.assumedFull}이에요.
        </p>
      </details>
    </div>
  );
}

// 표 한 칸용 짧은 글
export function outcomeLine(st: WorldStats, gateLabel = "합격") {
  const o = st.outcome;
  if (!o) return "";
  return `${gateLabel} ${o.gate.share}%(만족 ${o.gate.satisfied}%) · 준비 중 ${o.preparing.share}% · 다른 길 ${o.switched.share}%(만족 ${o.switched.satisfied}%)`;
}

"use client";
// 'AI가 직접 살아 본 30개의 삶': 실시간 판단 결과를 1,000번 통계와 섞지 않고 따로 보여 준다. {T.lineMap}·리포트에 붙는다.
import { Bot, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ci } from "@/components/ui";
import { durationLabel } from "@/lib/calendar";
import { LIVE_RUNS } from "@/lib/live";
import { store, type LiveResults } from "@/lib/store";
import type { WorldTemplate } from "@/lib/types";
import { T } from "@/lib/copy";

export function LiveLives({ world }: { world: WorldTemplate }) {
  const router = useRouter();
  const [saved, setSaved] = useState<LiveResults | null>(null);
  useEffect(() => setSaved(store.getLiveResults()), []);
  const mv = saved?.mvs[world.id];
  if (!mv) return null;
  const n = mv.stats.runs;
  const rows = [
    { label: `${durationLabel(mv.months)} 안에 ${mv.stats.gate?.label ?? "합격"}`, share: mv.stats.gate?.share ?? 0 },
    { label: "끝날 때 만족", share: mv.stats.satisfiedShare },
    { label: "끝날 때 지침", share: mv.stats.stressedShare },
  ];
  function talk(lineId: string) {
    store.setLiveActive(world.id, lineId);
    router.push(`/talk?world=${world.id}`);
  }
  return (
    <section aria-label={`${world.short}: AI가 직접 살아 본 ${LIVE_RUNS}개의 삶`} className="card mt-4 p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <Bot aria-hidden="true" size={18} className="flex-none" style={{ color: world.color }} />
        AI가 직접 살아 본 {LIVE_RUNS}개의 삶
      </h2>
      <p className="mt-1 text-cap text-muted">{world.short} 결과예요. 큰 갈림길마다 AI가 그때 상황을 보고 판단했어요. 1,000번 통계와 섞지 않았고, 횟수가 달라 숫자를 바로 비교하면 안 돼요.</p>
      <ul className="num mt-3 space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.label}>
            {r.label}:{" "}
            <b>
              {n}번 중 {Math.round(r.share * n)}번
            </b>{" "}
            <Ci pct={r.share * 100} n={n} />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-cap text-muted">괄호는 오차 범위예요. {n}번이라 범위가 넓어요. 모델 자체가 틀릴 가능성은 들어 있지 않아요.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {mv.lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hair px-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              {l.title} <span className="num text-cap text-muted">· {n}번 중 {l.count}번</span>
            </span>
            <button type="button" onClick={() => talk(l.id)} className="chip min-h-[44px] flex-none text-cap font-semibold">
              <MessageCircle aria-hidden="true" size={14} /> 이 삶의 나와 대화
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

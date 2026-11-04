"use client";
// '나라면 이렇게 안 해': 시뮬레이션 속 내 선택을 직접 고친다(계속 닮아 가기, lib/ongoing.ts). 다음에 살아볼 때부터 조금 반영된다.
import { useState } from "react";
import { withCorrection } from "@/lib/ongoing";
import { store } from "@/lib/store";
import type { SimEvent, WorldTemplate } from "@/lib/types";

export function CorrectChoice({ ev, world }: { ev: SimEvent; world: WorldTemplate }) {
  const card = world.events.find((e) => e.id === ev.eventId);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<number | null>(() => {
    const c = store.getProfile()?.corrections.find((x) => x.eventId === ev.eventId);
    const i = c && card ? card.choices.findIndex((x) => x.tone === c.to) : -1;
    return i >= 0 ? i : null;
  });
  if (!card || card.choices.length < 2 || !ev.choice) return null;

  function pick(i: number) {
    const p = store.getProfile();
    if (!p || !card) return;
    store.setProfile(
      withCorrection(p, { source: "sim", eventId: card.id, title: ev.title, from: card.choices[ev.choiceIndex]?.tone ?? null, to: card.choices[i].tone, stress: ev.odds?.stress ?? ev.state?.stress, tones: card.choices.map((c) => c.tone) }),
    );
    setMine(i === ev.choiceIndex ? null : i);
    setOpen(false);
  }

  if (mine !== null && !open)
    return (
      <p className="mt-2 text-cap">
        <span className="font-semibold">나라면: {card.choices[mine].text}</span>
        <span className="text-muted"> · 다음에 살아볼 때부터 반영돼요. </span>
        <button type="button" onClick={() => setOpen(true)} className="min-h-[44px] font-semibold underline underline-offset-2">
          바꾸기
        </button>
      </p>
    );
  return open ? (
    <div role="radiogroup" aria-label={`${ev.title}: 나라면`} className="mt-2 flex flex-col gap-1.5">
      <p className="text-cap font-semibold">나라면 이렇게 했을 거예요</p>
      {card.choices.map((c, i) => (
        <button
          key={c.text}
          type="button"
          role="radio"
          aria-checked={(mine ?? ev.choiceIndex) === i}
          onClick={() => pick(i)}
          className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm transition-colors ${(mine ?? ev.choiceIndex) === i ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
        >
          {c.text}
          {i === ev.choiceIndex ? <span className="opacity-70"> (분신이 고른 것)</span> : null}
        </button>
      ))}
    </div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="chip mt-2 min-h-[44px] whitespace-nowrap text-cap font-semibold">
      나라면 이렇게 안 해
    </button>
  );
}

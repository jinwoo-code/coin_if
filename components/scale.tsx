"use client";
// 검사 문항 한 줄(5점 척도)과 상황 질문 한 개. 인터뷰에서 한 화면에 여러 문항을 묶어 보여 줄 때 쓴다.

const SCALE = ["전혀 아니다", "아닌 편", "보통", "그런 편", "매우 그렇다"];

export function ScaleRow({ id, n, text, value, onPick }: { id: string; n: number; text: string; value: number | undefined; onPick: (v: number) => void }) {
  return (
    <li className="border-b border-hair py-4 first:pt-1 last:border-0 last:pb-1">
      <p id={id} className="text-base font-semibold">
        <span className="num mr-1.5 text-muted">{n}.</span>
        {text}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="mt-2.5 grid grid-cols-5 gap-1.5">
        {SCALE.map((label, i) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            aria-label={label}
            onClick={() => onPick(i + 1)}
            className={`flex h-11 items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${value === i + 1 ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </li>
  );
}

export function ScaleEnds() {
  return (
    <p className="flex justify-between text-cap text-muted" aria-hidden="true">
      <span>1 전혀 아니다</span>
      <span>5 매우 그렇다</span>
    </p>
  );
}

export function ChoiceItem({ id, n, text, options, value, onPick }: { id: string; n: number; text: string; options: string[]; value: number | undefined; onPick: (i: number) => void }) {
  return (
    <li className="border-b border-hair py-4 first:pt-1 last:border-0 last:pb-1">
      <p id={id} className="text-base font-bold">
        <span className="num mr-1.5 text-muted">{n}.</span>
        {text}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="mt-2.5 flex flex-col gap-1.5">
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === i}
            onClick={() => onPick(i)}
            className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-left text-base transition-colors ${value === i ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </li>
  );
}

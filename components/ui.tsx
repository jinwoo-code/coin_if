"use client";
// 여러 화면에서 같이 쓰는 부품. 색은 '노선' 색만 쓰고 나머지는 무채색이다.
import { wilson } from "@/lib/ci";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { won } from "@/lib/format";
import { TokenChip } from "./account";
import type { ChoiceOdds, LifeState, WorldTemplate } from "@/lib/types";
import { T, plain } from "@/lib/copy";

// ---------- 화면 틀 ----------

export function Screen({
  title,
  back,
  right,
  wide = false,
  children,
  footer,
}: {
  title?: string;
  back?: string;
  right?: React.ReactNode;
  wide?: boolean; // 데스크톱에서 넓게 쓰는 화면(타임라인, 리포트)
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const width = wide ? "max-w-[1080px]" : "max-w-[560px]";
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-transparent bg-ground/90 backdrop-blur-md print:hidden">
        <div className={`mx-auto flex h-16 w-full ${width} items-center gap-2 px-3 sm:px-6`}>
          {back ? (
            <Link href={back} aria-label="뒤로 가기" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5">
              <ArrowLeft aria-hidden="true" size={22} strokeWidth={2} />
            </Link>
          ) : null}
          {title ? <h1 className="flex-1 truncate text-lg font-bold tracking-tight">{title}</h1> : <span className="flex-1" />}
          <TokenChip />
          {right}
        </div>
      </header>
      <main id="main" className={`mx-auto flex w-full ${width} flex-1 flex-col px-5 ${footer ? "pb-28" : "pb-8"} sm:px-6`}>
        {children}
      </main>
      {footer ? (
        <div className="sticky bottom-0 z-20 border-t border-hair bg-surface/95 backdrop-blur-md print:hidden">
          <div className={`mx-auto w-full ${width} px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 sm:px-6`}>{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- 노선 배지 ----------

export function LineBadge({ world, size = 28, outline = false }: { world: WorldTemplate; size?: number; outline?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center rounded-full font-bold num"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.46),
        background: outline ? "#fff" : world.color,
        color: outline ? "#14171F" : world.onColor,
        boxShadow: outline ? `inset 0 0 0 ${size > 22 ? 3 : 2}px ${world.color}` : undefined,
      }}
    >
      {world.badge}
    </span>
  );
}

// ---------- 진행 표시: 역(정거장)이 이어진 노선 ----------

export function RouteProgress({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current} className="flex items-center">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex flex-1 items-center last:flex-none">
          <span className={`h-2.5 w-2.5 flex-none rounded-full transition-colors duration-300 ${i < current ? "bg-ink" : i === current ? "bg-ink ring-4 ring-ink/15" : "bg-hair"}`} />
          {i < total - 1 ? <span className={`h-[3px] flex-1 transition-colors duration-300 ${i < current ? "bg-ink" : "bg-hair"}`} /> : null}
        </div>
      ))}
    </div>
  );
}

// ---------- 상태 막대 ----------

export const STATE_META: { key: keyof LifeState; label: string }[] = [
  { key: "satisfaction", label: "만족도" },
  { key: "stress", label: "스트레스" },
  { key: "skill", label: "역량" },
  { key: "relation", label: "관계" },
  { key: "money", label: "모은 돈" },
];

export { won };

export function StateMeters({ state, color, keys }: { state: LifeState; color: string; keys: (keyof LifeState)[] }) {
  const rows = STATE_META.filter((m) => keys.includes(m.key) && m.key !== "money");
  return (
    <dl className="grid gap-1.5">
      {rows.map((m) => (
        <div key={m.key} className="grid grid-cols-[52px_1fr_26px] items-center gap-2 text-cap">
          <dt className="text-muted">{m.label}</dt>
          <dd className="h-1.5 overflow-hidden rounded-full bg-hair" aria-hidden="true">
            <span className="block h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${state[m.key]}%`, background: m.key === "stress" ? "#5B6472" : color }} />
          </dd>
          <dd className="num text-right font-semibold">
            <span className="sr-only">{m.label} </span>
            {state[m.key]}
          </dd>
        </div>
      ))}
      {keys.includes("money") ? (
        <div className="grid grid-cols-[52px_1fr] items-center gap-2 text-cap">
          <dt className="text-muted">모은 돈</dt>
          <dd className={`num text-right font-semibold ${state.money < 0 ? "text-[#A3311A]" : ""}`}>{won(state.money)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

// ---------- 입력 중 표시 ----------

export function Typing({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-muted">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden="true" className="h-1.5 w-1.5 animate-blink rounded-full bg-current" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
    </span>
  );
}

// ---------- 목업 모드 안내 ----------

export function MockNotice() {
  const [mock, setMock] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        if (alive) setMock(!s.llm);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return mock ? <p className="mt-2 rounded-2xl bg-[#FFF4E5] px-4 py-2.5 text-cap text-[#7A4300]">목업 모드로 보고 있어요. AI 키를 넣으면 매번 새로운 이야기가 만들어져요.</p> : null;
}

// ---------- 아래에서 올라오는 시트(기억 보기 등) ----------

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 mt-auto w-full max-w-none overscroll-contain rounded-t-[28px] bg-surface p-0 text-ink backdrop:bg-black/40 sm:m-auto sm:max-w-[560px] sm:rounded-[28px]"
    >
      <div className="flex items-center justify-between px-6 pb-2 pt-5">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} aria-label="닫기" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5">
          <X aria-hidden="true" size={20} />
        </button>
      </div>
      <div className="max-h-[78dvh] overflow-y-auto overscroll-contain px-6 pb-8">{children}</div>
    </dialog>
  );
}

// ---------- 확률 옆 오차 범위(95% 신뢰구간, Wilson). 표본 오차만이고 모델이 틀릴 가능성은 안 들어 있다 ----------

export function Ci({ pct, n, className = "" }: { pct: number; n: number; className?: string }) {
  const [lo, hi] = wilson(pct, n);
  return (
    <span className={`num text-cap font-normal text-muted ${className}`} title={`${T.ci}: ${T.ciDetail}`}>
      ({lo}~{hi}%)
    </span>
  );
}

export const CI_NOTE = `괄호는 ${T.ci}예요. 모델 자체가 틀릴 가능성은 들어 있지 않아요.`;

// ---------- 1,000번 살아본 분포: 10%~90% 범위 띠 + 가운데 값 ----------

export function RangeRow({ label, p10, p50, p90, color, money = false, max = 100 }: { label: string; p10: number; p50: number; p90: number; color: string; money?: boolean; max?: number }) {
  const scale = (v: number) => Math.max(0, Math.min(100, (v / (money ? Math.max(max, 1) : 100)) * 100));
  const fmt = (v: number) => (money ? won(v) : String(v));
  return (
    <div className="text-cap">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted">{label}</span>
        <span className="num text-right font-semibold">
          {fmt(p50)}
          <span className="block font-normal text-muted sm:inline">
            {" "}
            ({fmt(p10)}~{fmt(p90)})
          </span>
        </span>
      </div>
      <span className="relative mt-1 block h-2 rounded-full bg-hair" aria-hidden="true">
        <span className="absolute top-0 h-2 rounded-full" style={{ left: `${scale(p10)}%`, width: `${Math.max(2, scale(p90) - scale(p10))}%`, background: color, opacity: 0.3 }} />
        <span className="absolute top-[-3px] h-[14px] w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${scale(p50)}%`, background: color }} />
      </span>
    </div>
  );
}

// 살아본 횟수 중 몇 %인지에 따라 '자주/가끔/드물게'
export function freqWord(count: number) {
  if (count >= 60) return "자주 있는 일";
  if (count >= 25) return "가끔 있는 일";
  return "드문 일";
}

const GRADE_NOTE = "실제 통계가 아니에요. 평균 성향인 사람이 이 앱의 규칙에서 고르는 비율이에요.";

// 갈림길 장면: 보통은 몇 %가 이 선택을 하는지, 나는 몇 %인지, 그 기준 비율의 근거 등급
export function Odds({ odds }: { odds: ChoiceOdds }) {
  const badge = odds.grade === "stat" ? (odds.otherGroup ? "통계(다른 집단 기준)" : "통계") : odds.grade === "interview" ? (odds.n ? `현직자 ${odds.n}명` : "현직자") : T.assumed;
  return (
    <details className="mt-1 text-cap text-muted">
      <summary className="flex min-h-[44px] cursor-pointer list-none flex-wrap items-center gap-x-1.5 gap-y-1 py-1">
        <span className="num">보통은 {odds.base}%가 이렇게 해요</span>
        <span className="num whitespace-nowrap">
          → <b className="font-semibold text-ink">나는 {odds.mine}%</b>
        </span>
        <span className={`flex-none rounded-full border px-2 py-0.5 font-semibold ${odds.grade === "assumed" ? "border-hair" : "border-ink text-ink"}`}>{badge}</span>
      </summary>
      <div className="flex flex-col gap-1 pb-1">
        {odds.population ? (
          <p>
            {odds.population}이에요. {odds.otherGroup}
          </p>
        ) : null}
        <p>{odds.grade === "assumed" ? GRADE_NOTE : plain(odds.ref)}</p>
        {odds.aiFailed ? <p className="font-semibold text-ink">AI 판단 실패 → 규칙 계산</p> : null}
        <p>{odds.byAi ? "'나는'은 AI 분신의 판단을 기준 비율에서 크게 벗어나지 않게 반영한 값이에요." : "'나는'은 내 성향을 규칙으로 계산해 기준 비율에서 크게 벗어나지 않게 반영한 값이에요."}</p>
      </div>
    </details>
  );
}


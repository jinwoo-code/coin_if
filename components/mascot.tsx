"use client";
// 마스코트 '갈래'. 표정 그림(MascotFace)과, 누르고 잡을 수 있는 버튼(Mascot).
// '동작 줄이기'면 움직임 없이 표정과 말만 바뀐다(globals.css).
import { useEffect, useRef, useState } from "react";
import { MASCOT_LINES, MASCOT_NAME, MASCOT_SPECIAL, type MascotPlace } from "@/lib/mascot-lines";

export type Mood = "base" | "happy" | "think" | "sleepy" | "surprise" | "cheer" | "dizzy" | "grabbed";

export const MASCOT_YELLOW = "#FFD25E";

// viewBox 0 0 80 80 안의 갈래. 몸 중심 (40, 46).
export function MascotFace({ mood = "base", size = 64, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const ink = "#14171F";
  const eyes = (() => {
    switch (mood) {
      case "happy":
      case "cheer":
        return (
          <>
            <path d="M28 43 q4 -5 8 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M44 43 q4 -5 8 0" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          </>
        );
      case "sleepy":
        return (
          <>
            <path d="M28 43 h8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M44 43 h8" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          </>
        );
      case "surprise":
      case "grabbed":
        return (
          <>
            <circle cx="32" cy="42" r="4" fill="#fff" stroke={ink} strokeWidth="2.2" />
            <circle cx="48" cy="42" r="4" fill="#fff" stroke={ink} strokeWidth="2.2" />
            <circle cx="32" cy="42" r="1.6" fill={ink} />
            <circle cx="48" cy="42" r="1.6" fill={ink} />
          </>
        );
      case "dizzy":
        return (
          <>
            <path d="M29 39 l6 6 M35 39 l-6 6" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M45 39 l6 6 M51 39 l-6 6" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
          </>
        );
      case "think":
        return (
          <g className="mascot-blink">
            <circle cx="33" cy="41" r="2.8" fill={ink} />
            <circle cx="49" cy="41" r="2.8" fill={ink} />
          </g>
        );
      default:
        return (
          <g className="mascot-blink">
            <circle cx="32" cy="42" r="2.8" fill={ink} />
            <circle cx="48" cy="42" r="2.8" fill={ink} />
          </g>
        );
    }
  })();
  const mouth = (() => {
    switch (mood) {
      case "happy":
        return <path d="M35 50 q5 5 10 0" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />;
      case "cheer":
        return <path d="M34 49 q6 8 12 0 z" fill="#E8555A" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" />;
      case "surprise":
      case "grabbed":
        return <ellipse cx="40" cy="52" rx="3" ry="3.6" fill="#E8555A" stroke={ink} strokeWidth="2" />;
      case "sleepy":
        return <path d="M37 52 h6" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />;
      case "think":
        return <path d="M36 52 q3 -2 8 1" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />;
      case "dizzy":
        return <path d="M34 52 q2 -2 4 0 q2 2 4 0 q2 -2 4 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" />;
      default:
        return <path d="M36 50 q4 3.5 8 0" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />;
    }
  })();
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 80 80" className={`overflow-visible ${className}`}>
      {/* 발: 잡히면 버둥거린다 */}
      <g className={mood === "grabbed" ? "mascot-kick" : ""}>
        <ellipse cx="32" cy="66" rx="5" ry="3" fill={ink} />
        <ellipse cx="48" cy="66" rx="5" ry="3" fill={ink} />
      </g>
      {/* 더듬이(노선 모양 새싹) */}
      <path d="M40 25 q2 -9 9 -11" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="50" cy="13.5" r="3.4" fill="#2F5BEA" stroke={ink} strokeWidth="1.8" />
      <ellipse cx="40" cy="45" rx="22" ry="21" fill={MASCOT_YELLOW} stroke={ink} strokeWidth="2.8" />
      {/* 손: 응원·잡힘이면 위로 */}
      {mood === "cheer" || mood === "grabbed" ? (
        <>
          <path d="M19 42 q-7 -6 -6 -14" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M61 42 q7 -6 6 -14" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M19 48 q-5 3 -5 8" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M61 48 q5 3 5 8" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      {eyes}
      <circle cx="25" cy="49" r="3" fill="#FF9B9B" opacity={mood === "grabbed" || mood === "cheer" ? 0.95 : 0.65} />
      <circle cx="55" cy="49" r="3" fill="#FF9B9B" opacity={mood === "grabbed" || mood === "cheer" ? 0.95 : 0.65} />
      {mouth}
      {mood === "think" ? <text x="60" y="24" fontSize="13" fontWeight="800" fill={ink}>?</text> : null}
      {mood === "sleepy" ? <text x="58" y="26" fontSize="11" fontWeight="800" fill={ink}>z</text> : null}
      {mood === "dizzy" ? <circle cx="40" cy="20" r="6" fill="none" stroke={ink} strokeWidth="1.6" strokeDasharray="3 3" className="mascot-spin" /> : null}
    </svg>
  );
}

function pick<T>(list: T[], n: number): T {
  return list[n % list.length];
}

// 누르면 말하고, 잡아서 끌 수 있는 갈래. 놓으면 제자리로 돌아온다.
export function Mascot({
  place,
  mood: baseMood = "base",
  size = 72,
  align = "center",
  firstLine,
}: {
  place: MascotPlace;
  mood?: Mood;
  size?: number;
  align?: "left" | "center";
  firstLine?: string; // 처음부터 말풍선에 보일 말
}) {
  const [mood, setMood] = useState<Mood>(baseMood);
  const [line, setLine] = useState<string | null>(firstLine ?? null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hop, setHop] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const taps = useRef<number[]>([]);
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setMood(baseMood), [baseMood]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function settle(after = 2600) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMood(baseMood), after);
  }

  function say(text: string, m: Mood) {
    setLine(text);
    setMood(m);
    settle();
  }

  function tap() {
    count.current += 1;
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];
    setHop((h) => h + 1);
    if (count.current % 10 === 0) return say(MASCOT_SPECIAL.secret, "think");
    if (taps.current.length >= 5) {
      taps.current = [];
      return say(pick(MASCOT_SPECIAL.dizzy, count.current), "dizzy");
    }
    const moods: Mood[] = ["happy", "cheer", "surprise", "happy"];
    say(pick(MASCOT_LINES[place], count.current), pick(moods, count.current));
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!moved.current && Math.hypot(dx, dy) < 6) return;
    if (!moved.current) {
      moved.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // 캡처를 못 해도 끌기는 된다
      }
      clearTimeout(timer.current);
      setMood("grabbed");
      setLine(pick(MASCOT_SPECIAL.grabbed, count.current++));
    }
    setDrag({ x: dx, y: dy });
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    if (moved.current) {
      const far = drag ? Math.hypot(drag.x, drag.y) > 120 : false;
      setDrag(null);
      say(pick(MASCOT_SPECIAL.dropped, count.current), far ? "dizzy" : "surprise");
    }
  }

  return (
    // 말풍선도 갈래와 같이 움직이게 감싼 칸 전체를 옮긴다. 기울기는 갈래만.
    <div
      className={`relative z-30 flex flex-col ${align === "center" ? "items-center" : "items-start"}`}
      style={{
        transform: drag ? `translate(${drag.x}px, ${drag.y}px)` : undefined,
        transition: drag ? "none" : "transform 420ms cubic-bezier(.3,1.6,.5,1)",
      }}
    >
      {line ? (
        <p role="status" aria-live="polite" className="mascot-bubble relative mb-2 max-w-[17rem] rounded-2xl border-2 border-ink bg-surface px-3 py-2 text-sm font-semibold" key={line} style={align === "left" ? ({ ["--tail" as string]: `${size / 2}px` } as React.CSSProperties) : undefined}>
          {line}
        </p>
      ) : null}
      <button
        type="button"
        aria-label={`${MASCOT_NAME}에게 말 걸기`}
        title={`${MASCOT_NAME}를 누르거나 잡아 보세요`}
        onClick={(e) => {
          if (moved.current) {
            moved.current = false;
            e.preventDefault();
            return;
          }
          tap();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`mascot-btn relative z-30 flex min-h-11 min-w-11 touch-none select-none items-center justify-center rounded-full ${drag ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <span className="inline-block" style={{ transform: drag ? `rotate(${Math.max(-25, Math.min(25, drag.x / 6))}deg)` : undefined }}>
        <span key={hop} className={hop ? "mascot-jump inline-block" : "mascot-idle inline-block"}>
          <MascotFace mood={mood} size={size} />
        </span>
        </span>
      </button>
    </div>
  );
}

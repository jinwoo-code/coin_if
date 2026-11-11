"use client";
// 마스코트 '갈래'. 표정 그림(MascotFace)과, 누르고 잡을 수 있는 버튼(Mascot).
// '동작 줄이기'면 움직임 없이 표정과 말만 바뀐다(globals.css).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markChaptersSeen, markFound, newChapter } from "@/lib/galae";
import { MASCOT_LINES, MASCOT_NAME, MASCOT_SPECIAL, type MascotPlace } from "@/lib/mascot-lines";

export type Mood = "base" | "happy" | "think" | "sleepy" | "surprise" | "cheer" | "dizzy" | "grabbed";

export const MASCOT_YELLOW = "#FFD25E";

// viewBox 0 0 80 80 안의 갈래. 몸 중심 (40, 46).
export function MascotFace({ mood = "base", size = 64, className = "", look }: { mood?: Mood; size?: number; className?: string; look?: { x: number; y: number } }) {
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
      <g transform={look ? `translate(${(look.x * 2.6).toFixed(2)} ${(look.y * 2).toFixed(2)})` : undefined}>{eyes}</g>
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

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const CHATTER_MS = 25_000; // 가만히 두면 혼잣말하는 간격(우리가 정한 값)
const SLEEP_MS = 60_000; // 이만큼 아무것도 안 하면 존다

// 누르면 말하고, 잡아 끌고, 던질 수 있는 갈래. 놓으면 제자리로 돌아온다.
export function Mascot({
  place,
  mood: baseMood = "base",
  size = 72,
  align = "center",
  firstLine,
  chatter,
}: {
  place: MascotPlace;
  mood?: Mood;
  size?: number;
  align?: "left" | "center";
  firstLine?: string; // 처음부터 말풍선에 보일 말
  chatter?: string[]; // 혼잣말에 섞을 그때그때 말(진행 숫자 등)
}) {
  const [mood, setMood] = useState<Mood>(baseMood);
  const [line, setLine] = useState<string | null>(firstLine ?? null);
  const [chapterLink, setChapterLink] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hop, setHop] = useState(0);
  const [look, setLook] = useState<{ x: number; y: number } | undefined>();
  const wrap = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const taps = useRef<number[]>([]);
  const count = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const lastActive = useRef(Date.now());
  const sleeping = useRef(false);
  const flying = useRef(0);
  const chatterRef = useRef(chatter);
  chatterRef.current = chatter;

  useEffect(() => setMood(baseMood), [baseMood]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(flying.current);
    },
    [],
  );

  // 6. 새로 열린 이야기 장 알림(이야기 화면 자체에서는 안 함)
  useEffect(() => {
    if (place === "legend") return;
    const n = newChapter();
    if (n) {
      setLine(`갈래 이야기 ${n}장이 열렸어요!`);
      setChapterLink(true);
      setMood("cheer");
      settle(3000);
    }
    if (place === "report") markFound("cheer");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  // 1·2. 혼잣말과 졸기
  useEffect(() => {
    let n = 0;
    let lastSpoke = Date.now();
    const id = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= SLEEP_MS && !sleeping.current) {
        sleeping.current = true;
        markFound("sleepy");
        setMood("sleepy");
        setLine("쿨… 쿨…");
        setChapterLink(false);
        return;
      }
      if (sleeping.current || idle < CHATTER_MS || Date.now() - lastSpoke < CHATTER_MS) return;
      lastSpoke = Date.now();
      const pool = [...(chatterRef.current ?? []), ...MASCOT_LINES[place]];
      setLine(pick(pool, n++));
      setChapterLink(false);
    }, 5000);
    return () => clearInterval(id);
  }, [place]);

  // 3. 마우스 따라보기(마우스가 있는 기기, 동작 줄이기 아닐 때)
  useEffect(() => {
    if (!window.matchMedia?.("(pointer: fine)").matches || reduced()) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = wrap.current?.querySelector("button")?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        const k = Math.min(1, d / 200);
        setLook({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  function settle(after = 2600) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMood(baseMood), after);
  }

  function wake(): boolean {
    lastActive.current = Date.now();
    if (!sleeping.current) return false;
    sleeping.current = false;
    return true;
  }

  function say(text: string, m: Mood) {
    setLine(text);
    setChapterLink(false);
    setMood(m);
    settle();
  }

  function tap() {
    if (wake()) {
      setHop((h) => h + 1);
      return say("앗, 깼어요! 안 잤어요, 진짜로요.", "surprise");
    }
    count.current += 1;
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now];
    setHop((h) => h + 1);
    if (count.current % 10 === 0) {
      markFound("secret");
      return say(MASCOT_SPECIAL.secret, "think");
    }
    if (taps.current.length >= 5) {
      taps.current = [];
      markFound("dizzy");
      return say(pick(MASCOT_SPECIAL.dizzy, count.current), "dizzy");
    }
    const moods: Mood[] = ["happy", "cheer", "surprise", "happy"];
    say(pick(MASCOT_LINES[place], count.current), pick(moods, count.current));
  }

  // 4. 던지기: 놓는 순간 속도로 날아가 화면 가장자리에서 튕긴 뒤 제자리로
  function fling(from: { x: number; y: number }, v: { x: number; y: number }) {
    const btn = wrap.current?.querySelector("button")?.getBoundingClientRect();
    if (!btn) return setPos(null);
    const home = { x: btn.left - from.x, y: btn.top - from.y }; // 제자리일 때 버튼 왼쪽 위
    const W = window.innerWidth;
    const H = window.innerHeight;
    let p = { ...from };
    let vel = { x: v.x * 16, y: v.y * 16 }; // px/ms → px/프레임
    let frames = 0;
    let bounced = false;
    const step = () => {
      frames++;
      vel = { x: vel.x * 0.94, y: vel.y * 0.94 + 0.6 };
      p = { x: p.x + vel.x, y: p.y + vel.y };
      const left = home.x + p.x;
      const top = home.y + p.y;
      if (left < 0 || left + btn.width > W) {
        vel.x = -vel.x * 0.7;
        p.x = left < 0 ? -home.x : W - btn.width - home.x;
        bounced = true;
      }
      if (top < 0 || top + btn.height > H) {
        vel.y = -vel.y * 0.6;
        p.y = top < 0 ? -home.y : H - btn.height - home.y;
        bounced = true;
      }
      setPos({ ...p });
      if (frames < 45 && Math.hypot(vel.x, vel.y) > 0.8) flying.current = window.setTimeout(step, 16);
      else {
        setPos(null);
        markFound("thrown");
        say(bounced ? "꽝! …괜찮아요, 튼튼해요." : "우와, 날았다!", bounced ? "dizzy" : "surprise");
      }
    };
    flying.current = window.setTimeout(step, 16);
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    clearTimeout(flying.current);
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    trail.current = [{ x: 0, y: 0, t: performance.now() }];
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
      wake();
      clearTimeout(timer.current);
      markFound("grabbed");
      setDragging(true);
      setMood("grabbed");
      setChapterLink(false);
      setLine(pick(MASCOT_SPECIAL.grabbed, count.current++));
    }
    const now = performance.now();
    trail.current = [...trail.current.filter((t) => now - t.t < 90), { x: dx, y: dy, t: now }];
    setPos({ x: dx, y: dy });
  }
  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId || !moved.current) return;
    setDragging(false);
    const tr = trail.current;
    const a = tr[0];
    const b = tr[tr.length - 1];
    const dt = Math.max(1, b.t - a.t);
    const v = { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
    if (Math.hypot(v.x, v.y) > 0.9 && !reduced()) {
      setLine("으아아아!");
      setMood("surprise");
      return fling({ x: b.x, y: b.y }, v);
    }
    const far = Math.hypot(b.x, b.y) > 120;
    setPos(null);
    say(pick(MASCOT_SPECIAL.dropped, count.current), far ? "dizzy" : "surprise");
  }

  const free = pos !== null;
  const tilt = dragging && pos ? Math.max(-25, Math.min(25, pos.x / 6)) : 0;

  return (
    // 말풍선도 갈래와 같이 움직이게 감싼 칸 전체를 옮긴다. 기울기는 갈래만.
    <div
      ref={wrap}
      className={`relative z-30 flex flex-col ${align === "center" ? "items-center" : "items-start"}`}
      style={{
        transform: free ? `translate(${pos.x}px, ${pos.y}px)` : undefined,
        transition: free ? "none" : "transform 420ms cubic-bezier(.3,1.6,.5,1)",
      }}
    >
      {line ? (
        <div
          role="status"
          aria-live="polite"
          className="mascot-bubble relative mb-2 max-w-[17rem] rounded-2xl border-2 border-ink bg-surface px-3 py-2 text-sm font-semibold"
          key={line}
          style={align === "left" ? ({ ["--tail" as string]: `${size / 2}px` } as React.CSSProperties) : undefined}
        >
          <p>{line}</p>
          {chapterLink ? (
            <Link href="/legend" onClick={() => markChaptersSeen()} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-lineA underline underline-offset-4">
              읽으러 가기
            </Link>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={`${MASCOT_NAME}에게 말 걸기`}
        title={`${MASCOT_NAME}를 누르거나 잡아 던져 보세요`}
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
        className={`mascot-btn relative z-30 flex min-h-11 min-w-11 touch-none select-none items-center justify-center rounded-full ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <span className="inline-block" style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
          <span key={hop} className={hop ? "mascot-jump inline-block" : "mascot-idle inline-block"}>
            <MascotFace mood={mood} size={size} look={mood === "base" || mood === "happy" ? look : undefined} />
          </span>
        </span>
      </button>
    </div>
  );
}

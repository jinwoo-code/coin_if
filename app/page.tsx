"use client";
// 첫 화면: 하나의 '지금의 나'에서 여러 진로 노선이 갈라지는 그림이 핵심이다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_PROFILE, demoSelection } from "@/lib/demo";
import { store } from "@/lib/store";

const BRANCHES = [
  { color: "#2F5BEA", d: "M150 150 C 205 150, 210 58, 270 58 L 336 58", end: [336, 58], label: "개발자 3년차", delay: 0.55 },
  { color: "#F26B1D", d: "M150 150 L 336 150", end: [336, 150], label: "공무원 3년차", delay: 0.7 },
  { color: "#13A57B", d: "M150 150 C 205 150, 210 242, 270 242 L 336 242", end: [336, 242], label: "데이터 분석가 3년차", delay: 0.85 },
];

function HeroMap() {
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full" role="img" aria-label="지금의 나에서 세 갈래 진로 노선이 갈라지는 그림">
      {/* 지금까지 걸어온 길 */}
      <path d="M24 150 L 150 150" pathLength={1} className="draw-path" stroke="#14171F" strokeWidth="8" strokeLinecap="round" fill="none" />
      {BRANCHES.map((b) => (
        <path
          key={b.label}
          d={b.d}
          pathLength={1}
          className="draw-path"
          style={{ animationDelay: `${b.delay}s` }}
          stroke={b.color}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {/* 중간 역 */}
      {[
        [228, 79],
        [236, 150],
        [228, 221],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="#fff" stroke={BRANCHES[i].color} strokeWidth="4" className="pop" style={{ animationDelay: `${1.3 + i * 0.1}s` }} />
      ))}
      {/* 갈림길(환승역) */}
      <circle cx="150" cy="150" r="13" fill="#fff" stroke="#14171F" strokeWidth="5" className="pop" style={{ animationDelay: "0.45s" }} />
      <circle cx="24" cy="150" r="7" fill="#14171F" />
      <text x="24" y="182" fontSize="13" fontWeight="600" fill="#14171F">
        지금의 나
      </text>
      {/* 종착역 */}
      {BRANCHES.map((b, i) => (
        <g key={b.label} className="pop" style={{ animationDelay: `${1.6 + i * 0.12}s` }}>
          <circle cx={b.end[0]} cy={b.end[1]} r="11" fill={b.color} stroke="#fff" strokeWidth="4" />
          <text x={b.end[0] - 2} y={i === 2 ? b.end[1] + 32 : b.end[1] - 20} fontSize="13" fontWeight="600" textAnchor="end" fill="#14171F">
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

const STEPS = [
  { title: "나를 알려 주기", body: "AI와 5분 인터뷰하고 성격 질문 10개에 답해요" },
  { title: "여러 길을 동시에 살아보기", body: "실제 직업 통계로 정한 사건이 분기마다 일어나요" },
  { title: "그때의 나와 이야기하기", body: "끝에 선 나에게 묻고, 이번 주에 할 일을 받아 가요" },
];

export default function Home() {
  const router = useRouter();
  const [hasProgress, setHasProgress] = useState(false);
  useEffect(() => {
    setHasProgress(Boolean(store.getProfile()));
  }, []);

  function startDemo() {
    store.reset();
    store.setProfile(DEMO_PROFILE);
    store.setSelection(demoSelection());
    router.push("/simulate");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1080px] items-center px-5 sm:px-8">
        <span className="flex items-center gap-2 text-base font-bold tracking-tight">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M2 12h7" stroke="#14171F" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M9 12c4 0 4-6 8-6h5" stroke="#2F5BEA" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M9 12h13" stroke="#F26B1D" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M9 12c4 0 4 6 8 6h5" stroke="#13A57B" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="9" cy="12" r="3" fill="#fff" stroke="#14171F" strokeWidth="2" />
          </svg>
          진로 리허설
        </span>
      </header>

      <main id="main" className="mx-auto grid w-full max-w-[1080px] flex-1 items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <section className="flex flex-col">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            가보기 전에,
            <br />
            먼저 살아보세요
          </h1>
          <p className="mt-5 max-w-[30rem] text-lg text-muted">
            고민 중인 진로를 AI가 실제 직업 통계 위에서 몇 년씩 먼저 살아봐요. 그 끝에 선 나와 이야기하고, 이번 주에 할 일까지 받아 가요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/interview" className="btn-primary sm:px-7">
              5분 인터뷰로 시작하기
            </Link>
            <button onClick={startDemo} className="btn-ghost sm:px-7">
              예시 인물로 바로 보기
            </button>
          </div>
          {hasProgress ? (
            <Link href="/choose" className="mt-4 self-start text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
              하던 곳에서 이어서 하기
            </Link>
          ) : null}
        </section>

        <div className="card order-first p-4 sm:p-6 lg:order-none">
          <HeroMap />
        </div>
      </main>

      <section aria-labelledby="how" className="border-t border-hair bg-surface">
        <div className="mx-auto w-full max-w-[1080px] px-5 py-12 sm:px-8">
          <h2 id="how" className="text-xl font-bold">
            이렇게 진행돼요
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 md:flex-col">
                <span className="num relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-full border-[3px] border-ink bg-surface text-sm font-bold">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 ? (
                  <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%+32px-36px)] w-[3px] bg-ink md:left-9 md:top-[17px] md:h-[3px] md:w-[calc(100%-36px+24px)]" />
                ) : null}
                <div>
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10 text-cap text-muted">결과는 미래 예측이 아니라 선택을 돕는 리허설이에요. 결정은 언제나 직접 해요.</p>
        </div>
      </section>
    </div>
  );
}

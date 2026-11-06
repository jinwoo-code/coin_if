"use client";
// 첫 화면: 하나의 '지금의 나'에서 여러 진로 노선이 갈라지는 그림이 핵심이다.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookmarkCheck, Clock3, Route } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccountButton } from "@/components/account";
import { DEMOS, demoSelection, isDemoPerson } from "@/lib/demo";
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
  { title: "나를 알려 주기", body: "AI와 인터뷰하고 성격 질문 20개에 답해요. 빠르게 하면 약 11분이에요" },
  { title: "여러 길을 동시에 살아보기", body: "실제 직업 통계로 정한 사건이 분기마다 일어나요" },
  { title: "그때의 나와 이야기하기", body: "끝에 선 나에게 묻고, 이번 주에 할 일을 받아 가요" },
];

export default function Home() {
  const router = useRouter();
  const [hasProgress, setHasProgress] = useState(false);
  const [resumeHref, setResumeHref] = useState("/choose");
  const [demoKind, setDemoKind] = useState<keyof typeof DEMOS>("developer");
  const demoDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const check = () => {
      setHasProgress(Boolean(store.getProfile()));
      // 결과가 있는 곳까지만 보낸다. 결과 없이 /simulate로 보내면 묻지 않고 새로 돌아 토큰을 쓴다.
      setResumeHref(store.getReport() ? "/report" : store.getSelection() && store.getMultiverses() ? "/simulate" : "/choose");
    };
    check();
    window.addEventListener("cr:restored", check); // 로그인한 빈 기기에서 계정 기록을 내려받은 뒤
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("cr:restored", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  // 예시 인물을 시작하면 이 기기 기록을 지운다. 내 기록이 있으면 먼저 묻는다(이미 예시 인물이면 잃을 게 없다).
  function requestDemo(kind: keyof typeof DEMOS) {
    const p = store.getProfile();
    if (p && !isDemoPerson(p)) {
      setDemoKind(kind);
      demoDialog.current?.showModal();
    } else startDemo(kind);
  }

  function startDemo(kind: keyof typeof DEMOS) {
    store.reset();
    store.setLocalOnly(true); // 예시 인물은 계정에 올리지 않는다
    store.setProfile(DEMOS[kind].profile);
    store.setSelection(demoSelection(kind));
    router.push("/simulate");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex min-h-20 w-full max-w-[1200px] items-center gap-4 px-5 sm:px-8">
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
        <a href="#how" className="ml-auto hidden min-h-11 items-center text-sm font-medium text-muted hover:text-ink sm:inline-flex">
          이용 방법
        </a>
        <span className="ml-auto sm:ml-2">
          <AccountButton />
        </span>
      </header>

      {hasProgress ? (
        <aside aria-label="저장된 리허설" className="mx-auto mb-4 flex w-[calc(100%-40px)] max-w-[1136px] flex-wrap items-center gap-4 rounded-2xl border border-hair bg-surface p-4 sm:px-6" data-testid="resume-banner">
          <BookmarkCheck aria-hidden="true" className="hidden text-lineA sm:block" size={24} />
          <div className="flex-1 basis-48">
            <p className="text-sm font-bold">진행하던 리허설이 있어요</p>
            <p className="mt-0.5 text-sm text-muted">저장된 진로와 결과를 이어서 살펴보세요.</p>
          </div>
          <Link href={resumeHref} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-lineA hover:bg-lineA/5">
            이어서 하기 <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </aside>
      ) : null}
      <main id="main" className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 px-5 pb-14 pt-6 sm:px-8 sm:pt-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pb-20">
        <section className="flex min-w-0 flex-col">
          <p className="mb-5 flex items-center gap-2 text-sm font-semibold text-muted">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-lineA" />
            나의 가능성을 탐색하는 AI 진로 리허설
          </p>
          <h1 className="text-3xl font-extrabold !leading-[1.2] sm:text-4xl lg:text-[54px]">
            가보기 전에,
            <br />
            <span className="text-lineA">먼저 살아보세요.</span>
          </h1>
          <p className="mt-5 max-w-[30rem] text-lg text-muted">
            고민 중인 진로를 AI가 실제 직업 통계 위에서 몇 년씩 먼저 살아봐요. 그 끝에 선 나와 이야기하고, 이번 주에 할 일까지 받아 가요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/interview" className="btn-primary sm:px-5">
              약 11분 인터뷰로 시작하기
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <button onClick={() => requestDemo("developer")} className="btn-ghost sm:px-5">
              예시 인물로 바로 보기
            </button>
          </div>
          <button onClick={() => requestDemo("nurse")} className="mt-2 min-h-11 self-start text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
            간호학과 3학년 예시로 보기
          </button>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Clock3 aria-hidden="true" size={15} className="flex-none" />
            처음이라면 예시 인물로 먼저 둘러보세요.
          </p>
        </section>

        <figure className="min-w-0 overflow-hidden rounded-[28px] border border-hair bg-surface shadow-[0_16px_48px_-28px_rgba(20,23,31,0.25)]">
          <div className="flex items-center justify-between gap-3 border-b border-hair px-5 py-4 sm:px-7">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Route aria-hidden="true" size={18} />
              나의 가능성 지도
            </span>
            <span className="rounded-full bg-ground px-3 py-1 text-cap font-medium text-muted">체험 예시</span>
          </div>
          <div className="bg-[radial-gradient(#E3E6EB_1px,transparent_1px)] bg-[size:18px_18px] px-5 py-2 sm:px-7">
            <HeroMap />
          </div>
          <figcaption className="border-t border-hair px-5 py-4 sm:px-7">
            <p className="text-sm font-semibold">하나의 출발점, 서로 다른 세 가지 미래</p>
            <p className="mt-1 text-sm text-muted">각 진로의 일상과 변화를 나란히 비교해요.</p>
          </figcaption>
        </figure>
      </main>

      <section aria-labelledby="how" className="border-t border-hair bg-surface">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-12 sm:px-8 sm:py-16">
          <p className="mb-2 text-sm font-semibold text-muted">리허설 이용 방법</p>
          <h2 id="how" className="scroll-mt-6 text-2xl font-bold">
            막연한 고민을, 다음 한 걸음으로
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
        </div>
      </section>
      <footer className="border-t border-hair">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-cap text-muted">결과는 미래 예측이 아니라 선택을 돕는 리허설이에요. 결정은 언제나 직접 해요.</p>
          <Link href="/privacy" className="inline-flex min-h-11 items-center self-start text-cap text-muted underline underline-offset-4 hover:text-ink">
            개인정보 처리방침(초안)
          </Link>
        </div>
      </footer>
      <dialog ref={demoDialog} aria-labelledby="demo-title" aria-describedby="demo-description" className="w-[calc(100%-40px)] max-w-md rounded-[24px] border border-hair bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/40">
        <h2 id="demo-title" className="text-xl font-bold">
          예시 인물로 새로 시작할까요?
        </h2>
        <p id="demo-description" className="mt-3 text-sm text-muted">
          예시 체험을 시작하면 이 브라우저에 저장된 프로필과 리허설 결과가 예시 인물의 기록으로 바뀌어요.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button autoFocus onClick={() => demoDialog.current?.close()} className="btn-ghost">
            취소하고 기록 유지하기
          </button>
          <button onClick={() => startDemo(demoKind)} className="btn-primary">
            예시 인물로 새로 시작하기
          </button>
        </div>
      </dialog>
    </div>
  );
}

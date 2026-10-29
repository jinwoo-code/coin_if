"use client";
// 1. 상담·진단: AI 인터뷰 + 스펙·생활 조건 + 성격 검사(BFI-10) + 상황 질문으로 '나'를 만든다.
import { ArrowUp, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MockNotice, RouteProgress, Screen, Typing, won } from "@/components/ui";
import { BFI_ITEMS, scoreBfi } from "@/lib/bfi";
import { DEFAULT_LIFE, DEFAULT_SPEC, DEFAULT_WANTS, precision } from "@/lib/profile";
import { store } from "@/lib/store";
import { scoreSjt, SJT } from "@/lib/tests";
import type { Behavior, BigFive, Life, Profile, Spec, ValueKey, Wants } from "@/lib/types";
import { LifeForm, SpecForm, WantsForm } from "./form";

type TextKey = "dilemma" | "experiences" | "constraints";
type Step =
  | { kind: "basic" }
  | { kind: "text"; key: TextKey; ask: string; placeholder: string; quick?: string[] }
  | { kind: "values" }
  | { kind: "spec" }
  | { kind: "life" }
  | { kind: "wants" }
  | { kind: "bfi"; itemId: number }
  | { kind: "sjt"; id: string };

const STEPS: Step[] = [
  { kind: "basic" },
  {
    kind: "text",
    key: "dilemma",
    ask: "요즘 가장 고민되는 선택이 뭐예요?",
    placeholder: "예: 개발자로 취업할지 공무원 시험을 볼지…",
    quick: ["바로 취업할지 공무원을 준비할지", "전공을 살릴지 다른 길로 갈지", "취업할지 대학원에 갈지"],
  },
  { kind: "spec" },
  { kind: "values" },
  ...BFI_ITEMS.slice(0, 5).map((i) => ({ kind: "bfi" as const, itemId: i.id })),
  { kind: "text", key: "experiences", ask: "지금까지 해 본 것 중에 기억에 남는 경험이 있어요? 수업, 알바, 동아리 뭐든 좋아요.", placeholder: "예: 동아리에서 앱을 만들어 봤어요…" },
  { kind: "life" },
  ...BFI_ITEMS.slice(5).map((i) => ({ kind: "bfi" as const, itemId: i.id })),
  ...SJT.map((q) => ({ kind: "sjt" as const, id: q.id })),
  { kind: "wants" },
  { kind: "text", key: "constraints", ask: "마지막으로, 진로를 정할 때 신경 쓰이는 게 더 있어요? 가족, 건강, 하고 싶은 것 뭐든요.", placeholder: "예: 부모님이 안정적인 일을 원하셔서…" },
];

const VALUES: { key: ValueKey; hint: string }[] = [
  { key: "안정", hint: "오래 다닐 수 있는 일" },
  { key: "성장", hint: "실력이 계속 느는 일" },
  { key: "돈", hint: "벌이가 넉넉한 일" },
  { key: "여유", hint: "내 시간이 있는 일" },
  { key: "인정", hint: "잘한다는 말을 듣는 일" },
  { key: "자율", hint: "내 방식대로 하는 일" },
  { key: "기여", hint: "누군가에게 도움이 되는 일" },
  { key: "관계", hint: "좋은 사람들과 하는 일" },
];

const SCALE = ["전혀 아니다", "아닌 편", "보통", "그런 편", "매우 그렇다"];

// ---------- 말풍선 ----------

function Ai({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex animate-rise items-end gap-2.5">
      <span aria-hidden="true" className="mb-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
        AI
      </span>
      <div className="max-w-[85%] rounded-[20px] rounded-bl-md bg-surface px-4 py-3 text-base shadow-[0_0_0_1px_#E3E6EB]">{children}</div>
    </div>
  );
}

function Me({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[85%] animate-rise self-end rounded-[20px] rounded-br-md bg-ink px-4 py-3 text-base text-white">{children}</div>;
}

// ---------- 성격 오각형 ----------

const TRAITS: { key: keyof BigFive; label: string }[] = [
  { key: "O", label: "개방성" },
  { key: "C", label: "성실성" },
  { key: "E", label: "외향성" },
  { key: "A", label: "우호성" },
  { key: "N", label: "예민함" },
];

function Radar({ b }: { b: BigFive }) {
  const c = 110;
  const R = 74;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [Math.round((c + r * Math.cos(a)) * 10) / 10, Math.round((c + r * Math.sin(a)) * 10) / 10];
  };
  const ring = (f: number) => TRAITS.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const shape = TRAITS.map((t, i) => pt(i, (R * b[t.key]) / 5).join(",")).join(" ");
  return (
    <svg viewBox="0 0 220 220" className="mx-auto h-auto w-full max-w-[240px]" role="img" aria-label={TRAITS.map((t) => `${t.label} ${b[t.key]}점`).join(", ")}>
      {[0.2, 0.4, 0.6, 0.8, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#E3E6EB" strokeWidth="1" />
      ))}
      <polygon points={shape} fill="#14171F" fillOpacity="0.1" stroke="#14171F" strokeWidth="2" strokeLinejoin="round" />
      {TRAITS.map((t, i) => {
        const [x, y] = pt(i, R + 22);
        return (
          <text key={t.key} x={x} y={y + 4} fontSize="12" fontWeight="600" textAnchor="middle" fill="#5B6472">
            {t.label}
          </text>
        );
      })}
    </svg>
  );
}

// ---------- 결과 화면의 작은 부품 ----------

const BEHAVIOR_LABEL: { key: keyof Behavior; label: string; low: string; high: string }[] = [
  { key: "persistence", label: "끈기", low: "금방 지침", high: "끝까지 버팀" },
  { key: "risk", label: "위험 감수", low: "확실한 것부터", high: "일단 움직임" },
  { key: "coping", label: "스트레스 회복", low: "오래 끌고 감", high: "빨리 털어냄" },
  { key: "social", label: "도움 요청", low: "혼자 해결", high: "바로 물어봄" },
];

function Bars({ b }: { b: Behavior }) {
  return (
    <ul className="flex flex-col gap-3">
      {BEHAVIOR_LABEL.map((x) => (
        <li key={x.key}>
          <p className="flex justify-between text-sm">
            <span className="font-semibold">{x.label}</span>
            <span className="num text-muted">{b[x.key]}</span>
          </p>
          <span className="relative mt-1 block h-1.5 rounded-full bg-hair" aria-hidden="true">
            <span className="absolute top-[-4px] h-[14px] w-[14px] -translate-x-1/2 rounded-full border-[3px] border-ink bg-surface" style={{ left: `${((b[x.key] - 1) / 4) * 100}%` }} />
          </span>
          <p className="mt-1 flex justify-between text-cap text-muted">
            <span>{x.low}</span>
            <span>{x.high}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

function Precision({ p }: { p: Profile }) {
  const { score, missing } = precision(p);
  return (
    <section className="card p-5" aria-labelledby="precision">
      <div className="flex items-baseline justify-between">
        <h2 id="precision" className="label">
          시뮬레이션 정확도
        </h2>
        <span className="num text-2xl font-extrabold">{score}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-hair" aria-hidden="true">
        <span className="block h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${score}%` }} />
      </div>
      {missing.length ? (
        <>
          <p className="mt-3 text-sm text-muted">더 알려 줄수록 '나'에 가까운 세계가 돼요: {missing.join(", ")}</p>
          <Link href="/deepen" className="btn-ghost mt-3 min-h-[44px] w-full text-sm">
            정밀 검사로 정확도 높이기 <ChevronRight aria-hidden="true" size={16} />
          </Link>
        </>
      ) : null}
    </section>
  );
}

// ---------- 화면 ----------

export default function InterviewPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [texts, setTexts] = useState<Record<TextKey, string>>({ dilemma: "", experiences: "", constraints: "" });
  const [draft, setDraft] = useState("");
  const [values, setValues] = useState<ValueKey[]>([]);
  const [bfi, setBfi] = useState<Record<number, number>>({});
  const [sjt, setSjt] = useState<Record<string, number>>({});
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  const [life, setLife] = useState<Life>(DEFAULT_LIFE);
  const [wants, setWants] = useState<Wants>(DEFAULT_WANTS);
  const [imported, setImported] = useState({ resume: false, github: false });
  const [readiness, setReadiness] = useState<Record<string, number>>({});
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const step = STEPS[index];
  const bfiCount = Object.keys(bfi).length;
  const sjtCount = Object.keys(sjt).length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [index, thinking, loading, profile]);

  // 다음 질문 전에 잠깐 '입력 중'을 보여 줘서 대화처럼 느끼게 한다.
  function advance(over: { texts?: Record<TextKey, string>; bfi?: Record<number, number>; sjt?: Record<string, number> } = {}) {
    if (index + 1 >= STEPS.length) {
      submit(over.texts ?? texts, over.bfi ?? bfi, over.sjt ?? sjt);
      return;
    }
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setIndex((i) => i + 1);
    }, 420);
  }

  async function submit(latestTexts: Record<TextKey, string>, latestBfi: Record<number, number>, latestSjt: Record<string, number>) {
    setLoading(true);
    try {
      const draftProfile = {
        name,
        major,
        ...latestTexts,
        values,
        bigFive: scoreBfi(latestBfi),
        behavior: scoreSjt(latestSjt),
        spec,
        life,
        wants,
        interests: null,
        readiness,
        depth: { bfiItems: Object.keys(latestBfi).length, behaviorItems: Object.keys(latestSjt).length, interestItems: 0, spec: true, life: true, ...imported },
      };
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draftProfile) });
      setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function answerText(value: string) {
    if (step.kind !== "text" || !value.trim()) return;
    const updated = { ...texts, [step.key]: value.trim() };
    setTexts(updated);
    setDraft("");
    advance({ texts: updated });
  }

  function confirm() {
    if (!profile) return;
    store.setProfile(profile);
    // 새 인터뷰를 마치면 예전 시뮬레이션 결과는 지운다.
    store.clearResults();
    router.push("/choose");
  }

  const runway = life.livingCost - life.support > 0 ? Math.floor(life.savings / (life.livingCost - life.support)) : null;

  // 지나온 대화
  const history = STEPS.slice(0, index).map((s, i) => {
    if (s.kind === "basic")
      return (
        <div key={i} className="contents">
          <Ai>반가워요. 이름과 전공부터 알려 주세요.</Ai>
          <Me>
            {name}, {major}
          </Me>
        </div>
      );
    if (s.kind === "text")
      return (
        <div key={i} className="contents">
          <Ai>{s.ask}</Ai>
          <Me>{texts[s.key]}</Me>
        </div>
      );
    if (s.kind === "values")
      return (
        <div key={i} className="contents">
          <Ai>일을 고를 때 중요한 걸 순서대로 4개 골라 주세요.</Ai>
          <Me>{values.join(" > ")}</Me>
        </div>
      );
    if (s.kind === "spec")
      return (
        <div key={i} className="contents">
          <Ai>지금 가진 스펙을 알려 주세요. 합격 확률 계산에 바로 쓰여요.</Ai>
          <Me>
            {spec.school} {spec.status}
            {spec.gpa ? `, 학점 ${spec.gpa}` : ""}
            {spec.certs.length ? `, ${spec.certs.join("·")}` : ""}, 프로젝트·작품 {spec.projects}개
          </Me>
        </div>
      );
    if (s.kind === "life")
      return (
        <div key={i} className="contents">
          <Ai>현실 조건도 알려 주세요. 돈이 떨어지는 시점까지 시뮬레이션에 들어가요.</Ai>
          <Me>
            {won(life.savings)} 모음, 생활비 {won(life.livingCost)}, 하루 {life.studyHours}시간 준비 가능, {life.region}, {life.military}
          </Me>
        </div>
      );
    if (s.kind === "wants")
      return (
        <div key={i} className="contents">
          <Ai>일에서 바라는 것과 정말 싫은 걸 알려 주세요.</Ai>
          <Me>
            첫 연봉 {won(wants.salary)}
            {wants.hates.length ? `, 싫은 것: ${wants.hates.join("·")}` : ""}
          </Me>
        </div>
      );
    if (s.kind === "sjt") {
      const q = SJT.find((x) => x.id === s.id)!;
      return (
        <div key={i} className="contents">
          <Ai>{q.text}</Ai>
          <Me>{q.options[sjt[q.id]]?.text}</Me>
        </div>
      );
    }
    return null;
  });

  const done = profile !== null;
  const formStep = step.kind === "spec" || step.kind === "life" || step.kind === "wants";

  return (
    <Screen
      title={done ? "AI가 이해한 나" : "나 만들기"}
      back="/"
      right={done ? null : <span className="num pr-2 text-sm font-semibold text-muted">{`${Math.min(index + 1, STEPS.length)}/${STEPS.length}`}</span>}
      footer={
        done ? (
          <button className="btn-primary w-full" onClick={confirm}>
            이대로 진로 고르기
          </button>
        ) : step.kind === "text" && !thinking && !loading ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              answerText(draft);
            }}
          >
            <label htmlFor="answer" className="sr-only">
              답변
            </label>
            <textarea
              id="answer"
              name="answer"
              rows={1}
              autoComplete="off"
              className="field max-h-32 min-h-[52px] flex-1 resize-none rounded-[26px] py-3.5"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  answerText(draft);
                }
              }}
              placeholder={step.placeholder}
            />
            <button type="submit" aria-label="답변 보내기" disabled={!draft.trim()} className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-ink text-white transition-colors disabled:bg-[#C9CDD4]">
              <ArrowUp aria-hidden="true" size={22} />
            </button>
          </form>
        ) : formStep && !thinking && !loading ? (
          <button className="btn-primary w-full" onClick={() => advance()}>
            {step.kind === "spec" ? "이 스펙으로 다음" : step.kind === "life" ? "이 조건으로 다음" : "다음"}
          </button>
        ) : null
      }
    >
      {done ? null : (
        <div className="pt-1">
          <RouteProgress total={STEPS.length} current={index} label="인터뷰 진행" />
          <p className="mt-3 text-cap text-muted">답변은 나를 닮은 시뮬레이션을 만드는 데만 쓰이고, 이 기기에만 저장돼요</p>
          <MockNotice />
        </div>
      )}

      {done && profile ? (
        <div className="flex animate-rise flex-col gap-4 pt-2">
          <section className="card p-5">
            <p className="label">요약</p>
            <label htmlFor="summary" className="sr-only">
              요약 고치기
            </label>
            <textarea
              id="summary"
              name="summary"
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border-0 bg-transparent p-0 text-lg font-semibold leading-relaxed"
              value={profile.summary}
              onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
            />
            <p className="mt-2 text-cap text-muted">틀린 부분은 눌러서 바로 고칠 수 있어요</p>
          </section>
          <Precision p={profile} />
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="card p-5">
              <p className="label">중요한 가치</p>
              <ol className="mt-3 flex flex-col gap-2">
                {profile.values.map((v, i) => (
                  <li key={v} className="flex items-center gap-3 text-base font-semibold">
                    <span className="num flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cap text-white">{i + 1}</span>
                    {v}
                  </li>
                ))}
              </ol>
            </section>
            <section className="card p-5">
              <p className="label">성격</p>
              <Radar b={profile.bigFive} />
            </section>
          </div>
          <section className="card p-5">
            <p className="label">실제로 어떻게 행동하나(상황 질문)</p>
            <div className="mt-3">
              <Bars b={profile.behavior} />
            </div>
            <p className="mt-3 text-cap text-muted">시뮬레이션에서 '나'가 무엇을 고를지 정할 때 쓰여요.</p>
          </section>
          <section className="card p-5">
            <p className="label">시뮬레이션에 들어가는 현실 조건</p>
            <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">학교</dt>
              <dd>
                {profile.spec.school} {profile.spec.status}
              </dd>
              <dt className="text-muted">자격증</dt>
              <dd>{profile.spec.certs.join(", ") || "없음"}</dd>
              <dt className="text-muted">버틸 수 있는 기간</dt>
              <dd>{runway === null ? "지원으로 충당" : `약 ${runway}개월`}</dd>
              <dt className="text-muted">하루 준비 시간</dt>
              <dd>{profile.life.studyHours}시간</dd>
              <dt className="text-muted">병역</dt>
              <dd>
                {profile.life.military}
                {profile.life.enlistIn !== null ? ` (${profile.life.enlistIn}개월 뒤 입대)` : ""}
              </dd>
              <dt className="text-muted">싫은 것</dt>
              <dd>{profile.wants.hates.join(", ") || "없음"}</dd>
            </dl>
          </section>
          <section className="card p-5">
            <label htmlFor="speech" className="label">
              말투, 그때의 나는 이렇게 말해요
            </label>
            <textarea id="speech" name="speech" rows={2} className="mt-1 w-full resize-none rounded-lg border-0 bg-transparent p-0 text-base" value={profile.speechStyle} onChange={(e) => setProfile({ ...profile, speechStyle: e.target.value })} />
          </section>
          <p className="flex items-center gap-2 text-cap text-muted">
            <Check aria-hidden="true" size={14} /> 이 정보는 이 기기에만 저장돼요
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-6">
          {history}

          {!thinking && !loading && step.kind === "basic" ? (
            <>
              <Ai>반가워요. 이름과 전공부터 알려 주세요.</Ai>
              <form
                className="card ml-[42px] flex animate-rise flex-col gap-3 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim() && major.trim()) advance();
                }}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="label">이름</span>
                  <input className="field" name="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김민준…" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">전공</span>
                  <input className="field" name="major" autoComplete="off" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="예: 컴퓨터모바일융합과…" />
                </label>
                <button className="btn-primary mt-1" type="submit" disabled={!name.trim() || !major.trim()}>
                  다음
                </button>
              </form>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "text" ? (
            <>
              <Ai>{step.ask}</Ai>
              {step.quick ? (
                <div className="ml-[42px] flex animate-rise flex-wrap gap-2">
                  {step.quick.map((q) => (
                    <button key={q} className="chip" onClick={() => answerText(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {!thinking && !loading && step.kind === "spec" ? (
            <>
              <Ai>지금 가진 스펙을 알려 주세요. 합격·취업 확률을 계산할 때 바로 쓰여요. 이력서가 있으면 자동으로 채울 수 있어요.</Ai>
              <section className="card ml-[42px] animate-rise p-4">
                <SpecForm
                  spec={spec}
                  major={major}
                  onChange={setSpec}
                  onImported={(src, extra) => {
                    setImported((m) => ({ ...m, [src]: true }));
                    if (extra?.experiences && !texts.experiences) setDraft(extra.experiences);
                    if (extra?.coding !== undefined) setReadiness((r) => ({ ...r, coding: Math.max(r.coding ?? 0, extra.coding!) }));
                  }}
                />
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "life" ? (
            <>
              <Ai>현실 조건도 알려 주세요. 모아 둔 돈이 떨어지는 시점, 입대 시기까지 시뮬레이션에 그대로 들어가요.</Ai>
              <section className="card ml-[42px] animate-rise p-4">
                <LifeForm life={life} onChange={setLife} />
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "wants" ? (
            <>
              <Ai>일에서 바라는 것과 정말 싫은 걸 알려 주세요.</Ai>
              <section className="card ml-[42px] animate-rise p-4">
                <WantsForm wants={wants} onChange={setWants} />
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "values" ? (
            <>
              <Ai>일을 고를 때 중요한 걸 순서대로 4개 골라 주세요.</Ai>
              <div className="ml-[42px] flex animate-rise flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  {VALUES.map((v) => {
                    const rank = values.indexOf(v.key);
                    const on = rank >= 0;
                    return (
                      <button
                        key={v.key}
                        aria-pressed={on}
                        disabled={!on && values.length >= 4}
                        onClick={() => setValues((cur) => (on ? cur.filter((x) => x !== v.key) : [...cur, v.key]))}
                        className={`relative flex min-h-[68px] flex-col items-start justify-center rounded-2xl border px-4 text-left transition-colors disabled:opacity-40 ${on ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
                      >
                        <span className="text-base font-bold">{v.key}</span>
                        <span className={`text-cap ${on ? "text-white/75" : "text-muted"}`}>{v.hint}</span>
                        {on ? <span className="num absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-cap font-bold text-ink">{rank + 1}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <button className="btn-primary" disabled={values.length < 4} onClick={() => advance()}>
                  {values.length < 4 ? `${4 - values.length}개 더 골라 주세요` : "다음"}
                </button>
              </div>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "sjt"
            ? (() => {
                const q = SJT.find((x) => x.id === step.id)!;
                return (
                  <>
                    {sjtCount === 0 ? <Ai>이번엔 상황 질문이에요. 되고 싶은 모습 말고, 실제로 할 것 같은 쪽을 골라 주세요.</Ai> : null}
                    <section aria-labelledby={q.id} className="card ml-[42px] animate-rise p-5">
                      <p className="num label">상황 {sjtCount + 1} / {SJT.length}</p>
                      <h2 id={q.id} className="mt-1.5 text-lg font-bold">
                        {q.text}
                      </h2>
                      <div className="mt-4 flex flex-col gap-2">
                        {q.options.map((o, i) => (
                          <button
                            key={o.text}
                            onClick={() => {
                              const updated = { ...sjt, [q.id]: i };
                              setSjt(updated);
                              advance({ sjt: updated });
                            }}
                            className="min-h-[48px] rounded-xl border border-hair bg-surface px-4 py-2.5 text-left text-base transition-colors hover:border-ink"
                          >
                            {o.text}
                          </button>
                        ))}
                      </div>
                    </section>
                  </>
                );
              })()
            : null}

          {!thinking && !loading && step.kind === "bfi"
            ? (() => {
                const item = BFI_ITEMS.find((i) => i.id === step.itemId)!;
                return (
                  <>
                    {bfiCount === 0 || bfiCount === 5 ? <Ai>{bfiCount === 0 ? "짧은 성격 질문 몇 개만 할게요. 생각나는 대로 골라 주세요." : "성격 질문 다섯 개만 더 할게요."}</Ai> : null}
                    <section aria-labelledby={`q${item.id}`} className="card ml-[42px] animate-rise p-5">
                      <p className="num label">성격 질문 {bfiCount + 1} / 10</p>
                      <h2 id={`q${item.id}`} className="mt-1.5 text-lg font-bold">
                        “{item.text}”
                      </h2>
                      <div role="group" aria-labelledby={`q${item.id}`} className="mt-4 grid grid-cols-5 gap-1.5">
                        {SCALE.map((label, n) => (
                          <button
                            key={label}
                            aria-label={label}
                            onClick={() => {
                              const updated = { ...bfi, [item.id]: n + 1 };
                              setBfi(updated);
                              advance({ bfi: updated });
                            }}
                            className="flex h-12 items-center justify-center rounded-xl border border-hair bg-surface text-base font-semibold transition-colors hover:border-ink hover:bg-ink hover:text-white"
                          >
                            {n + 1}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-between text-cap text-muted">
                        <span>전혀 아니다</span>
                        <span>매우 그렇다</span>
                      </div>
                    </section>
                  </>
                );
              })()
            : null}

          {thinking ? (
            <Ai>
              <Typing label="AI가 다음 질문을 준비하는 중" />
            </Ai>
          ) : null}
          {loading ? (
            <Ai>
              <span className="flex items-center gap-3">
                <Typing label="답변을 바탕으로 나를 만드는 중" />
                <span className="text-muted">답변을 바탕으로 나를 만드는 중…</span>
              </span>
            </Ai>
          ) : null}
          <div ref={endRef} />
        </div>
      )}
    </Screen>
  );
}

"use client";
// 1. 상담·진단: AI 인터뷰 + 스펙·생활 조건 + 성격 검사(Mini-IPIP) + 상황 질문으로 '나'를 만든다.
import { ArrowUp, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import norms from "@/data/norms.json";
import { MockNotice, RouteProgress, Screen, Typing, won } from "@/components/ui";
import { ChoiceItem, ScaleEnds, ScaleRow } from "@/components/scale";
import { Ai, Me } from "@/components/chat";
import { canDeepen, depthOrder, DEPTHS, remainingSteps, stepsFor, type Step, type TextKey } from "@/lib/assessment";
import { IPIP_REST_IDS, MINI_IDS, miniDone, scoreMini } from "@/lib/mini-ipip";
import { completeness, DEFAULT_LIFE, DEFAULT_SPEC, DEFAULT_WANTS } from "@/lib/profile";
import { store } from "@/lib/store";
import { T } from "@/lib/copy";
import { W } from "@/lib/weights";
import { twinScore } from "@/lib/twin";
import { selfAgreement } from "@/lib/ongoing";
import { chaptersDone } from "@/lib/chapters";
import { isPilotId, PILOT_SJT, pilotActive, pilotAnswered } from "@/lib/pilot";
import { IPIP50, pickHoldout, RIASEC24, scoreScale, scoreSjt, SJT } from "@/lib/tests";
import type { Behavior, BigFive, DepthMode, Interests, Life, Profile, Spec, ValueKey, Wants } from "@/lib/types";
import { LifeForm, SpecForm, WantsForm, type SpecTouched } from "./form";
import { CciForm, cciQa, StoryConfirm } from "./story";
import { scrubStory, type StorySignals } from "@/lib/story";

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

// ---------- 말풍선 ----------

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

// 성격 요인마다 비교 집단 평균과 견준 한 줄. 차이 기준은 선택 이유와 같은 reason.traitMargin(가정값).
// 비교 집단은 미국 청년 표본(data/norms.json)이라 한국 또래 평균이 아니다 → 화면에 그대로 적는다.
function TraitLines({ b }: { b: BigFive }) {
  const mean = norms.bigFive.mean as Record<keyof BigFive, number>;
  const margin = W("reason.traitMargin");
  return (
    <>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {TRAITS.map((t) => {
          const d = b[t.key] - mean[t.key];
          const word = d > margin ? "또래보다 높은 편" : d < -margin ? "또래보다 낮은 편" : "또래와 비슷한 편";
          return (
            <li key={t.key} className="flex justify-between gap-3">
              <span className="font-semibold">{t.label}</span>
              <span className="num text-muted">
                {word} ({b[t.key].toFixed(1)} / 평균 {mean[t.key].toFixed(1)})
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-cap text-muted">
        &apos;또래&apos;는 미국 청년 15,471명 표본(Baldasaro 외 2013)의 평균이에요. 한국 또래 평균은 아직 못 구해서 이 값을 빌려 썼어요. &apos;높은 편·낮은 편&apos;을 가르는 차이 {margin}점은 {T.assumedFull}이에요.
      </p>
    </>
  );
}

// 요약은 잘리지 않게 글 길이만큼 늘어난다
function AutoText(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} {...props} />;
}

// ---------- 결과 화면의 작은 부품 ----------

const BEHAVIOR_LABEL: {
  key: keyof Behavior;
  label: string;
  low: string;
  high: string;
}[] = [
  { key: "persistence", label: "끈기", low: "금방 지침", high: "끝까지 버팀" },
  {
    key: "risk",
    label: "위험 감수",
    low: "확실한 것부터",
    high: "일단 움직임",
  },
  {
    key: "coping",
    label: "스트레스 회복",
    low: "오래 끌고 감",
    high: "빨리 털어냄",
  },
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

// 입력한 정보(체크리스트). 입력 개수는 닮은 정도가 아니라서 점수로 보여 주지 않는다.
function InputChecklist({ p, onDeepen }: { p: Profile; onDeepen: () => void }) {
  const { items } = completeness(p);
  return (
    <section className="card p-5" aria-labelledby="inputs">
      <h2 id="inputs" className="label">
        입력한 정보
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label} className={`flex items-center gap-2 ${i.done ? "" : "text-muted"}`}>
            {i.done ? <Check aria-hidden="true" size={16} className="flex-none" /> : <span aria-hidden="true" className="h-4 w-4 flex-none rounded-full border-2 border-hair" />}
            <span>
              {i.label}
              {i.optional ? " (선택)" : ""}
              <span className="sr-only">{i.done ? " 입력함" : " 아직 안 함"}</span>
            </span>
          </li>
        ))}
      </ul>
      {canDeepen(p) ? (
        <button className="btn-ghost mt-4 min-h-[44px] w-full text-sm" onClick={onDeepen}>
          더 정확하게 하기 <ChevronRight aria-hidden="true" size={16} />
        </button>
      ) : (
        <Link href="/deepen" className="btn-ghost mt-4 min-h-[44px] w-full text-sm">
          커리어넷 가치관 검사(선택) <ChevronRight aria-hidden="true" size={16} />
        </Link>
      )}
    </section>
  );
}

// 분신이 나를 얼마나 닮았는지: 따로 둔 상황 질문에서 분신이 내 답을 맞히는지(lib/twin.ts). 입력 개수와 상관없다.
function TwinMatch({ p }: { p: Profile }) {
  const t = twinScore(p);
  // 이야기 값이 있으면 빼고도 재서 나란히 보여 준다(이야기가 분신을 더 닮게 했는지)
  const base = t && p.story ? twinScore({ ...p, story: null }) : null;
  const last = p.checkins.at(-1);
  const self = last ? selfAgreement(p, last) : null;
  if (!t)
    return (
      <section className="card p-5" aria-labelledby="twin">
        <div className="flex items-baseline justify-between">
          <h2 id="twin" className="label">
            분신 닮은 정도
          </h2>
          <span className="text-base font-bold text-muted">측정 전</span>
        </div>
        <p className="mt-2 text-sm text-muted">채점용 상황 질문에 답하면 분신이 나와 같은 걸 고르는지로 닮은 정도를 재요.</p>
      </section>
    );
  return (
    <section className="card p-5" aria-labelledby="twin">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="twin" className="label">
          분신 닮은 정도
        </h2>
        <span className="text-base font-bold">
          <span className="num">
            {t.n}개 중 {t.hits}개
          </span>{" "}
          맞힘
        </span>
      </div>
      <p className="mt-2 text-sm">
        상황 질문 {t.n}개는 시뮬레이션에 쓰지 않고 따로 뒀어요. 분신에게 같은 질문을 줬더니 {t.n}개 중 {t.hits}개에서 나와 같은 걸 골랐어요. 아무거나 찍으면 {t.chanceHits}개쯤 맞혀요.
      </p>
      <p className="mt-1.5 text-cap text-muted">{t.n < 6 ? "문항이 적어서 우연이 크게 섞여요. 표준으로 더 하면 채점 문항이 6개가 돼요." : "문항이 6개라 우연이 아직 꽤 섞여요."}</p>
      <details className="mt-1 text-cap text-muted">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">자세히</summary>
        <p>
          브라이어 점수 <span className="num">{t.brier.toFixed(2)}</span> (찍기 <span className="num">{t.chanceBrier.toFixed(2)}</span>, 낮을수록 잘 맞힘).
        </p>
        {base ? (
          <p className="mt-1">
            이야기에서 확인한 값을 빼면{" "}
            <span className="num">
              {base.n}개 중 {base.hits}개
            </span>
            , 브라이어 <span className="num">{base.brier.toFixed(2)}</span>이에요.
          </p>
        ) : null}
      </details>
      {self ? (
        <p className="mt-1.5 text-cap text-muted">
          체크인에서 나도 처음 답과 같게 고른 건{" "}
          <span className="num">
            {self.n}개 중 {self.same}개
          </span>
          예요. 사람도 늘 같은 답을 하진 않아서, 분신 점수는 이것과 같이 봐야 해요.
        </p>
      ) : null}
      {p.corrections.length ? <p className="mt-1.5 text-cap text-muted">직접 고친 선택 {p.corrections.length}개가 분신에 반영돼 있어요.</p> : null}
      {p.depthMode === "ongoing" ? (
        <Link href="/checkin" className="mt-3 flex min-h-[44px] items-center justify-between rounded-2xl border border-hair bg-surface px-4 py-2.5 text-sm hover:border-ink">
          <span>
            <strong className="font-semibold">한 달 체크인</strong>
            <span className="text-muted"> · 상황 질문을 다시 물어 기준을 재요</span>
          </span>
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
      ) : null}
      <details className="mt-3">
        <summary className="min-h-[44px] cursor-pointer py-2.5 text-sm font-semibold">문항별로 보기</summary>
        <ul className="mt-1 flex flex-col gap-3">
          {t.items.map((it) => (
            <li key={it.id} className="rounded-2xl bg-ground px-4 py-3 text-sm">
              <p className="font-semibold">{it.text}</p>
              <p className="mt-1.5">
                <span className="text-muted">내 답</span> {it.options[it.pick]}
              </p>
              <p className="mt-0.5">
                <span className="text-muted">분신</span> {it.options[it.guess]}{" "}
                <span className="text-muted">
                  (고를 확률 <span className="num">{Math.round(it.probs[it.guess] * 100)}%</span>)
                </span>
                {it.guess === it.pick ? <span className="ml-1.5 font-semibold text-[#0B6B4B]">맞힘</span> : null}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-cap text-muted">분신은 시뮬레이션에서 '나'의 선택을 정하는 규칙 그대로예요. 지치지도 여유롭지도 않은 평소 상태로 계산했어요.</p>
      </details>
    </section>
  );
}

// ---------- 화면 ----------

const ITEM_TEXT: Record<string, string> = Object.fromEntries([...IPIP50, ...RIASEC24].map((i) => [i.id, i.text]));

export default function InterviewPage() {
  const router = useRouter();
  // 채점용 상황 질문. 처음 정할 때 시드를 만들어 프로필에 저장한다(다시 바뀌지 않게).
  const [holdout, setHoldout] = useState<{ seed: string; ids: string[] }>({ seed: "", ids: pickHoldout("") });
  const [steps, setSteps] = useState<Step[]>(() => stepsFor("quick", pickHoldout("")));
  const [mode, setMode] = useState<DepthMode>("quick");
  // 깊이를 올리는 중이면 지금 프로필(이미 답한 것은 다시 묻지 않는다)
  const [base, setBase] = useState<Profile | null>(null);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [texts, setTexts] = useState<Record<TextKey, string>>({
    dilemma: "",
    experiences: "",
    constraints: "",
  });
  const [draft, setDraft] = useState("");
  const [values, setValues] = useState<ValueKey[]>([]);
  const [sjt, setSjt] = useState<Record<string, number>>({});
  const [ipip, setIpip] = useState<Record<string, number>>({});
  const [riasec, setRiasec] = useState<Record<string, number>>({});
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  const [specPart, setSpecPart] = useState<1 | 2>(1); // 스펙은 두 화면: 학교·학점·어학 → 자격증·경험
  // 학교·지금·졸업까지를 직접 골랐는지. 처음엔 아무것도 안 골라진 상태(기본값 '전문대·재학'이 고른 것처럼 보이지 않게).
  const [specTouched, setSpecTouched] = useState<SpecTouched>({});
  const [specLater, setSpecLater] = useState(false); // '나중에 채우기'(기본값으로 계산하고, 더 정확하게 하기에서 다시 묻는다)
  const [life, setLife] = useState<Life>(DEFAULT_LIFE);
  const [wants, setWants] = useState<Wants>(DEFAULT_WANTS);
  const [imported, setImported] = useState({ resume: false, github: false });
  const [readiness, setReadiness] = useState<Record<string, number>>({});
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  // 진로 구성 인터뷰 답(null = 아직 안 함)과 사용자가 확인한 이야기 값
  const [cci, setCci] = useState<Record<string, string> | null>(null);
  const [story, setStory] = useState<StorySignals | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);

  const step = steps[index];
  // 상황 질문 번호는 화면에 나오는 순서대로(문항 id나 채점용 여부가 드러나지 않게)
  const sjtOrder = steps.flatMap((s) => (s.kind === "sjt" ? s.ids : []));

  // /interview?more=1: 지금 프로필에서 깊이 올리기. 답한 것은 그대로 가져온다.
  useEffect(() => {
    const fresh = () => {
      const seed = Math.random().toString(36).slice(2, 10);
      return { seed, ids: pickHoldout(seed) };
    };
    const params = new URLSearchParams(window.location.search);
    if (params.get("pilot") === "1") {
      store.setPilotInvited(); // 파일럿 초대 링크로 들어옴
      const known = store.getProfile()?.pilot;
      if (!known?.survey?.pre && !known?.withdrawnAt && !store.getPilotPending()?.survey?.pre) {
        router.replace("/pilot/survey?when=pre"); // 쓰기 전에 동의와 사전 설문부터
        return;
      }
    }
    const p = params.get("more") === "1" ? store.getProfile() : null;
    if (!p) {
      const h = fresh();
      setHoldout(h);
      setSteps(stepsFor("quick", h.ids));
      return;
    }
    setHoldout(p.holdout ?? fresh()); // 예전(v4) 프로필은 여기서 처음 정한다
    setBase(p);
    setName(p.name);
    setMajor(p.major);
    setTexts({
      dilemma: p.dilemma,
      experiences: p.experiences,
      constraints: p.constraints,
    });
    setValues(p.values);
    setSjt({ ...p.answers.sjt, ...p.holdoutPicks });
    setIpip(p.answers.ipip ?? {});
    setRiasec(p.answers.riasec ?? {});
    setSpec(p.spec);
    if (p.depth.spec) setSpecTouched({ school: true, status: true, gradIn: true });
    setLife(p.life);
    setWants(p.wants);
    setReadiness(p.readiness);
    setCci(p.storyRaw.cci ?? null);
    setStory(p.story);
    setImported({ resume: p.depth.resume, github: p.depth.github });
    setMode(p.depthMode);
    setSteps([{ kind: "depth" }]);
  }, []);

  useEffect(() => {
    if (thinking || loading || profile) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    else curRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index, thinking, loading, profile]);

  // 다음 질문 전에 잠깐 '입력 중'을 보여 줘서 대화처럼 느끼게 한다.
  // skip: 다음 단계를 건너뛸 개수(진로 구성 인터뷰를 다 건너뛰면 확인 화면도 건너뜀)
  function advance(over: { texts?: Record<TextKey, string>; list?: Step[]; story?: StorySignals | null; skip?: number } = {}) {
    const list = over.list ?? steps;
    const next = index + 1 + (over.skip ?? 0);
    if (next >= list.length) {
      submit(over.texts ?? texts, over.story !== undefined ? over.story : story);
      return;
    }
    setThinking(true);
    window.setTimeout(() => {
      setThinking(false);
      setIndex(next);
    }, 420);
  }

  function chooseDepth(m: DepthMode) {
    setMode(m);
    const list = base ? remainingSteps(m, base, holdout.ids) : stepsFor(m, holdout.ids);
    setSteps(list);
    advance({ list });
  }

  async function submit(latestTexts: Record<TextKey, string>, latestStory: StorySignals | null) {
    setLoading(true);
    try {
      const ipipDone = IPIP50.every((i) => ipip[i.id] !== undefined);
      const riasecDone = RIASEC24.every((i) => riasec[i.id] !== undefined);
      const miniAll = miniDone(ipip);
      // 50문항을 다 답했으면 그 점수, 아니면 20문항. 예전 50문항 프로필은 답이 없을 수 있어 점수를 그대로 둔다.
      const bigFive: BigFive = ipipDone ? (scoreScale(IPIP50, ipip, ["O", "C", "E", "A", "N"]) as BigFive) : base && (base.depth.bigFiveItems >= 50 || !miniAll) ? base.bigFive : scoreMini(ipip);
      const trainPicks = Object.fromEntries(Object.entries(sjt).filter(([id]) => !holdout.ids.includes(id)));
      // 파일럿 답(p1~p20)은 /pilot에서 따로 받으니 그대로 둔다
      const holdoutPicks = { ...Object.fromEntries(Object.entries(base?.holdoutPicks ?? {}).filter(([id]) => isPilotId(id))), ...Object.fromEntries(Object.entries(sjt).filter(([id]) => holdout.ids.includes(id))) };
      // 예전(v4) 프로필은 s1~s6 원답이 없어서 다시 셀 수 없다 → 원래 성향 점수를 그대로 쓴다
      const legacy = base && !base.answers.sjt && base.depth.behaviorItems >= 6;
      const behavior: Behavior = base && (legacy || !Object.keys(trainPicks).length) ? base.behavior : scoreSjt(trainPicks, holdout.ids);
      const interests: Interests | null = riasecDone ? (scoreScale(RIASEC24, riasec, ["R", "I", "A", "S", "E", "C"]) as Interests) : (base?.interests ?? null);
      const draftProfile = {
        ...base,
        name,
        major,
        ...latestTexts,
        values,
        bigFive,
        behavior,
        spec,
        life,
        wants,
        interests,
        readiness,
        depthMode: base && depthOrder(base.depthMode) > depthOrder(mode) ? base.depthMode : mode,
        since: base?.since ?? new Date().toISOString(),
        answers: { sjt: trainPicks, ipip, riasec },
        legacyBigFive: base?.legacyBigFive && !miniAll && !ipipDone ? true : undefined,
        holdout,
        holdoutPicks,
        story: latestStory,
        depth: {
          bigFiveItems: Math.max(base?.depth.bigFiveItems ?? 0, ipipDone ? 50 : miniAll ? 20 : 0),
          behaviorItems: Math.max(base?.depth.behaviorItems ?? 0, Object.keys(trainPicks).length),
          interestItems: Math.max(base?.depth.interestItems ?? 0, riasecDone ? 24 : 0),
          // 학교를 안 고르고 넘어가면 '나중에 채우기'와 같이 본다(기본값으로 계산하고 더 정확하게 하기에서 다시 묻는다)
          spec: (!specLater && !!specTouched.school) || !!base?.depth.spec,
          life: true,
          ...imported,
        },
      };
      // 이야기 원문과 그 인용(근거)은 서버로 보내지 않는다(요약 API에도). 받은 뒤 브라우저에서 다시 붙인다.
      const storyRaw = { ...base?.storyRaw, ...(cci ? { cci } : {}) };
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scrubStory({ ...draftProfile, storyRaw: {} })),
      });
      const made: Profile = { ...(await res.json()), storyRaw, story: draftProfile.story ?? null };
      setProfile(made);
      // 결과가 나오는 순간 저장한다(예전엔 '이대로 진로 고르기'를 눌러야 저장돼서 그 전에 닫으면 검사가 통째로 사라졌다)
      save(made);
    } finally {
      setLoading(false);
    }
  }

  function answerText(value: string) {
    if (step.kind !== "text" || (step.key === "dilemma" && !value.trim())) return;
    const updated = { ...texts, [step.key]: value.trim() };
    setTexts(updated);
    setDraft("");
    advance({ texts: updated });
  }

  const savedRef = useRef(false);
  function save(p: Profile | null = profile) {
    if (!p) return;
    if (!base) store.setLocalOnly(false); // 새로 만든 내 인터뷰 결과는 로그인돼 있으면 계정에 올린다(깊이 올리기는 원래 설정 그대로)
    store.setProfile(p);
    // 내가 바뀌었으니 예전 시뮬레이션 결과는 지운다(한 번만: 결과 화면에서 요약을 고칠 때마다 지우지 않게).
    if (!savedRef.current) store.clearResults();
    savedRef.current = true;
  }

  // 결과 화면에서 요약·말투를 고치면 그때마다 저장한다
  useEffect(() => {
    if (profile && savedRef.current) store.setProfile(profile);
  }, [profile]);

  function confirm() {
    save();
    router.push("/choose");
  }

  // 지금 결과를 저장하고 깊이 올리기로(같은 주소라 새로 불러온다)
  function deepen() {
    save();
    window.location.href = "/interview?more=1";
  }

  const runway = life.livingCost - life.support > 0 ? Math.floor(life.savings / (life.livingCost - life.support)) : null;

  // 지나온 대화
  const history = steps.slice(0, index).map((s, i) => {
    if (s.kind === "consent")
      return (
        <div key={i} className="contents">
          <Ai>시작하기 전에 확인해 주세요.</Ai>
          <Me>동의했어요</Me>
        </div>
      );
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
          <Me>{texts[s.key] || "건너뛰었어요"}</Me>
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
          {specLater ? (
            <Me>나중에 채울게요</Me>
          ) : (
            <Me>
              {specTouched.school ? spec.school : "학교는 나중에"}
              {specTouched.status ? ` ${spec.status}` : ""}
              {spec.gpa ? `, 학점 ${spec.gpa}` : ""}
              {spec.certs.length ? `, ${spec.certs.join("·")}` : ""}, 프로젝트·작품 {spec.projects}개
            </Me>
          )}
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
    if (s.kind === "depth")
      return (
        <div key={i} className="contents">
          <Ai>얼마나 자세히 할까요?</Ai>
          <Me>{DEPTHS.find((d) => d.mode === mode)?.title}</Me>
        </div>
      );
    if (s.kind === "cci")
      return (
        <div key={i} className="contents">
          <Ai>나에 대한 이야기</Ai>
          <Me>{Object.keys(cci ?? {}).length ? `${Object.keys(cci ?? {}).length}개 답했어요` : "건너뛰었어요"}</Me>
        </div>
      );
    if (s.kind === "story")
      return (
        <div key={i} className="contents">
          <Ai>이렇게 이해했어요. 맞나요?</Ai>
          <Me>확인했어요</Me>
        </div>
      );
    if (s.kind === "sjt" || s.kind === "mini" || s.kind === "scale")
      return (
        <div key={i} className="contents">
          <Ai>{s.kind === "sjt" ? "상황 질문" : s.kind === "mini" ? "성격 질문" : s.test === "ipip" ? `성격 나머지 30문항 (${s.part}/${s.parts})` : `흥미 검사 (${s.part}/${s.parts})`}</Ai>
          <Me>{s.ids.length}개 답했어요</Me>
        </div>
      );
    return null;
  });

  const done = profile !== null;
  const formStep = step.kind === "spec" || step.kind === "life" || step.kind === "wants";
  // 문항 묶음 화면: 다 답해야 다음으로
  const batchLeft =
    step.kind === "mini"
      ? step.ids.filter((id) => ipip[id] === undefined).length
      : step.kind === "sjt"
        ? step.ids.filter((id) => sjt[id] === undefined).length
        : step.kind === "scale"
          ? step.ids.filter((id) => (step.test === "ipip" ? ipip : riasec)[id] === undefined).length
          : null;

  return (
    <Screen
      title={done ? "AI가 이해한 나" : "나 만들기"}
      back="/"
      right={done ? null : <span className="num pr-2 text-sm font-semibold text-muted">{`${Math.min(index + 1, steps.length)}/${steps.length}`}</span>}
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
        ) : step.kind === "cci" && !thinking && !loading ? (
          <button
            className="btn-primary w-full"
            onClick={() => {
              const filled = Object.fromEntries(Object.entries(cci ?? {}).filter(([, a]) => a.trim()));
              setCci(filled);
              // 하나도 안 썼으면 '맞나요?' 화면도 건너뛴다
              advance(Object.keys(filled).length ? {} : { skip: steps[index + 1]?.kind === "story" ? 1 : 0 });
            }}
          >
            {Object.values(cci ?? {}).some((a) => a.trim()) ? "다음" : "건너뛰기"}
          </button>
        ) : batchLeft !== null && !thinking && !loading ? (
          <button className="btn-primary w-full" disabled={batchLeft > 0} onClick={() => advance()}>
            {batchLeft > 0 ? `${batchLeft}문항 남았어요` : "다음"}
          </button>
        ) : step.kind === "spec" && !thinking && !loading ? (
          <div className="flex gap-2">
            <button
              className="btn-ghost flex-none px-4"
              onClick={() => {
                setSpecLater(true);
                advance();
              }}
            >
              나중에 채우기
            </button>
            {specPart === 1 ? (
              <button className="btn-primary flex-1" onClick={() => setSpecPart(2)}>
                다음: 자격증·경험
              </button>
            ) : (
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setSpecLater(false);
                  advance();
                }}
              >
                이 스펙으로 다음
              </button>
            )}
          </div>
        ) : formStep && !thinking && !loading ? (
          <button className="btn-primary w-full" onClick={() => advance()}>
            {step.kind === "spec" ? "이 스펙으로 다음" : step.kind === "life" ? "이 조건으로 다음" : "다음"}
          </button>
        ) : null
      }
    >
      {done ? null : (
        <div className="pt-1">
          <RouteProgress total={steps.length} current={index} label="인터뷰 진행" />
          <p className="mt-3 text-cap text-muted">답변은 나를 닮은 시뮬레이션을 만드는 데만 써요. 모든 질문은 건너뛰거나 나중에 지울 수 있어요</p>
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
            <AutoText
              id="summary"
              name="summary"
              rows={3}
              className="mt-1 w-full resize-none overflow-hidden rounded-lg border-0 bg-transparent p-0 text-lg font-semibold leading-relaxed"
              value={profile.summary}
              onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
            />
            <p className="mt-2 text-cap text-muted">틀린 부분은 눌러서 바로 고칠 수 있어요</p>
          </section>
          <InputChecklist p={profile} onDeepen={deepen} />
          {mode === "deep" && chaptersDone(profile) < 6 ? (
            <Link href="/story" onClick={() => save()} className="card flex min-h-[56px] items-center justify-between gap-3 p-5 hover:border-ink">
              <span>
                <strong className="text-base font-bold">인생 이야기 6장 시작하기</strong>
                <span className="mt-0.5 block text-cap text-muted">정밀 단계예요. 장마다 15~20분, 멈췄다가 이어서 할 수 있어요.</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
          {store.isPilotInvited() && !(pilotActive(profile) && pilotAnswered(profile) >= PILOT_SJT.length) && !profile.pilot?.withdrawnAt ? (
            <Link href="/pilot" onClick={() => save()} className="card flex min-h-[56px] items-center justify-between gap-3 border-[#0B6B4B] p-5 hover:border-ink">
              <span>
                <strong className="text-base font-bold">파일럿 상황 질문 {PILOT_SJT.length}개 더 하기</strong>
                <span className="mt-0.5 block text-cap text-muted">파일럿 참여자만 보여요. 따로 동의를 받고, 성향 점수에는 안 들어가요.</span>
              </span>
              <ChevronRight aria-hidden="true" size={18} />
            </Link>
          ) : null}
          <TwinMatch p={profile} />
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
              <TraitLines b={profile.bigFive} />
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
            <textarea
              id="speech"
              name="speech"
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border-0 bg-transparent p-0 text-base"
              value={profile.speechStyle}
              onChange={(e) => setProfile({ ...profile, speechStyle: e.target.value })}
            />
          </section>
          <p className="flex items-center gap-2 text-cap text-muted">
            <Check aria-hidden="true" size={14} /> 이 기기에 저장되고, 로그인하면 계정에도 저장돼요(이야기 원문은 이 기기에만)
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-6">
          {history}
          <div ref={curRef} className="scroll-mt-20" aria-hidden="true" />

          {!thinking && !loading && step.kind === "consent" ? (
            <>
              <Ai>시작하기 전에 확인해 주세요.</Ai>
              <section aria-labelledby="consent" className="card ml-[42px] animate-rise p-5">
                <h2 id="consent" className="text-base font-bold">
                  이렇게 받고, 이렇게 저장해요
                </h2>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
                  <li>
                    <strong>받는 것</strong>: 이름·전공, 고민, 스펙·생활 조건, 가치관, 성격·상황 질문 답. 표준을 고르면 흥미 검사와 나에 대한 이야기도 받아요.
                  </li>
                  <li>
                    <strong>저장</strong>: 검사 결과는 이 기기 브라우저에 저장돼요. 로그인하면 계정(Supabase 서버)에도 저장돼요.
                  </li>
                  <li>
                    <strong>이야기 원문</strong>: 로그인해도 이 기기에만 저장되고 서버로 올라가지 않아요. 값을 뽑을 때 AI가 한 번 읽지만 저장하지 않아요.
                  </li>
                  <li>
                    <strong>AI</strong>: 요약과 이야기 정리에 Google Gemini를 써요.
                  </li>
                  <li>모든 질문은 건너뛸 수 있고, 진로 고르기·리포트 화면의 &lsquo;내 정보&rsquo;에서 언제든 지울 수 있어요.</li>
                </ul>
                <Link href="/privacy" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-4">
                  개인정보 처리방침(초안) 보기
                </Link>
                <button className="btn-primary mt-2 w-full" onClick={() => advance()}>
                  동의하고 시작
                </button>
              </section>
            </>
          ) : null}

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
              ) : (
                <div className="ml-[42px] flex animate-rise">
                  <button className="chip min-h-[44px]" onClick={() => answerText("")}>
                    건너뛰기
                  </button>
                </div>
              )}
            </>
          ) : null}

          {!thinking && !loading && step.kind === "spec" ? (
            <>
              {specPart === 1 ? (
                <Ai>지금 가진 스펙을 알려 주세요(1/2: 학교·학점·어학). 합격·취업 확률을 계산할 때 바로 쓰여요. 이력서가 있으면 자동으로 채울 수 있어요.</Ai>
              ) : (
                <Ai>자격증과 해 본 경험도 알려 주세요(2/2). 없으면 그대로 다음으로 가도 돼요.</Ai>
              )}
              <section key={specPart} className="card ml-[42px] animate-rise p-4">
                {specPart === 2 ? (
                  <button type="button" className="mb-3 min-h-11 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink" onClick={() => setSpecPart(1)}>
                    학교·학점 고치기
                  </button>
                ) : null}
                <SpecForm
                  spec={spec}
                  major={major}
                  part={specPart}
                  onChange={setSpec}
                  touched={specTouched}
                  onTouch={setSpecTouched}
                  onImported={(src, extra) => {
                    setImported((m) => ({ ...m, [src]: true }));
                    if (extra?.experiences && !texts.experiences) setDraft(extra.experiences);
                    if (extra?.coding !== undefined)
                      setReadiness((r) => ({
                        ...r,
                        coding: Math.max(r.coding ?? 0, extra.coding!),
                      }));
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

          {!thinking && !loading && step.kind === "depth" ? (
            <>
              <Ai>{base ? "어디까지 더 해 볼까요? 이미 답한 건 다시 묻지 않아요." : "얼마나 자세히 할까요? 자세히 할수록 나를 더 닮은 시뮬레이션이 돼요."}</Ai>
              <div role="list" className="ml-[42px] flex animate-rise flex-col gap-2">
                {DEPTHS.map((d) => {
                  // 남은 게 깊이 고르기뿐이면 이미 한 것. 계속 닮아 가기는 검사가 남지 않아도 켤 수 있다.
                  const already = base ? (d.mode === "ongoing" ? base.depthMode === "ongoing" : d.mode === "deep" ? chaptersDone(base) === 6 : remainingSteps(d.mode, base, holdout.ids).length <= 1) : false;
                  const off = !d.ready || already;
                  return (
                    <button
                      key={d.mode}
                      role="listitem"
                      disabled={off}
                      onClick={() => chooseDepth(d.mode)}
                      className="flex min-h-[68px] flex-col items-start justify-center rounded-2xl border border-hair bg-surface px-4 py-3 text-left transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-hair"
                    >
                      <span className="flex w-full items-baseline justify-between gap-2">
                        <span className="text-base font-bold">{d.title}</span>
                        <span className="num text-cap font-semibold text-muted">{!d.ready ? "준비 중" : already ? "이미 했어요" : d.time}</span>
                      </span>
                      <span className="mt-0.5 text-cap text-muted">{d.desc}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "cci" ? (
            <>
              <Ai>이번엔 나에 대한 이야기예요. 진로 상담에서 쓰는 질문 다섯 개인데, 쓰고 싶은 것만 편하게 쓰면 돼요.</Ai>
              <section aria-label="진로 구성 인터뷰" className="card ml-[42px] animate-rise p-5">
                <CciForm answers={cci ?? {}} onChange={setCci} />
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "story" ? (
            <>
              <Ai>이렇게 이해했어요. 맞나요?</Ai>
              <section aria-label="이야기에서 뽑은 값" className="card ml-[42px] animate-rise p-5">
                <StoryConfirm
                  qa={cciQa(cci ?? {})}
                  onDone={(s) => {
                    setStory(s);
                    advance({ story: s });
                  }}
                />
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "sjt" ? (
            <>
              {step.ids[0] === SJT[0].id ? <Ai>이번엔 상황 질문이에요. 되고 싶은 모습 말고, 실제로 할 것 같은 쪽을 골라 주세요.</Ai> : <Ai>상황 질문 몇 개 더예요.</Ai>}
              <section aria-label="상황 질문" className="card ml-[42px] animate-rise p-5">
                <ol>
                  {step.ids.map((id) => {
                    const q = SJT.find((x) => x.id === id)!;
                    return (
                      <ChoiceItem key={id} id={`sjt-q${sjtOrder.indexOf(id) + 1}`} n={sjtOrder.indexOf(id) + 1} text={q.text} options={q.options.map((o) => o.text)} value={sjt[id]} onPick={(i) => setSjt((cur) => ({ ...cur, [id]: i }))} />
                    );
                  })}
                </ol>
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "mini" ? (
            <>
              <Ai>{step.first ? "짧은 성격 질문이에요. 생각나는 대로 골라 주세요." : "성격 질문 열 개만 더 할게요."}</Ai>
              <section aria-label="성격 질문" className="card ml-[42px] animate-rise p-5">
                <ScaleEnds />
                <ol className="mt-2">
                  {step.ids.map((id) => (
                    <ScaleRow key={id} id={id} n={MINI_IDS.indexOf(id) + 1} text={ITEM_TEXT[id]} value={ipip[id]} onPick={(v) => setIpip((cur) => ({ ...cur, [id]: v }))} />
                  ))}
                </ol>
              </section>
            </>
          ) : null}

          {!thinking && !loading && step.kind === "scale" ? (
            <>
              <Ai>
                {step.test === "ipip"
                  ? step.part === 1
                    ? "성격 나머지 30문항이에요. 앞에서 답한 20문항과 합쳐 50문항으로 계산해서 더 안정적이에요. IPIP 공개 문항을 저희가 우리말로 옮겼어요."
                    : `성격 문항 ${step.part}/${step.parts}이에요.`
                  : step.part === 1
                    ? "이번엔 직업 흥미 24문항이에요. 저희가 만든 간이 검사라 표준화 검사는 아니에요."
                    : `흥미 문항 ${step.part}/${step.parts}이에요.`}
              </Ai>
              <section aria-label={step.test === "ipip" ? "성격 나머지 30문항" : "흥미 검사"} className="card ml-[42px] animate-rise p-5">
                <ScaleEnds />
                <ol className="mt-2">
                  {step.ids.map((id) => {
                    const ans = step.test === "ipip" ? ipip : riasec;
                    const set = step.test === "ipip" ? setIpip : setRiasec;
                    return <ScaleRow key={id} id={id} n={step.test === "ipip" ? IPIP_REST_IDS.indexOf(id) + 21 : Number(id.slice(1))} text={ITEM_TEXT[id]} value={ans[id]} onPick={(v) => set((cur) => ({ ...cur, [id]: v }))} />;
                  })}
                </ol>
              </section>
            </>
          ) : null}

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

"use client";
// 정밀 검사: 성격 50문항(IPIP) + 직업 흥미 24문항 + 커리어넷 직업가치관검사. 답할수록 시뮬레이션의 '나'가 정확해진다.
import { Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Screen, Typing } from "@/components/ui";
import type { ValueItem } from "@/lib/careernet";
import { precision } from "@/lib/profile";
import { store } from "@/lib/store";
import { IPIP50, RIASEC24, RIASEC_LABEL, scoreScale, type ScaleItem } from "@/lib/tests";
import type { BigFive, Interests, Profile } from "@/lib/types";

type Tab = "bfi" | "riasec" | "values";
const SCALE = ["전혀 아니다", "아닌 편", "보통", "그런 편", "매우 그렇다"];

function Item({ item, n, value, onPick }: { item: ScaleItem; n: number; value: number | undefined; onPick: (v: number) => void }) {
  return (
    <li className="border-b border-hair py-4 last:border-0">
      <p id={item.id} className="text-base font-semibold">
        <span className="num mr-1.5 text-muted">{n}.</span>
        {item.text}
      </p>
      <div role="radiogroup" aria-labelledby={item.id} className="mt-2.5 grid grid-cols-5 gap-1.5">
        {SCALE.map((label, i) => (
          <button
            key={label}
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

// 가치관검사 한 문항: 두 가치 중 더 중요한 쪽 고르기
function PairItem({ item, n, value, onPick }: { item: ValueItem; n: number; value: string | undefined; onPick: (v: string) => void }) {
  const id = `values-${item.no}`;
  return (
    <li className="border-b border-hair py-4 last:border-0">
      <p id={id} className="text-base font-semibold">
        <span className="num mr-1.5 text-muted">{n}.</span>
        어느 쪽이 더 중요해요?
      </p>
      <div role="radiogroup" aria-labelledby={id} className="mt-2.5 grid grid-cols-2 gap-2">
        {[item.a, item.b].map((c) => (
          <button
            key={c.score}
            role="radio"
            aria-checked={value === c.score}
            onClick={() => onPick(c.score)}
            className={`min-h-11 rounded-xl border px-3 py-2.5 text-left transition-colors ${value === c.score ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
          >
            <span className="block text-sm font-bold">{c.label}</span>
            <span className={`mt-0.5 block text-cap ${value === c.score ? "text-white/75" : "text-muted"}`}>{c.desc}</span>
          </button>
        ))}
      </div>
    </li>
  );
}

// 인터뷰의 전공 칸에 'n학년'이 있으면 쓴다(커리어넷 제출 필수값)
function gradeOf(p: Profile) {
  return p.major.match(/([1-6])\s*학년/)?.[1] ?? "1";
}

export default function DeepenPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("bfi");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState("");
  // 커리어넷 가치관검사
  const [values, setValues] = useState<{ available: boolean; items: ValueItem[] } | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [gender, setGender] = useState<"남" | "여" | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    const p = store.getProfile();
    if (!p) router.replace("/interview");
    else setProfile(p);
  }, [router]);

  useEffect(() => {
    if (tab !== "values" || values) return;
    fetch("/api/values")
      .then((r) => r.json())
      .then(setValues)
      .catch(() => setValues({ available: false, items: [] }));
  }, [tab, values]);

  const items = tab === "bfi" ? IPIP50 : RIASEC24;
  const total = tab === "values" ? (values?.items.length ?? 0) : items.length;
  const answered = tab === "values" ? (values?.items.filter((i) => picks[String(i.no)] !== undefined).length ?? 0) : items.filter((i) => answers[i.id] !== undefined).length;
  const complete = total > 0 && answered === total && (tab !== "values" || gender !== null);
  const before = useMemo(() => (profile ? precision(profile).score : 0), [profile]);

  function save() {
    if (!profile || !complete) return;
    let next: Profile;
    if (tab === "bfi") {
      const b = scoreScale(IPIP50, answers, ["O", "C", "E", "A", "N"]) as BigFive;
      next = { ...profile, bigFive: b, depth: { ...profile.depth, bfiItems: 50 } };
    } else {
      const it = scoreScale(RIASEC24, answers, ["R", "I", "A", "S", "E", "C"]) as Interests;
      next = { ...profile, interests: it, depth: { ...profile.depth, interestItems: 24 } };
    }
    store.setProfile(next);
    store.clearResults(); // 내가 바뀌었으니 시뮬레이션을 다시 돌려야 한다
    setProfile(next);
    setSaved(tab === "bfi" ? "성격을 50문항 결과로 바꿨어요." : `흥미 유형: ${Object.entries(next.interests!).toSorted((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => RIASEC_LABEL[k as keyof Interests]).join(", ")}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 가치관검사는 시뮬레이션을 바꾸지 않으니 결과를 지우지 않는다
  async function submitValues() {
    if (!profile || !complete || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: picks, gender, target: profile.spec.status === "졸업" ? "일반" : "대학생", grade: gradeOf(profile), startedAt: startedAt || Date.now() }),
      });
      const r = await res.json();
      if (!res.ok || !r.url) throw new Error(r.error);
      const next: Profile = { ...profile, valuesTest: { seq: r.seq, url: r.url, at: new Date().toISOString() } };
      store.setProfile(next);
      setProfile(next);
      setPicks({}); // 같은 답을 두 번 제출하지 않게
      setStartedAt(0);
      setSaved("커리어넷 결과지가 만들어졌어요.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSendError("커리어넷에 제출하지 못했어요. 답은 그대로 있으니 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setSending(false);
    }
  }

  if (!profile) return null;
  const after = precision(profile).score;
  const valuesReady = tab === "values" && values?.available;

  return (
    <Screen
      title="정밀 검사"
      back="/interview"
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => router.push("/choose")}>
            진로 고르기로
          </button>
          {tab !== "values" ? (
            <button className="btn-primary flex-1" disabled={!complete} onClick={save}>
              {complete ? "결과 저장" : `${items.length - answered}문항 남음`}
            </button>
          ) : valuesReady ? (
            <button className="btn-primary flex-1" disabled={!complete || sending} onClick={submitValues}>
              {sending ? "제출하는 중" : complete ? "커리어넷에 제출" : answered < total ? `${total - answered}문항 남음` : "성별을 골라 주세요"}
            </button>
          ) : null}
        </div>
      }
    >
      <p className="mt-2 text-sm text-muted">
        시뮬레이션 정확도 <strong className="num text-ink">{after}%</strong>
        {after !== before ? ` (${before}%에서 올랐어요)` : ""}. 끝까지 답하면 결과가 시뮬레이션에 바로 반영돼요.
      </p>
      {saved ? (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-[#E7F6EF] px-4 py-3 text-sm text-[#0B6B4B]">
          <Check aria-hidden="true" size={16} /> {saved}
        </p>
      ) : null}
      <div role="tablist" aria-label="검사" className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-hair/70 p-1">
        {(
          [
            ["bfi", `성격 50${profile.depth.bfiItems >= 50 ? " ✓" : ""}`],
            ["riasec", `흥미 24${profile.depth.interestItems >= 24 ? " ✓" : ""}`],
            ["values", `가치관 28${profile.valuesTest ? " ✓" : ""}`],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k);
              setAnswers({});
              setSaved("");
            }}
            className={`h-11 rounded-full text-sm transition-colors ${tab === k ? "bg-surface font-bold shadow-[0_1px_2px_rgba(20,23,31,0.08)]" : "font-medium text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-cap text-muted">
        {tab === "bfi"
          ? "IPIP 성격 5요인 50문항(공개 문항, 우리말 번역은 자체 번역)이에요. 10문항 검사보다 훨씬 안정적이에요."
          : tab === "riasec"
            ? "홀랜드 6유형(현실·탐구·예술·사회·진취·관습)을 보는 간이 검사예요. 저희가 만든 문항이라 표준화 검사는 아니에요. 커리어넷 직업흥미검사는 중·고등학생용이라 쓰지 않았어요."
            : "커리어넷 직업가치관검사(대학생·일반용)예요. 28쌍에서 더 중요한 쪽을 고르면 커리어넷이 결과지를 만들어 줘요. 결과지는 커리어넷 사이트에서 열리고, 시뮬레이션에는 인터뷰에서 고른 가치관을 그대로 써요."}
      </p>

      {tab === "values" ? (
        <>
          {profile.valuesTest ? (
            <a href={profile.valuesTest.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-hair bg-surface px-4 py-3 text-sm font-semibold hover:border-ink">
              커리어넷 결과지 보기
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          ) : null}
          {!values ? (
            <div className="mt-6">
              <Typing label="커리어넷에서 문항을 받는 중" />
            </div>
          ) : !values.available ? (
            <p className="mt-4 rounded-2xl bg-hair/60 px-4 py-3 text-sm">지금은 커리어넷에 연결할 수 없어서 이 검사를 할 수 없어요. 시뮬레이션에는 인터뷰에서 고른 가치관을 그대로 써요.</p>
          ) : (
            <>
              <div className="mt-4">
                <p id="values-gender" className="text-sm font-semibold">
                  성별 <span className="font-normal text-muted">(커리어넷 제출에 꼭 필요해요. 저장하지 않아요)</span>
                </p>
                <div role="radiogroup" aria-labelledby="values-gender" className="mt-2 grid grid-cols-2 gap-2">
                  {(["남", "여"] as const).map((g) => (
                    <button
                      key={g}
                      role="radio"
                      aria-checked={gender === g}
                      onClick={() => setGender(g)}
                      className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${gender === g ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
                    >
                      {g === "남" ? "남자" : "여자"}
                    </button>
                  ))}
                </div>
              </div>
              <Progress answered={answered} total={total} />
              <ol className="mt-1">
                {values.items.map((it, i) => (
                  <PairItem
                    key={it.no}
                    item={it}
                    n={i + 1}
                    value={picks[String(it.no)]}
                    onPick={(v) => {
                      if (!startedAt) setStartedAt(Date.now());
                      setPicks((a) => ({ ...a, [String(it.no)]: v }));
                    }}
                  />
                ))}
              </ol>
              {sendError ? (
                <p role="alert" className="mb-4 rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm text-[#A12828]">
                  {sendError}
                </p>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <Progress answered={answered} total={total} />
          <ol className="mt-1">
            {items.map((it, i) => (
              <Item key={it.id} item={it} n={i + 1} value={answers[it.id]} onPick={(v) => setAnswers((a) => ({ ...a, [it.id]: v }))} />
            ))}
          </ol>
        </>
      )}
    </Screen>
  );
}

function Progress({ answered, total }: { answered: number; total: number }) {
  return (
    <div className="sticky top-16 z-10 -mx-5 mt-3 bg-ground/95 px-5 py-2 backdrop-blur">
      <div role="progressbar" aria-label="검사 진행" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} className="flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-hair">
          <span className="block h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
        </span>
        <span className="num text-cap font-semibold">
          {answered}/{total}
        </span>
      </div>
    </div>
  );
}

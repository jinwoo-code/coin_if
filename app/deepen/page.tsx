"use client";
// 커리어넷 직업가치관검사(선택). 성격 50문항·흥미 24문항은 인터뷰의 '표준' 깊이로 옮겼다(/interview?more=1).
import { Check, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, Typing } from "@/components/ui";
import type { ValueItem } from "@/lib/careernet";
import { store } from "@/lib/store";
import type { Profile } from "@/lib/types";

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
  const [saved, setSaved] = useState("");
  // 커리어넷 가치관검사
  const [values, setValues] = useState<{
    available: boolean;
    items: ValueItem[];
  } | null>(null);
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
    if (values) return;
    fetch("/api/values")
      .then((r) => r.json())
      .then(setValues)
      .catch(() => setValues({ available: false, items: [] }));
  }, [values]);

  const total = values?.items.length ?? 0;
  const answered = values?.items.filter((i) => picks[String(i.no)] !== undefined).length ?? 0;
  const complete = total > 0 && answered === total && gender !== null;

  // 가치관검사는 시뮬레이션을 바꾸지 않으니 결과를 지우지 않는다
  async function submitValues() {
    if (!profile || !complete || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: picks,
          gender,
          target: profile.spec.status === "졸업" ? "일반" : "대학생",
          grade: gradeOf(profile),
          startedAt: startedAt || Date.now(),
        }),
      });
      const r = await res.json();
      if (!res.ok || !r.url) throw new Error(r.error);
      const next: Profile = {
        ...profile,
        valuesTest: { seq: r.seq, url: r.url, at: new Date().toISOString() },
      };
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
  const valuesReady = values?.available;

  return (
    <Screen
      title="커리어넷 가치관 검사"
      back="/interview"
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => router.push("/choose")}>
            진로 고르기로
          </button>
          {valuesReady ? (
            <button className="btn-primary flex-1" disabled={!complete || sending} onClick={submitValues}>
              {sending ? "제출하는 중" : complete ? "커리어넷에 제출" : answered < total ? `${total - answered}문항 남음` : "성별을 골라 주세요"}
            </button>
          ) : null}
        </div>
      }
    >
      {saved ? (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-[#E7F6EF] px-4 py-3 text-sm text-[#0B6B4B]">
          <Check aria-hidden="true" size={16} /> {saved}
        </p>
      ) : null}
      <p className="mt-3 text-cap text-muted">
        커리어넷 직업가치관검사(대학생·일반용)예요. 28쌍에서 더 중요한 쪽을 고르면 커리어넷이 결과지를 만들어 줘요. 결과지는 커리어넷 사이트에서 열리고, 시뮬레이션에는 인터뷰에서 고른 가치관을 그대로 써요.
      </p>

      <>
        {profile.valuesTest ? (
          <a
            href={profile.valuesTest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-hair bg-surface px-4 py-3 text-sm font-semibold hover:border-ink"
          >
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

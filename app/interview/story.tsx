"use client";
// 진로 구성 인터뷰 5문항과 "이렇게 이해했어요, 맞나요?" 확인 화면.
// 원문은 이 기기에만 저장한다. 뽑은 값은 사용자가 고치거나 지울 수 있고, 확인한 것만 프로필에 들어간다.
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Typing } from "@/components/ui";
import { CRISIS_CONTACTS, hasCrisis } from "@/lib/crisis";
import { CCI, EMPTY_SIGNALS, hasAnySignal, LABEL, type StorySignals } from "@/lib/story";

export function CrisisNote() {
  return (
    <p role="alert" className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-sm text-[#A12828]">
      많이 힘든 시간을 지나고 있다면 혼자 견디지 않아도 돼요. {CRISIS_CONTACTS}에서 이야기를 들어 줘요.
    </p>
  );
}

export function CciForm({ answers, onChange }: { answers: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {CCI.map((q, i) => (
        <label key={q.id} htmlFor={`cci-${q.id}`} className="flex flex-col gap-1.5">
          <span className="text-base font-semibold">
            <span className="num mr-1.5 text-muted">{i + 1}.</span>
            {q.ask}
          </span>
          <textarea
            id={`cci-${q.id}`}
            name={q.id}
            rows={2}
            autoComplete="off"
            className="field min-h-[72px] resize-y rounded-2xl py-3"
            placeholder={q.placeholder}
            value={answers[q.id] ?? ""}
            onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })}
          />
        </label>
      ))}
      {hasCrisis(Object.values(answers).join(" ")) ? <CrisisNote /> : null}
      <p className="text-cap text-muted">모두 건너뛸 수 있어요. 쓴 글은 이 기기에만 저장돼요. 값을 뽑을 때 AI가 한 번 읽지만 서버에 저장하지 않아요.</p>
    </div>
  );
}

// ---------- 확인 화면 ----------

function Pick<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: { v: T; t: string }[]; onPick: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onPick(o.v)}
          className={`min-h-[44px] rounded-xl border px-3 text-sm transition-colors ${value === o.v ? "border-ink bg-ink font-semibold text-white" : "border-hair bg-surface hover:border-ink"}`}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Card({ title, evidence, onRemove, children }: { title: string; evidence: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-hair bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="label">{title}</p>
        <button type="button" onClick={onRemove} aria-label={`${title} 지우기`} className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-black/5">
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      {children}
      <p className="mt-2 text-cap text-muted">근거: “{evidence}”</p>
    </li>
  );
}

const scale = [1, 2, 3, 4, 5].map((v) => ({ v, t: String(v) }));
const opts = <K extends keyof typeof LABEL>(k: K) => Object.entries(LABEL[k]).map(([v, t]) => ({ v, t }));

// 진로 구성 인터뷰 답 → 질문·답 목록
export const cciQa = (answers: Record<string, string>) => CCI.filter((q) => answers[q.id]?.trim()).map((q) => ({ q: q.ask, a: answers[q.id] }));

export function StoryConfirm({ qa, onDone }: { qa: { q: string; a: string }[]; onDone: (s: StorySignals) => void }) {
  const [s, setS] = useState<StorySignals | null>(null);
  const [crisis, setCrisis] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return; // 개발 모드에서 두 번 부르지 않게
    asked.current = true;
    fetch("/api/story/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qa }) })
      .then((r) => r.json())
      .then((r: { signals?: StorySignals; crisis?: boolean }) => {
        setS(r.signals ?? EMPTY_SIGNALS);
        setCrisis(Boolean(r.crisis));
      })
      .catch(() => setS(EMPTY_SIGNALS));
  }, [qa]);

  if (!s)
    return (
      <span className="flex items-center gap-3">
        <Typing label="이야기를 읽는 중" />
        <span className="text-muted">이야기를 읽는 중…</span>
      </span>
    );

  const set = (patch: Partial<StorySignals>) => setS({ ...s, ...patch });
  return (
    <div className="flex flex-col gap-3">
      {crisis ? <CrisisNote /> : null}
      {hasAnySignal(s) ? (
        <>
          <p className="text-sm text-muted">틀린 건 고치거나 ✕로 지워 주세요. 맞다고 한 값만 시뮬레이션의 '나'가 고를 때 조금 반영돼요(반영하는 정도는 가정값이에요).</p>
          <ul className="flex flex-col gap-2">
            {s.decisionStyle ? (
              <Card title="결정하는 방식" evidence={s.decisionStyle.evidence} onRemove={() => set({ decisionStyle: null })}>
                <Pick label="결정하는 방식" value={s.decisionStyle.value} options={opts("decisionStyle")} onPick={(v) => set({ decisionStyle: { ...s.decisionStyle!, value: v as "impulsive" } })} />
              </Card>
            ) : null}
            {s.persistence ? (
              <Card title="끈기(1 금방 그만둠 ~ 5 끝까지 함)" evidence={s.persistence.evidence} onRemove={() => set({ persistence: null })}>
                <Pick label="끈기" value={s.persistence.value} options={scale} onPick={(v) => set({ persistence: { ...s.persistence!, value: v as 1 } })} />
              </Card>
            ) : null}
            {s.familyExpectation ? (
              <Card title="가족이 바라는 것" evidence={s.familyExpectation.evidence} onRemove={() => set({ familyExpectation: null })}>
                <Pick label="가족이 바라는 것" value={s.familyExpectation.value} options={opts("familyExpectation")} onPick={(v) => set({ familyExpectation: { ...s.familyExpectation!, value: v as "none" } })} />
                {s.familyExpectation.job ? <p className="mt-2 text-sm">바라는 직업: {s.familyExpectation.job}</p> : null}
                <p className="mt-3 text-cap text-muted">얼마나 신경 쓰여요? (1 거의 안 씀 ~ 5 많이 씀)</p>
                <Pick label="가족 기대가 신경 쓰이는 정도" value={s.familyExpectation.strength} options={scale} onPick={(v) => set({ familyExpectation: { ...s.familyExpectation!, strength: v as 1 } })} />
              </Card>
            ) : null}
            {s.regretType ? (
              <Card title="후회" evidence={s.regretType.evidence} onRemove={() => set({ regretType: null })}>
                <Pick label="후회" value={s.regretType.value} options={opts("regretType")} onPick={(v) => set({ regretType: { ...s.regretType!, value: v as "none" } })} />
              </Card>
            ) : null}
            {s.coreValues.map((c) => (
              <Card key={c.value} title={`중요하게 여기는 것: ${c.value}`} evidence={c.evidence} onRemove={() => set({ coreValues: s.coreValues.filter((x) => x.value !== c.value) })}>
                {null}
              </Card>
            ))}
            {s.runwayMonths ? (
              <Card title="집 지원 없이 버틸 수 있는 기간" evidence={s.runwayMonths.evidence} onRemove={() => set({ runwayMonths: null })}>
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    inputMode="numeric"
                    className="field w-24"
                    value={s.runwayMonths.value}
                    onChange={(e) => set({ runwayMonths: { ...s.runwayMonths!, value: Math.max(0, Math.min(120, Number(e.target.value) || 0)) } })}
                    aria-label="버틸 수 있는 개월 수"
                  />
                  개월
                </label>
              </Card>
            ) : null}
          </ul>
        </>
      ) : (
        <p className="text-sm">이야기에서 확실히 뽑을 수 있는 값은 없었어요. 쓴 이야기는 이 기기에만 저장돼요.</p>
      )}
      <button type="button" className="btn-primary mt-1" onClick={() => onDone(s)}>
        {hasAnySignal(s) ? "맞아요, 이대로 저장" : "다음"}
      </button>
    </div>
  );
}

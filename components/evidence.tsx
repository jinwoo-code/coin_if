"use client";
// 리포트 '증거물': 능력단위별 증거물과 완성 기준. 시험형은 모의고사 기록과 약점 과목 계획. 고친 값은 이 기기에만.
import { useState } from "react";
import { buildEvidence, buildExamPlan, isExamWorld, topicKey, weakSubjects, type EvidenceCard, type EvidenceSaved, type ExamPlan, type MockRecord } from "@/lib/evidence";
import type { GapItem } from "@/lib/gap";
import { majorFamily } from "@/lib/job-codes";
import { profileHash } from "@/lib/judge";
import { RIASEC_LABEL } from "@/lib/tests";
import type { Requirements } from "@/lib/requirements";
import { store } from "@/lib/store";
import type { Interests, Profile, WorldTemplate } from "@/lib/types";

function useSaved(worldId: string) {
  const [saved, setSaved] = useState<EvidenceSaved>(() => store.getEvidence()[worldId] ?? {});
  const update = (next: EvidenceSaved) => {
    setSaved(next);
    store.setEvidence({ ...store.getEvidence(), [worldId]: next });
  };
  return [saved, update] as const;
}

function topInterests(i: Interests | null): string[] {
  if (!i) return [];
  return (Object.entries(i) as [keyof Interests, number][])
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => RIASEC_LABEL[k]);
}

function Card({ card, saved, update }: { card: EvidenceCard; saved: EvidenceSaved; update: (s: EvidenceSaved) => void }) {
  const topic = saved.topics?.[card.id] ?? "";
  const done = saved.checks?.[card.id] ?? [];
  const suggestions = saved.suggestions?.[card.id] ?? [];
  const setTopic = (t: string) => update({ ...saved, topics: { ...saved.topics, [card.id]: t } });
  const toggle = (c: string) => update({ ...saved, checks: { ...saved.checks, [card.id]: done.includes(c) ? done.filter((x) => x !== c) : [...done, c] } });
  return (
    <li className="rounded-lg border border-hair p-3" data-testid={`evidence-card-${card.id}`}>
      <p className="font-medium">{card.unit ? `${card.unit}: ${card.form}` : card.form}</p>
      <p className="mt-0.5 text-cap text-muted">분량 {card.amount}(가정값)</p>

      {!card.noTopic && suggestions.length ? (
        <div className="mt-2">
          <p className="text-cap text-muted">{saved.ruleCards?.includes(card.id) ? "AI 없이 만든 예시예요. 고치거나 직접 써 주세요." : "AI 제안이에요. 정답이 아니니 고치거나 직접 써 주세요."}</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {suggestions.map((s) => (
              <li key={s.title}>
                <button type="button" aria-pressed={topic === s.title} onClick={() => setTopic(s.title)} className={`min-h-11 w-full rounded-lg border px-3 py-2 text-left text-sm ${topic === s.title ? "border-ink bg-ink text-surface" : "border-hair bg-surface"}`}>
                  {s.title}
                  {s.why ? <span className={`block text-cap ${topic === s.title ? "" : "text-muted"}`}>{s.why}</span> : null}
                  {s.isNew ? <span className="mt-0.5 block text-cap font-medium">새로 만들 프로젝트(아직 한 일이 아니에요)</span> : null}
                  {s.learn?.length ? <span className="mt-0.5 block text-cap font-medium">새로 배울 기술: {s.learn.join(", ")}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {card.noTopic ? null : (
        <label className="mt-2 block text-sm">
          내 주제
          <input type="text" value={topic} maxLength={80} placeholder="직접 써도 돼요" onChange={(e) => setTopic(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3" />
        </label>
      )}

      <p className="mt-3 text-sm font-medium">
        완성 기준 {done.filter((c) => card.checks.includes(c)).length}/{card.checks.length}
        <span className="ml-1.5 text-cap font-normal text-muted">
          {card.checksGrade === "ncs" ? `NCS 수행준거 원문. 전체 ${card.checksTotal}개 중 능력단위요소마다 하나` : card.checksGrade === "curated" ? "공식 항목" : "가정값(팀이 정함)"}
        </span>
      </p>
      {card.checksRef ? (
        <p className="mt-0.5 text-cap text-muted">
          {card.checksRef.label}{" "}
          <a className="underline" href={card.checksRef.url} target="_blank" rel="noreferrer">
            사본
          </a>{" "}
          ·{" "}
          <a className="underline" href={card.checksRef.notice} target="_blank" rel="noreferrer">
            평가원 공지
          </a>
        </p>
      ) : null}
      <ul className="mt-1">
        {card.checks.map((c) => (
          <li key={c}>
            <label className="flex min-h-11 items-start gap-2 py-1.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={done.includes(c)} onChange={() => toggle(c)} />
              <span>{c}</span>
            </label>
          </li>
        ))}
      </ul>
      {card.evalConsider.length ? (
        <details className="mt-1 text-cap">
          <summary className="flex min-h-11 cursor-pointer items-center underline">NCS 평가에서 보는 것</summary>
          <ul className="list-disc pl-4">
            {card.evalConsider.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function ExamSection({ plan, world }: { plan: ExamPlan; world: WorldTemplate }) {
  const [saved, update] = useSaved(world.id);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [ym, setYm] = useState("");
  const mocks = saved.mocks ?? [];
  const weak = weakSubjects(mocks, plan.subjects);
  const add = () => {
    const scores = Object.fromEntries(
      Object.entries(draft)
        .map(([k, v]) => [k, Number(v)] as const)
        .filter(([, v]) => Number.isFinite(v) && v >= 0 && v <= 100),
    );
    if (!Object.keys(scores).length) return;
    const record: MockRecord = { ym, scores };
    update({ ...saved, mocks: [...mocks, record] });
    setDraft({});
  };
  return (
    <div className="mt-5" data-testid={`evidence-${world.id}`}>
      <h4 className="text-sm font-bold">포트폴리오 대신: {plan.total}</h4>
      <p className="mt-1 text-cap text-muted">이 시험은 작업물을 보지 않아요. 분량 {plan.amount}(가정값). 기록은 이 기기에만 남아요.</p>
      <div className="mt-2 rounded-lg border border-hair p-3">
        <label className="block text-sm">
          본 날짜
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3" />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {plan.subjects.map((s) => (
            <label key={s.id} className="text-sm">
              {s.name}
              <input type="number" inputMode="numeric" min={0} max={100} value={draft[s.id] ?? ""} onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-hair px-3" />
            </label>
          ))}
        </div>
        <button type="button" onClick={add} className="mt-2 min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-surface">
          점수 저장
        </button>
      </div>
      {mocks.length ? <p className="mt-2 text-sm">저장한 모의고사 {mocks.length}회</p> : <p className="mt-2 text-cap text-muted">점수를 넣으면 약점 과목을 평균이 낮은 순으로 보여 드려요.</p>}
      {weak.length ? (
        <ul className="mt-2 flex flex-col gap-2" data-testid={`weak-${world.id}`}>
          {weak.map((s) => (
            <li key={s.id} className="rounded-lg bg-ground p-3">
              <p className="text-sm font-medium">
                약점: {s.name} 평균 {Math.round(s.avg ?? 0)}점({s.n}회)
              </p>
              <label className="mt-1 block text-sm">
                다음 모의고사까지 할 일
                <input type="text" maxLength={120} value={saved.weakPlans?.[s.id] ?? ""} onChange={(e) => update({ ...saved, weakPlans: { ...saved.weakPlans, [s.id]: e.target.value } })} className="mt-1 min-h-11 w-full rounded-lg border border-hair bg-surface px-3" />
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PortfolioSection({ req, profile, world, gaps }: { req: Requirements; profile: Profile; world: WorldTemplate; gaps: GapItem[] }) {
  const plan = buildEvidence(req, world, gaps);
  const [stored, update] = useSaved(world.id);
  // 프롬프트 판이나 프로필이 바뀌면 예전 제안은 안 쓴다(고른 주제와 체크는 그대로).
  const key = topicKey(profileHash(profile));
  const saved = stored.suggestionsKey === key ? stored : { ...stored, suggestions: undefined, ruleCards: undefined };
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ask = async () => {
    setBusy(true);
    setFailed(false);
    try {
      // 이야기 원문과 근거 인용은 보내지 않는다(핵심 가치 이름만).
      const res = await fetch("/api/evidence/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          world: world.id,
          family: majorFamily(profile.major),
          cards: plan.cards.filter((c) => !c.noTopic).map((c) => c.id),
          person: { major: profile.major, interests: topInterests(profile.interests), experiences: profile.experiences, values: profile.values, coreValues: profile.story?.coreValues?.map((c) => c.value) ?? [] },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { topics: EvidenceSaved["suggestions"]; ruleCards: string[] };
      update({ ...saved, suggestions: data.topics, ruleCards: data.ruleCards, suggestionsKey: key });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-5" data-testid={`evidence-${world.id}`}>
      <h4 className="text-sm font-bold">증거물: 내가 이 일을 할 줄 안다는 것</h4>
      <p className="mt-1 text-cap text-muted">
        이 진로의 형태: {plan.total}(가정값). {plan.basis ?? "NCS에 맞는 직무가 없어 공식 완성 기준이 없어요."} 일정의 경험·작업물 시간 안에서 만들어요. 고른 주제와 체크는 이 기기에만 남아요.
      </p>
      <button type="button" disabled={busy} onClick={ask} className="mt-2 min-h-11 rounded-full border border-hair bg-surface px-4 text-sm font-medium disabled:opacity-60">
        {busy ? "주제를 찾는 중이에요…" : saved.suggestions ? "주제 다시 제안받기" : "내게 맞는 주제 제안받기"}
      </button>
      {failed ? (
        <p className="mt-1 text-cap" role="status">
          제안을 받지 못했어요. 직접 쓰거나 다시 눌러 주세요.
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {plan.cards.map((c) => (
          <Card key={c.id} card={c} saved={saved} update={update} />
        ))}
      </ul>
    </div>
  );
}

export function EvidenceSection({ req, profile, world, gaps }: { req: Requirements; profile: Profile; world: WorldTemplate; gaps: GapItem[] }) {
  if (isExamWorld(world)) return <ExamSection plan={buildExamPlan(req)} world={world} />;
  return <PortfolioSection req={req} profile={profile} world={world} gaps={gaps} />;
}

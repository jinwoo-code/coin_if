"use client";
// 리포트 '필요한 것과 내 격차'. 목록은 서버의 저장 파일, 판정·점수는 이 기기에서(프로필을 안 보낸다).
import { useEffect, useState } from "react";
import { computeGapDeltas } from "@/lib/levers-client";
import { gapItems, prioritize, SKILL_CHOICES, type GapItem, type PriorityRow, type SkillAnswers } from "@/lib/gap";
import { ScheduleSection } from "@/components/schedule";
import { store } from "@/lib/store";
import { majorFamily } from "@/lib/job-codes";
import type { Requirements } from "@/lib/requirements";
import type { Profile, WorldTemplate } from "@/lib/types";

const SHOW = 8;
const STATUS = { have: "있음", partial: "부분적", none: "없음" } as const;
const KIND = { skill: "능력", cert: "자격", experience: "경험", exam: "시험 과목", step: "절차" } as const;
const GRADE = { official: "공식", curated: "공식 문서 정리", interview: "현직자", assumed: "가정값" } as const;

function Source({ g }: { g: GapItem }) {
  const i = g.item;
  return (
    <p className="mt-1 text-cap text-muted">
      {KIND[i.kind]} · {GRADE[i.grade]}
      {i.ref ? ` · ${i.ref}` : ""}
      {i.refUrl ? (
        <>
          {" · "}
          <a className="underline" href={i.refUrl} target="_blank" rel="noreferrer">
            출처
          </a>
        </>
      ) : null}
      {i.officialUrl ? (
        <>
          {" · "}
          <a className="underline" href={i.officialUrl} target="_blank" rel="noreferrer">
            공식 사이트
          </a>
        </>
      ) : null}
    </p>
  );
}

function Row({ r, rank }: { r: PriorityRow; rank: number }) {
  return (
    <li className="rounded-xl border border-hair p-3">
      <p className="text-sm font-semibold">
        {rank}. {r.title}
        <span className="ml-1.5 text-cap font-normal text-muted">{STATUS[r.status]}</span>
      </p>
      {r.members.length > 1 ? <p className="mt-1 text-cap">{r.members.map((m) => m.item.name).join(", ")}</p> : r.item.detail ? <p className="mt-1 text-cap">{r.item.detail}</p> : null}
      <p className="mt-1 text-sm">{r.evidence.join(" · ")}</p>
      <p className="mt-1 text-cap text-muted">{r.basis}</p>
      <Source g={r} />
    </li>
  );
}

export function GapSection({ profile, world, months, startYm }: { profile: Profile; world: WorldTemplate; months: number; startYm: string }) {
  const [req, setReq] = useState<Requirements | null>(null);
  const [deltas, setDeltas] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const [answers, setAnswers] = useState<SkillAnswers>({});
  useEffect(() => setAnswers(store.getGapAnswers()[world.id] ?? {}), [world.id]);
  const answer = (groupId: string, v: number) => {
    const next = { ...answers, [groupId]: v };
    setAnswers(next);
    store.setGapAnswers({ ...store.getGapAnswers(), [world.id]: next });
  };

  useEffect(() => {
    let live = true;
    const family = majorFamily(profile.major);
    fetch(`/api/requirements?world=${encodeURIComponent(world.id)}${family ? `&family=${encodeURIComponent(family)}` : ""}`)
      .then((r) => (r.ok ? (r.json() as Promise<Requirements>) : Promise.reject(new Error(String(r.status)))))
      .then((r) => {
        if (!live) return;
        setReq(r);
        return computeGapDeltas(profile, world.id, months, startYm, gapItems(r, profile, world)).then((d) => {
          if (live) setDeltas(d);
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [profile, world, months, startYm]);

  if (failed && !req) return <p className="text-sm text-muted">필요한 것 목록을 불러오지 못했어요.</p>;
  if (!req) return <p className="text-sm text-muted">필요한 것 목록을 불러오는 중이에요…</p>;

  const gaps = gapItems(req, profile, world, answers);
  const have = gaps.filter((g) => g.status === "have");
  const rows = prioritize(gaps, world, profile, deltas ?? {});
  const steps = gaps.filter((g) => g.item.kind === "step");
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <div data-testid={`gap-${world.id}`}>
      <h3 className="text-lg font-bold">{world.name}: 필요한 것과 내 격차</h3>
      <p className="mt-1 text-sm">
        필요한 것 {gaps.length}개 중 있음 {have.length} · 부분적 {gaps.filter((g) => g.status === "partial").length} · 없음 {gaps.filter((g) => g.status === "none").length}
      </p>
      {req.notes?.map((n) => (
        <p key={n} className="mt-2 rounded-lg bg-ground p-2 text-cap">
          {n}
        </p>
      ))}

      {req.skillGroups?.length ? (
        <div className="mt-3 rounded-lg border border-hair p-3" data-testid={`skills-${world.id}`}>
          <p className="text-sm font-medium">이 능력은 어느 정도예요?</p>
          <p className="mt-0.5 text-cap text-muted">답하면 격차가 더 정확해져요. 안 답하면 준비도 답으로 추정해요. 이 기기에만 저장돼요.</p>
          <div className="mt-2 flex flex-col gap-2">
            {req.skillGroups.map((g) => (
              <fieldset key={g.id}>
                <legend className="text-sm">{g.name}</legend>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {SKILL_CHOICES.map((c) => (
                    <button
                      key={c.v}
                      type="button"
                      aria-pressed={answers[g.id] === c.v}
                      onClick={() => answer(g.id, c.v)}
                      className={`min-h-11 rounded-full border px-3 text-sm ${answers[g.id] === c.v ? "border-ink bg-ink text-white" : "border-hair bg-surface"}`}
                    >
                      {c.t}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      ) : null}

      <h4 className="mt-4 text-sm font-bold">이미 가진 것</h4>
      {have.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {have.map((g) => (
            <li key={g.item.id}>
              {g.item.name} <span className="text-cap text-muted">({g.basis})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">입력한 정보로는 아직 확인된 게 없어요. 물어보지 않은 것도 있으니 아래 근거를 봐 주세요.</p>
      )}

      <h4 className="mt-4 text-sm font-bold">먼저 할 것</h4>
      {deltas === null && !failed ? <p className="mt-1 text-cap text-muted">시뮬레이션 효과를 계산하는 중이에요. 휴대폰에서는 시간이 걸릴 수 있어요.</p> : null}
      <ol className="mt-2 flex flex-col gap-2">
        {shown.map((r, i) => (
          <Row key={r.item.id} r={r} rank={i + 1} />
        ))}
      </ol>
      {rows.length > SHOW ? (
        <button type="button" className="mt-2 min-h-11 text-sm font-medium underline" onClick={() => setAll((v) => !v)}>
          {all ? "접기" : `${rows.length - SHOW}개 더 보기`}
        </button>
      ) : null}
      {steps.length ? (
        <>
          <h4 className="mt-4 text-sm font-bold">확인할 절차</h4>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {steps.map((g) => (
              <li key={g.item.id}>
                {g.item.name}
                {g.item.detail ? <span className="text-cap text-muted"> ({g.item.detail})</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ScheduleSection rows={rows} profile={profile} world={world} months={months} startYm={startYm} />

      <p className="mt-3 text-cap text-muted">
        시뮬레이션 수치는 그 항목을 갖췄다고 가정하고 200번 다시 돌린 차이예요(시뮬레이션 가정 기준). 시간과 순서를 정하는 가중치는 가정값이에요. 기준일 {req.baseDate}. 이 목록은 준비 계획이고 합격·취업을 보장하지 않아요. 시험 일정은 공식
        사이트에서 확인해 주세요.
      </p>
    </div>
  );
}

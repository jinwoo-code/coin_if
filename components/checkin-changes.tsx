"use client";
// 체크인 전후로 바뀐 것을 한 화면에: 성격 다시 재기, 고친 선택 반영, 그 값으로 다시 살아 본 결과.
// '전'은 고친 선택과 이번 체크인을 넣기 전 값이다. 지도·리포트는 다시 살아 볼 때 바뀌고, 여기 숫자는 이 비교용으로만 잰다.
import { useEffect, useMemo, useState } from "react";
import { Ci } from "@/components/ui";
import { durationLabel } from "@/lib/calendar";
import { times } from "@/lib/ci";
import { T } from "@/lib/copy";
import { toneProbs } from "@/lib/engine";
import { computeCheckinRerun } from "@/lib/levers-client";
import { bigFiveDiff, TONE_WORD, withNewBigFive } from "@/lib/ongoing";
import type { CheckinRerun } from "@/lib/plan-sim";
import { store } from "@/lib/store";
import { CALM } from "@/lib/twin";
import type { Checkin, Profile, Tone } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const TONES: Tone[] = ["push", "change", "safe"];

function Pair({ label, v, n }: { label: string; v: { before: number; after: number }; n: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-t border-hair py-2 first:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">
        {v.before}% → <strong className="font-extrabold">{v.after}%</strong> <Ci pct={v.after} n={n} />
      </dd>
    </div>
  );
}

export function CheckinChanges({ done, baseline, profile, onProfile }: { done: Checkin; baseline: Profile; profile: Profile; onProfile: (p: Profile) => void }) {
  const before = useMemo<Profile>(() => ({ ...baseline, corrections: [] }), [baseline]);
  const diff = done.mini ? bigFiveDiff(baseline, done.mini) : null;
  const [applied, setApplied] = useState(false);
  const selection = store.getSelection();
  const [runs, setRuns] = useState<Record<string, CheckinRerun> | null>(null);
  const [failed, setFailed] = useState(false);
  const worldIds = selection?.worldIds.join(",") ?? "";

  useEffect(() => {
    if (!selection) return;
    let live = true;
    setRuns(null);
    setFailed(false);
    Promise.all(selection.worldIds.map((id) => computeCheckinRerun(before, profile, id, selection.months, selection.startYm).then((r) => [id, r] as const)))
      .then((list) => {
        if (live) setRuns(Object.fromEntries(list));
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // selection은 그릴 때마다 새로 읽으므로 값으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [before, profile, worldIds, selection?.months, selection?.startYm]);

  const probsOf = (p: Profile) => toneProbs(p, CALM, TONES);
  const was = probsOf(before);
  const now = probsOf(profile);

  return (
    <section className="mt-4" aria-labelledby="checkin-changes" data-testid="checkin-changes">
      <h2 id="checkin-changes" className="text-lg font-bold">
        체크인 전후로 바뀐 것
      </h2>

      <section className="card mt-3 p-5" data-testid="change-personality">
        <p className="label">1. 성격 다시 재기</p>
        {diff ? (
          <>
            <ul className="num mt-3 flex flex-col gap-1.5 text-sm">
              {diff.map((d) => (
                <li key={d.key} className="flex justify-between gap-2">
                  <span>{d.label}</span>
                  <span>
                    {d.before.toFixed(1)} → {d.after.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">성격은 한 달 만에 크게 안 바뀌어요. 달라 보여도 그날 기분이나 문항이 적어서일 수 있어요. 그래서 자동으로 바꾸지 않아요.</p>
            {applied ? (
              <p role="status" className="mt-3 text-sm font-semibold">
                바꿨어요. 아래 숫자에 들어갔어요.
              </p>
            ) : (
              <button
                type="button"
                className="btn-ghost mt-3 w-full"
                onClick={() => {
                  const next = withNewBigFive(profile, done.mini!);
                  store.setProfile(next);
                  onProfile(next);
                  setApplied(true);
                }}
              >
                이 차이만큼 내 성격 값 바꾸기
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">이번에는 성격 문항을 건너뛰어서 그대로예요.</p>
        )}
      </section>

      <section className="card mt-3 p-5" data-testid="change-corrections">
        <p className="label">2. 고친 선택 반영</p>
        {profile.corrections.length ? (
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {profile.corrections.map((c) => (
              <li key={c.eventId}>
                <span className="font-semibold">{c.title}</span>
                <span className="text-muted"> → {TONE_WORD[c.to]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">고친 선택이 없어요.</p>
        )}
        <p className="mt-3 text-sm font-semibold">평소 상태에서 분신이 고를 확률</p>
        <ul className="num mt-1.5 flex flex-col gap-1 text-sm">
          {TONES.map((t, i) => (
            <li key={t} className="flex justify-between gap-2">
              <span>{TONE_WORD[t]}</span>
              <span>
                {Math.round(was[i] * 100)}% → <strong>{Math.round(now[i] * 100)}%</strong>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-cap text-muted">고친 선택 하나의 무게는 {T.assumedFull}이에요. 그 사건만이 아니라 모든 갈림길의 성향에 조금씩 퍼져요.</p>
      </section>

      <section className="card mt-3 p-5" data-testid="change-rerun">
        <p className="label">3. 다시 살아 보기</p>
        {!selection ? (
          <p className="mt-2 text-sm text-muted">진로를 고른 뒤에 비교할 수 있어요.</p>
        ) : failed ? (
          <p className="mt-2 text-sm text-muted">계산하지 못했어요. 다시 열어 주세요.</p>
        ) : !runs ? (
          <p role="status" className="mt-2 text-sm text-muted">
            {selection.worldIds.length}개 진로를 전후로 {times(1000)}번씩 다시 사는 중이에요…
          </p>
        ) : (
          <>
            {selection.worldIds.map((id) => {
              const r = runs[id];
              return (
                <div key={id} className="mt-3" data-testid={`rerun-${id}`}>
                  <p className="text-sm font-bold">
                    {getWorld(id).short} <span className="font-normal text-muted">· {durationLabel(r.months)}</span>
                  </p>
                  <dl className="num mt-1 text-sm">
                    <Pair label={`${r.label}`} v={r.gate} n={r.n} />
                    <Pair label="만족하며 끝난 비율" v={r.satisfied} n={r.n} />
                    <Pair label="스트레스 높게 끝남" v={r.stressed} n={r.n} />
                  </dl>
                </div>
              );
            })}
            <p className="mt-3 text-cap text-muted">왼쪽은 고친 선택과 이번 체크인을 넣기 전, 오른쪽은 지금 값이에요. 같은 시드로 AI 판단 없이 규칙 계산만 비교해서 지도 숫자와 다를 수 있어요. 오차 범위 안의 차이는 우연일 수 있어요.</p>
          </>
        )}
      </section>
    </section>
  );
}

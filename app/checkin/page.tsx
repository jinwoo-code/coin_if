"use client";
// 한 달 체크인(계속 닮아 가기). 채점용 상황 질문을 다시 물어 '나도 내 답을 얼마나 되풀이하는지'(기준선)를 재고,
// 지난 한 달 실제로 한 선택을 받아 분신에 반영한다(lib/ongoing.ts). 시연에서는 한 달을 기다리지 않고 '시연용'으로 할 수 있다.
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoiceItem, ScaleEnds, ScaleRow } from "@/components/scale";
import { CheckinMail } from "@/components/checkin-mail";
import { FLAGS } from "@/lib/flags";
import { Screen } from "@/components/ui";
import { MINI_ITEMS } from "@/lib/mini-ipip";
import { bigFiveDiff, daysToCheckin, selfAgreement, TONE_WORD, withCorrection, withNewBigFive } from "@/lib/ongoing";
import { store } from "@/lib/store";
import { SJT } from "@/lib/tests";
import { twinScore } from "@/lib/twin";
import type { Checkin, Profile, Tone } from "@/lib/types";
import { isDemoPerson } from "@/lib/demo";

const REAL: { v: Tone | "none"; t: string }[] = [
  { v: "push", t: "하던 걸 더 밀어붙였어요" },
  { v: "change", t: "방향을 바꾸거나 다른 길을 알아봤어요" },
  { v: "safe", t: "쉬거나 신중하게 미뤘어요" },
  { v: "none", t: "특별히 고른 게 없었어요" },
];

export default function CheckinPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [real, setReal] = useState<Tone | "none" | null>(null);
  const [done, setDone] = useState<Checkin | null>(null);
  const [askMini, setAskMini] = useState(false);
  const [mini, setMini] = useState<Record<string, number>>({});
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const p = store.getProfile();
    if (!p) router.replace("/interview");
    else setProfile(p);
  }, [router]);

  if (!profile) return null;
  const items = SJT.filter((q) => profile.holdoutPicks[q.id] !== undefined);
  const days = daysToCheckin(profile);
  const due = days === null || days <= 0;
  const miniLeft = askMini ? MINI_ITEMS.filter((i) => mini[i.id] === undefined).length : 0;
  const ready = items.every((q) => picks[q.id] !== undefined) && real !== null && !miniLeft;

  function save() {
    if (!profile || !ready || real === null) return;
    const c: Checkin = { at: new Date().toISOString(), picks, real, demo: !due, ...(askMini ? { mini } : {}) };
    let next: Profile = { ...profile, checkins: [...profile.checkins, c] };
    if (real !== "none") next = withCorrection(next, { source: "checkin", eventId: `checkin:${c.at.slice(0, 10)}`, title: "한 달 체크인: 실제로 한 선택", from: null, to: real });
    store.setProfile(next);
    setProfile(next);
    setDone(c);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!items.length)
    return (
      <Screen title="한 달 체크인" back="/me">
        <p className="mt-4 text-sm">검사에서 상황 질문에 답한 뒤에 할 수 있어요.</p>
      </Screen>
    );

  if (done) {
    const self = selfAgreement(profile, done);
    const twin = twinScore(profile);
    const diff = done.mini ? bigFiveDiff(profile, done.mini) : null;
    return (
      <Screen
        title="한 달 체크인"
        back="/me"
        footer={
          <Link href="/choose" className="btn-primary flex w-full items-center justify-center">
            진로 고르기로
          </Link>
        }
      >
        <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-[#E7F6EF] px-4 py-3 text-sm text-[#0B6B4B]">
          <Check aria-hidden="true" size={16} /> 저장했어요{done.demo ? " (시연용)" : ""}.
        </p>
        <section className="card mt-4 p-5">
          <p className="label">닮은 정도, 기준과 같이 보기</p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-cap text-muted">나도 처음 답과 같게</dt>
              <dd className="num text-lg font-bold">
                {self.n}개 중 {self.same}개
              </dd>
            </div>
            <div>
              <dt className="text-cap text-muted">분신이 처음 답을 맞힘</dt>
              <dd className="num text-lg font-bold">{twin ? `${twin.n}개 중 ${twin.hits}개` : "-"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm">사람도 같은 질문에 늘 같은 답을 하지는 않아요. 그래서 분신 점수는 '내가 나를 맞힌 정도'와 같이 봐야 해요.</p>
          {done.real !== "none" ? <p className="mt-2 text-sm">지난 한 달 실제로 {TONE_WORD[done.real]}을 골랐어요. 다음에 살아볼 때부터 분신도 그쪽으로 조금 더 기울어요.</p> : null}
          <p className="mt-2 text-cap text-muted">문항이 적어서 우연이 크게 섞여요. 체크인이 쌓일수록 믿을 만해져요.</p>
        </section>
        {diff ? (
          <section className="card mt-4 p-5" aria-label="성격 다시 재기">
            <p className="label">성격 20문항, 지난번과 비교</p>
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
                바꿨어요. 다음에 살아볼 때부터 반영돼요.
              </p>
            ) : (
              <button
                type="button"
                className="btn-ghost mt-3 w-full"
                onClick={() => {
                  const next = withNewBigFive(profile, done.mini!);
                  store.setProfile(next);
                  setProfile(next);
                  setApplied(true);
                }}
              >
                이 차이만큼 내 성격 값 바꾸기
              </button>
            )}
          </section>
        ) : null}
        {FLAGS.checkinMail ? <CheckinMail /> : null}
        {profile.checkins.length > 1 ? (
          <section className="card mt-4 p-5">
            <p className="label">지난 체크인</p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {profile.checkins.map((c) => {
                const s = selfAgreement(profile, c);
                return (
                  <li key={c.at} className="flex justify-between gap-2">
                    <span className="num">
                      {c.at.slice(0, 10)}
                      {c.demo ? " (시연용)" : ""}
                    </span>
                    <span className="num text-muted">
                      나 {s.same}/{s.n}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </Screen>
    );
  }

  if (!due && !demo)
    return (
      <Screen title="한 달 체크인" back="/me">
        <section className="card mt-4 p-5">
          <p className="text-base font-bold">
            다음 체크인까지 <span className="num">{days}</span>일 남았어요
          </p>
          <p className="mt-2 text-sm text-muted">한 달쯤 지나서 상황 질문 몇 개를 다시 묻고, 그동안 실제로 어떻게 했는지 물어요. 분신이 나를 얼마나 닮았는지 재는 기준이 돼요.</p>
          {isDemoPerson(profile) ? (
            <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setDemo(true)}>
              시연용: 지금 해 보기
            </button>
          ) : null}
        </section>
        {FLAGS.checkinMail ? <CheckinMail /> : null}
      </Screen>
    );

  return (
    <Screen
      title="한 달 체크인"
      back="/me"
      footer={
        <button className="btn-primary w-full" disabled={!ready} onClick={save}>
          {ready ? "저장" : `${items.filter((q) => picks[q.id] === undefined).length + (real === null ? 1 : 0) + miniLeft}문항 남았어요`}
        </button>
      }
    >
      {!due ? <p className="mt-3 rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm">시연용이에요. 한 달이 안 지나서 '나도 처음 답과 같게'가 실제보다 높게 나올 수 있어요.</p> : null}
      <p className="mt-3 text-sm text-muted">예전에 답한 질문도 있어요. 기억나는 답이 아니라 지금의 나라면 뭘 고를지 골라 주세요.</p>
      <ol className="mt-2">
        {items.map((q, i) => (
          <ChoiceItem key={q.id} id={`ci-${i + 1}`} n={i + 1} text={q.text} options={q.options.map((o) => o.text)} value={picks[q.id]} onPick={(v) => setPicks((cur) => ({ ...cur, [q.id]: v }))} />
        ))}
        <li className="border-b border-hair py-4 last:border-0">
          <p id="ci-real" className="text-base font-bold">
            <span className="num mr-1.5 text-muted">{items.length + 1}.</span>
            지난 한 달, 진로 고민에서 실제로 어떻게 했어요?
          </p>
          <div role="radiogroup" aria-labelledby="ci-real" className="mt-2.5 flex flex-col gap-1.5">
            {REAL.map((r) => (
              <button
                key={r.v}
                type="button"
                role="radio"
                aria-checked={real === r.v}
                onClick={() => setReal(r.v)}
                className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-left text-base transition-colors ${real === r.v ? "border-ink bg-ink text-white" : "border-hair bg-surface hover:border-ink"}`}
              >
                {r.t}
              </button>
            ))}
          </div>
        </li>
      </ol>
      {askMini ? (
        <section className="mt-6" aria-label="성격 20문항">
          <h2 className="text-base font-bold">성격 20문항</h2>
          <ScaleEnds />
          <ol>
            {MINI_ITEMS.map((item, i) => (
              <ScaleRow key={item.id} id={`ci-${item.id}`} n={i + 1} text={item.text} value={mini[item.id]} onPick={(v) => setMini((cur) => ({ ...cur, [item.id]: v }))} />
            ))}
          </ol>
          <button type="button" className="btn-ghost mt-2 w-full" onClick={() => setAskMini(false)}>
            성격 문항은 빼기
          </button>
        </section>
      ) : (
        <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setAskMini(true)}>
          성격 20문항도 다시 답하기(선택, 약 2분)
        </button>
      )}
    </Screen>
  );
}

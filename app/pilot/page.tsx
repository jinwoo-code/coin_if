"use client";
// 파일럿: 가중치 보정용 채점 전용 상황 질문(lib/pilot.ts). /interview?pilot=1로 들어온 기기에서만 연다.
// 앱 동의서와 따로 파일럿 동의를 받는다. 답은 holdoutPicks(p1~p20)에만, 성향 점수에는 안 쓴다.
// 로그인해야 계정에 올라가 분석에 들어간다(로그인 안 하면 이 기기에만 남음).
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoiceItem } from "@/components/scale";
import { Screen } from "@/components/ui";
import { isPilotId, PILOT_CONSENT, PILOT_SJT, PILOT_VERSION, pilotActive, withdrawPilot } from "@/lib/pilot";
import { store } from "@/lib/store";
import { fetchStatus } from "@/lib/sync";
import type { Profile } from "@/lib/types";
import { T } from "@/lib/copy";

const PER_PAGE = 4;

export default function PilotPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invited, setInvited] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pilot") === "1") store.setPilotInvited();
    const p = store.getProfile();
    if (!p) {
      router.replace("/interview?pilot=1");
      return;
    }
    setProfile(p);
    setInvited(store.isPilotInvited());
    setPicks(Object.fromEntries(Object.entries(p.holdoutPicks).filter(([id]) => isPilotId(id))));
    // 이어서 하기: 다 답한 쪽 다음부터
    const firstOpen = PILOT_SJT.findIndex((q) => p.holdoutPicks[q.id] === undefined);
    setPage(firstOpen < 0 ? Math.ceil(PILOT_SJT.length / PER_PAGE) : Math.floor(firstOpen / PER_PAGE));
    fetchStatus().then((s) => setLoggedIn(!!s.user));
  }, [router]);

  if (!profile) return null;

  function save(next: Profile) {
    store.setProfile(next);
    setProfile(next);
  }

  if (!invited) {
    return (
      <Screen title="파일럿" back="/choose">
        <p className="mt-4 text-sm text-muted">파일럿 참여 링크로 들어온 분만 볼 수 있어요.</p>
      </Screen>
    );
  }

  const pages = Math.ceil(PILOT_SJT.length / PER_PAGE);
  const withdrawn = !!profile.pilot?.withdrawnAt;
  const active = pilotActive(profile);
  const finished = active && page >= pages;

  // 동의 전(처음이거나, 빠졌다가 다시 들어온 경우)
  if (!active) {
    return (
      <Screen
        title="파일럿 참여 동의"
        back="/choose"
        footer={
          <div className="flex gap-2">
            <Link href="/choose" className="btn-ghost flex flex-1 items-center justify-center">
              참여 안 함
            </Link>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!PILOT_SJT.length}
              onClick={() => {
                save({ ...profile, pilot: { version: PILOT_VERSION, consentAt: new Date().toISOString(), withdrawnAt: null } });
                setPage(0);
              }}
            >
              동의하고 시작
            </button>
          </div>
        }
      >
        <p className="mt-3 text-sm text-muted">시뮬레이션이 &apos;나라면 어떻게 고를지&apos;를 정하는 무게는 지금 {T.assumedFull}이에요. 파일럿 참여자의 답으로 이 무게를 다시 재려고 해요. 앱 이용 동의와는 따로 받는 동의예요.</p>
        {withdrawn ? <p className="mt-3 rounded-xl bg-[#FFF4E5] px-3 py-2 text-cap text-[#7A4300]">파일럿에서 빠졌어요. 다시 참여하려면 아래에 동의해 주세요.</p> : null}
        <ol className="mt-4 flex flex-col gap-3">
          {PILOT_CONSENT.map((c, i) => (
            <li key={c.title} className="card p-4">
              <p className="text-base font-bold">
                <span className="num mr-1.5 text-muted">{i + 1}.</span>
                {c.title}
              </p>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-cap text-muted">
          상황 질문 {PILOT_SJT.length}개, 5분쯤 걸려요. 답은 성향 점수에 안 들어가서 내 시뮬레이션 결과는 바뀌지 않아요. {loggedIn === false ? "로그인해야 답이 분석에 들어가요. 로그인하지 않으면 이 기기에만 남아요." : null}
        </p>
        {loggedIn === false ? (
          <Link href="/login" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold underline underline-offset-2">
            로그인하기
          </Link>
        ) : null}
        {!PILOT_SJT.length ? <p className="mt-3 text-cap text-[#A3311A]">문항을 준비 중이에요.</p> : null}
        <p className="mt-2 text-cap text-muted">동의 판 {PILOT_VERSION}</p>
      </Screen>
    );
  }

  const withdraw = (
    <button
      type="button"
      className="mt-6 min-h-[44px] text-sm font-semibold text-[#A3311A] underline underline-offset-2"
      onClick={() => {
        save(withdrawPilot(profile));
        store.setPilotPending(null);
        setPicks({});
      }}
    >
      파일럿에서 빠지기(답 지우기)
    </button>
  );

  if (finished) {
    return (
      <Screen
        title="파일럿"
        back="/choose"
        footer={
          <Link href="/choose" className="btn-primary flex w-full items-center justify-center">
            진로 고르기로
          </Link>
        }
      >
        <div className="card mt-4 p-5">
          <p className="flex items-center gap-2 text-base font-bold">
            <Check aria-hidden="true" size={18} className="text-[#0B6B4B]" /> {PILOT_SJT.length}개 모두 답했어요. 고마워요.
          </p>
          <p className="mt-2 text-sm text-muted">{loggedIn ? "답은 계정에 저장됐고, 다른 참여자 답과 묶어서만 분석해요." : "로그인하지 않아서 답이 이 기기에만 있어요. 로그인하면 분석에 들어가요."}</p>
        </div>
        {withdraw}
      </Screen>
    );
  }

  const items = PILOT_SJT.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const complete = items.every((q) => picks[q.id] !== undefined);
  return (
    <Screen
      title="파일럿 상황 질문"
      back="/choose"
      footer={
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!complete}
          onClick={() => {
            // 쪽마다 저장(나갔다 와도 이어서)
            save({ ...profile, holdoutPicks: { ...profile.holdoutPicks, ...picks } });
            setPage(page + 1);
            window.scrollTo({ top: 0 });
          }}
        >
          {page + 1 < pages ? "다음" : "끝내기"}
        </button>
      }
    >
      <p className="num mt-3 text-cap text-muted">
        {page + 1}/{pages}쪽 · 나라면 실제로 어떻게 할지 골라 주세요. 정답은 없어요.
      </p>
      <ol className="mt-2">
        {items.map((q, i) => (
          <ChoiceItem key={q.id} id={`pilot-q-${page * PER_PAGE + i}`} n={page * PER_PAGE + i + 1} text={q.text} options={q.options.map((o) => o.text)} value={picks[q.id]} onPick={(v) => setPicks({ ...picks, [q.id]: v })} />
        ))}
      </ol>
      {withdraw}
    </Screen>
  );
}

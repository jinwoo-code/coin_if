"use client";
// 학교 초대코드. 계약 기간 안의 대학에 들어가면 토큰이 줄지 않는다(이용 기록은 남는다).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { FLAGS } from "@/lib/flags";

interface Org {
  name: string;
  until: string;
}

// 상담 선생님에게 내 요약 보여 주기. 본인이 켤 때만, 끄면 바로 안 보인다.
function CounselShare() {
  const [on, setOn] = useState<boolean | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/api/org/share", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOn(Boolean(d.on)))
      .catch(() => setErr(true));
  }, []);
  async function set(next: boolean) {
    setErr(false);
    const res = await fetch("/api/org/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: next }) }).catch(() => null);
    if (res?.ok) setOn(next);
    else setErr(true);
  }
  if (on === null && !err) return null;
  return (
    <div className="mt-4 border-t border-hair pt-4">
      <p className="text-sm font-semibold">상담 선생님에게 내 결과 보여 주기</p>
      <p className="mt-1 text-cap text-muted">켜면 이 학교 상담 선생님이 내 이름, 전공, 고민, 가치관, 체크인 횟수, 진로별 결과 요약, 바꿀 수 있는 것을 볼 수 있어요. 대화와 이야기 글은 안 보여요. 언제든 끌 수 있어요.</p>
      <button type="button" role="switch" aria-checked={Boolean(on)} className={`mt-2 w-full ${on ? "btn-secondary" : "btn-primary"}`} onClick={() => set(!on)}>
        {on ? "끄기" : "보여 주기 켜기"}
      </button>
      {err ? (
        <p role="alert" className="mt-2 text-sm">
          지금은 바꾸지 못했어요.
        </p>
      ) : null}
    </div>
  );
}

export default function OrgPage() {
  const [state, setState] = useState<{ loggedIn: boolean; org: Org | null } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    fetch("/api/tokens", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState({ loggedIn: d.loggedIn, org: d.org ?? null }))
      .catch(() => setState(null));
  useEffect(() => {
    load();
  }, []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/org/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      window.dispatchEvent(new Event("cr:tokens"));
      await load();
    } catch (e) {
      setErr((e as Error).message || "가입하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="학교 초대코드" back="/tokens">
      {!state ? (
        <p className="mt-4 text-muted">불러오는 중…</p>
      ) : !state.loggedIn ? (
        <section className="card mt-4 p-5">
          <p className="font-semibold">로그인하면 학교 초대코드를 넣을 수 있어요.</p>
          <Link href="/login" className="btn-primary mt-4 w-full">
            로그인
          </Link>
        </section>
      ) : state.org ? (
        <section className="card mt-4 p-5">
          <p className="label">{state.org.name}</p>
          <p className="mt-1 text-2xl font-extrabold">무제한 이용 중</p>
          <p className="mt-1 text-sm text-muted">{state.org.until}까지 토큰이 줄지 않아요.</p>
          <p className="mt-3 text-cap text-muted">학교에는 학생 개인 결과가 아니라 5명 이상 모인 항목의 합계만 보여요.</p>
          {FLAGS.counselor ? <CounselShare /> : null}
        </section>
      ) : (
        <form className="card mt-4 p-5" onSubmit={join}>
          <label htmlFor="code" className="font-semibold">
            학교에서 받은 초대코드
          </label>
          <input id="code" className="field mt-2 uppercase" autoComplete="off" autoCapitalize="characters" placeholder="예: GTEC-DEMO" value={code} onChange={(e) => setCode(e.target.value)} />
          <p className="mt-2 text-cap text-muted">학교에는 학생 개인 결과가 아니라 5명 이상 모인 항목의 합계만 보여요.</p>
          {err ? (
            <p role="alert" className="mt-3 rounded-2xl bg-[#FDECEC] p-3 text-sm">
              {err}
            </p>
          ) : null}
          <button className="btn-primary mt-4 w-full" disabled={busy || !code.trim()}>
            {busy ? "확인하는 중…" : "학교 무제한 이용 시작"}
          </button>
        </form>
      )}
    </Screen>
  );
}

"use client";
// 학교 초대코드. 계약 기간 안의 대학에 들어가면 토큰이 줄지 않는다(이용 기록은 남는다).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";

interface Org {
  name: string;
  until: string;
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
        </section>
      ) : (
        <form className="card mt-4 p-5" onSubmit={join}>
          <label htmlFor="code" className="font-semibold">
            학교에서 받은 초대코드
          </label>
          <input
            id="code"
            className="field mt-2 uppercase"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="예: GTEC-DEMO"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
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

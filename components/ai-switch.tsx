"use client";
// 관리자에게만 보이는 '전체 목업 모드' 스위치(내 정보 화면). 심사·발표 현장에서 AI 한도·속도를 보고 고른다.
import { useEffect, useState } from "react";

type State = { canEdit: boolean; off?: boolean; ready?: boolean };

export function AiSwitch() {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-mode")
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ canEdit: false }));
  }, []);

  if (!s?.canEdit) return null;

  async function flip() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/ai-mode", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ off: !s!.off }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error ?? "바꾸지 못했어요.");
      else setS(j);
    } catch {
      setErr("바꾸지 못했어요. 네트워크를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ai-switch" className="card mt-4 border-2 border-sun p-5">
      <h2 id="ai-switch" className="text-base font-bold">
        관리자: AI 모드
      </h2>
      <p className="mt-1 text-sm text-muted">
        지금 <strong className="text-ink">{s.off ? "목업 모드(AI 안 부름)" : "실제 AI 키 사용"}</strong>예요. 바꾸면 모든 사용자에게 10초 안에 적용돼요. 목업은 빠르고 한도를 안 쓰지만 AI 문장 대신 기본 문장이 나와요.
      </p>
      {!s.ready ? <p className="mt-2 text-sm text-[#A3311A]">0008(app_settings)을 SQL Editor에 적용해야 바꿀 수 있어요.</p> : null}
      <button type="button" className={`${s.off ? "btn-primary" : "btn-ghost"} mt-3 w-full`} disabled={busy || !s.ready} onClick={flip} aria-pressed={!!s.off}>
        {busy ? "바꾸는 중…" : s.off ? "실제 AI 키로 바꾸기" : "목업 모드로 바꾸기"}
      </button>
      {err ? (
        <p role="alert" className="mt-2 text-sm text-[#A3311A]">
          {err}
        </p>
      ) : null}
    </section>
  );
}

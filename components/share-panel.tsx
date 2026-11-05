"use client";
// 상담사에게 공유: 무엇이 들어가는지 먼저 보여 주고, 확인하면 PDF 또는 읽기 전용 링크(14일, 취소 가능).
import { useEffect, useRef, useState } from "react";
import { buildSharedReport } from "@/lib/shared-client";
import { SHARE_DAYS, type SharedReport } from "@/lib/shared-report";
import { store, type ShareLink } from "@/lib/store";
import type { Multiverse, Profile, Report, Selection } from "@/lib/types";

export function SharePanel({ open, onClose, profile, selection, report, mvs }: { open: boolean; onClose: () => void; profile: Profile; selection: Selection; report: Report; mvs: Record<string, Multiverse> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<SharedReport | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setMsg("");
      setData(null);
      setLinks(store.getShareLinks().filter((l) => new Date(l.expiresAt).getTime() > Date.now()));
      buildSharedReport(profile, selection, report, mvs)
        .then(setData)
        .catch(() => setMsg("공유본을 만들지 못했어요. 다시 열어 주세요."));
    }
    if (!open && d.open) d.close();
  }, [open, profile, selection, report, mvs]);

  const saveLinks = (next: ShareLink[]) => {
    setLinks(next);
    store.setShareLinks(next);
  };
  const makeLink = async () => {
    if (!data) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ report: data }) });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(e.error ?? "링크를 만들지 못했어요. PDF로 보내 주세요.");
        return;
      }
      const d = (await res.json()) as { token: string; ownerKey: string; expiresAt: string };
      saveLinks([{ token: d.token, ownerKey: d.ownerKey, expiresAt: d.expiresAt, url: `${location.origin}/s/${d.token}` }, ...links]);
    } catch {
      setMsg("링크를 만들지 못했어요. PDF로 보내 주세요.");
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (l: ShareLink) => {
    const res = await fetch("/api/share", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: l.token, ownerKey: l.ownerKey }) }).catch(() => null);
    if (res?.ok) {
      saveLinks(links.filter((x) => x.token !== l.token));
      setMsg("링크를 취소했어요. 이제 열리지 않아요.");
    } else setMsg("취소하지 못했어요. 다시 눌러 주세요.");
  };
  const pdf = () => {
    if (!data) return;
    sessionStorage.setItem("cr:sharePrint", JSON.stringify(data));
    window.open("/report/print", "_blank");
  };
  const copy = (l: ShareLink) => navigator.clipboard?.writeText(l.url).then(() => setMsg("링크를 복사했어요."), () => setMsg("복사하지 못했어요. 주소를 직접 골라 복사해 주세요."));

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="share-title" className="w-[min(560px,calc(100vw-32px))] rounded-card bg-surface p-5 text-ink backdrop:bg-black/40 sm:p-6" data-testid="share-panel">
      <h2 id="share-title" className="text-xl font-bold">
        상담사에게 공유하기
      </h2>
      <h3 className="mt-3 text-sm font-bold">공유본에 들어가는 것</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">
        <li>이름·전공, 맨 위에 &quot;AI로 만든 리포트입니다&quot; 표시</li>
        <li>진로별 부합도와 1,000번 결과</li>
        <li>필요한 것 상위 5개와 근거, 월별 일정, 증거물과 고른 주제</li>
        <li>계획 전후 도달률(돌려 본 진로만), WOOP, 이번 주 할 일</li>
      </ul>
      <h3 className="mt-3 text-sm font-bold">들어가지 않는 것</h3>
      <p className="mt-1 text-sm">인생 이야기 원문과 인용, 검사 문항별 답, 경험 글, 고민·제약 글</p>
      {!data && !msg ? <p className="mt-3 text-sm text-muted">공유본을 만드는 중이에요…</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!data} onClick={pdf} className="btn-ghost min-h-11 disabled:opacity-50">
          PDF 내려받기
        </button>
        <button type="button" disabled={!data || busy} onClick={makeLink} className="btn-primary min-h-11 disabled:opacity-50">
          {busy ? "만드는 중…" : `읽기 전용 링크 만들기(${SHARE_DAYS}일)`}
        </button>
      </div>
      <p className="mt-2 text-cap text-muted">PDF는 인쇄 창에서 &apos;PDF로 저장&apos;을 골라 주세요. 링크를 만들면 이 내용이 서버에 저장되고, 주소를 아는 사람은 로그인 없이 볼 수 있어요. {SHARE_DAYS}일 뒤 또는 취소하면 열리지 않아요.</p>
      {links.length ? (
        <ul className="mt-3 flex flex-col gap-2" data-testid="share-links">
          {links.map((l) => (
            <li key={l.token} className="rounded-lg border border-hair p-3 text-sm">
              <a className="break-all underline" href={l.url} target="_blank" rel="noreferrer">
                {l.url}
              </a>
              <p className="text-cap text-muted">{l.expiresAt.slice(0, 10)}까지</p>
              <div className="mt-1 flex gap-3">
                <button type="button" className="min-h-11 text-sm font-medium underline" onClick={() => copy(l)}>
                  복사
                </button>
                <button type="button" className="min-h-11 text-sm font-medium underline" onClick={() => revoke(l)}>
                  링크 취소
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? (
        <p className="mt-3 text-sm font-medium" role="status">
          {msg}
        </p>
      ) : null}
      <button type="button" className="btn-ghost mt-4 min-h-11 w-full" onClick={onClose}>
        닫기
      </button>
    </dialog>
  );
}

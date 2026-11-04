"use client";
// 체크인 때가 되면 메일 받기. 로그인한 사람이 직접 켰을 때만 보낸다(app/api/cron/checkin). 계정 메일로만, 끄면 바로 멈춘다.
import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import { fetchStatus } from "@/lib/sync";

export function CheckinMail() {
  const [email, setEmail] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(Boolean(store.getProfile()?.checkinMail));
    fetchStatus().then((s) => setEmail(s.user?.email ?? null));
  }, []);
  if (!email) return null;
  function toggle() {
    const p = store.getProfile();
    if (!p) return;
    store.setProfile({ ...p, checkinMail: !on });
    setOn(!on);
  }
  return (
    <section className="card mt-4 p-5">
      <p className="text-sm font-semibold">체크인 때가 되면 메일로 알려 주기</p>
      <p className="mt-1 text-cap text-muted">한 달마다 {email}로 한 통만 보내요. 진로 결과나 답 내용은 메일에 안 넣어요.</p>
      <button type="button" role="switch" aria-checked={on} className="btn-ghost mt-2 w-full" onClick={toggle}>
        {on ? "메일 끄기" : "메일 켜기"}
      </button>
    </section>
  );
}

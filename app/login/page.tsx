"use client";
// 로그인: 이메일 매직링크 또는 Google. 로그인 안 해도 앱은 다 쓸 수 있고, 로그인하면 결과가 계정에 남는다.
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { hasSupabase } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(new URLSearchParams(window.location.search).has("error")), []);

  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!sb || !email.trim()) return;
    setState("sending");
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setState(error ? "error" : "sent");
  }

  async function google() {
    await supabaseBrowser()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  return (
    <Screen title="로그인" back="/">
      <p className="mt-2 text-muted">로그인하면 살아본 결과가 계정에 남아서 다른 기기에서도 이어 볼 수 있어요. 로그인하지 않아도 모든 기능을 써 볼 수 있어요.</p>
      {!hasSupabase() ? (
        <p className="card mt-6 p-5 text-sm text-muted">아직 로그인 기능이 연결되지 않았어요(서버에 Supabase 설정이 필요해요).</p>
      ) : (
        <>
          {failed ? <p className="mt-6 rounded-2xl bg-[#FFF4E5] p-4 text-sm">로그인 링크가 만료됐거나 잘못됐어요. 다시 시도해 주세요.</p> : null}
          <button onClick={google} className="btn-ghost mt-6 w-full">
            Google로 계속하기
          </button>
          <div className="my-6 flex items-center gap-3 text-cap text-muted">
            <span className="h-px flex-1 bg-hair" />
            또는 이메일로
            <span className="h-px flex-1 bg-hair" />
          </div>
          {state === "sent" ? (
            <p className="card p-5">
              <b>{email}</b>로 로그인 링크를 보냈어요. 메일의 링크를 누르면 이어서 진행돼요.
            </p>
          ) : (
            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <label htmlFor="email" className="label">
                이메일
              </label>
              <input id="email" type="email" required autoComplete="email" className="field" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn-primary" disabled={state === "sending"}>
                {state === "sending" ? "보내는 중…" : "로그인 링크 받기"}
              </button>
              {state === "error" ? <p className="text-sm text-[#C2410C]">링크를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.</p> : null}
            </form>
          )}
        </>
      )}
    </Screen>
  );
}

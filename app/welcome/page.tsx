"use client";
// 첫 로그인: 개인정보 수집·이용 동의 → 이 기기의 결과를 계정으로 옮길지 묻기.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { COLLECTED } from "@/lib/consent";
import { store } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { fetchStatus, hasLocalResults, pushNow, restore, startAutoSync } from "@/lib/sync";


export default function Welcome() {
  const router = useRouter();
  const [step, setStep] = useState<"loading" | "consent" | "migrate">("loading");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchStatus().then((s) => {
      if (!s.user) return router.replace("/login");
      if (!s.consented) return setStep("consent");
      router.replace("/");
    });
  }, [router]);

  async function accept() {
    setBusy(true);
    const res = await fetch("/api/consent", { method: "POST" });
    setBusy(false);
    if (!res.ok) return alert("동의를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    if (hasLocalResults()) return setStep("migrate");
    await finish();
  }

  async function decline() {
    await supabaseBrowser()?.auth.signOut();
    router.replace("/");
  }

  // 계정 기록이 있으면 빈 기기에 내려받고, 자동 저장을 켠다.
  async function finish() {
    restore(await fetchStatus());
    startAutoSync();
    router.replace(store.getMultiverses() ? "/multiverse" : "/");
  }

  async function migrate(yes: boolean) {
    setBusy(true);
    if (yes) await pushNow();
    else store.setLocalOnly(true); // 이 기기에만 남기고 계정에는 올리지 않는다
    await finish();
  }

  if (step === "loading") return <Screen title="잠시만요">{null}</Screen>;

  if (step === "migrate")
    return (
      <Screen title="이 기기의 결과">
        <p className="mt-2 text-lg">로그인 전에 이 기기에서 살아본 결과가 있어요. 계정으로 옮길까요?</p>
        <p className="mt-2 text-sm text-muted">옮기지 않아도 이 기기에서는 그대로 볼 수 있어요. 다음에 새로 인터뷰하면 그때부터 계정에 저장돼요.</p>
        <div className="mt-8 flex flex-col gap-3">
          <button className="btn-primary" disabled={busy} onClick={() => migrate(true)}>
            계정으로 옮기기
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => migrate(false)}>
            옮기지 않기
          </button>
        </div>
      </Screen>
    );

  return (
    <Screen title="개인정보 수집·이용 동의">
      <p className="mt-2 text-muted">결과를 계정에 저장하려면 아래 정보를 모으는 데 동의가 필요해요.</p>
      <ul className="card mt-6 divide-y divide-hair">
        {COLLECTED.map((c) => (
          <li key={c.item} className="p-4">
            <p className="font-semibold">{c.item}</p>
            <p className="mt-1 text-sm text-muted">{c.why}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>보관 기간: 탈퇴할 때까지. 탈퇴하면 바로 지워요.</li>
        <li>AI 문장 생성을 위해 답변이 Google Gemini API(유료 등급, 학습에 쓰이지 않음)로 전송돼요.</li>
        <li>동의하지 않으면 로그인 없이 이 기기에서만 쓸 수 있어요.</li>
      </ul>
      <Link href="/privacy" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">
        개인정보 처리방침(초안) 전체 보기
      </Link>
      <label className="card mt-6 flex cursor-pointer items-center gap-3 p-4">
        <input type="checkbox" className="h-5 w-5 accent-[#14171F]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span className="font-semibold">위 내용을 읽었고 수집·이용에 동의해요(필수)</span>
      </label>
      <div className="mt-6 flex flex-col gap-3">
        <button className="btn-primary" disabled={!agree || busy} onClick={accept}>
          동의하고 계속하기
        </button>
        <button className="btn-ghost" disabled={busy} onClick={decline}>
          동의하지 않고 로그아웃
        </button>
      </div>
    </Screen>
  );
}

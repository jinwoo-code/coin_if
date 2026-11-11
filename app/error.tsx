"use client";
import Link from "next/link";
import { MascotFace } from "@/components/mascot";

// 화면에서 예상 못 한 오류가 나면 앱이 멈추지 않고 이 화면을 보여 준다.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center gap-4 px-5 text-center">
      <MascotFace mood="dizzy" size={96} />
      <h1 className="text-xl font-bold">앗, 갈래가 넘어졌어요</h1>
      <p className="text-sm text-muted">잠깐 문제가 생겼어요. 다시 해 보거나 처음으로 가 주세요.</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button type="button" onClick={reset} className="btn-ghost flex-1">
          다시 해 보기
        </button>
        <Link href="/" className="btn-primary flex-1">
          처음으로
        </Link>
      </div>
    </main>
  );
}

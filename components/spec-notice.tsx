"use client";
// 학교·졸업 시기를 안 적은 사람에게: 계산에 쓴 기본값(lib/profile.ts DEFAULT_SPEC)을 알려 주고 적으러 가게 한다.
// 계산은 바꾸지 않는다(중립 방식은 발표 뒤, CLAUDE.md 할 일).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Profile } from "@/lib/types";

export const specMissing = (p: Profile | null | undefined) => !!p && !p.depth.spec && !p.depth.resume;

export function SpecNotice({ onGo }: { onGo?: () => void }) {
  return (
    <section data-testid="spec-notice" className="rounded-2xl bg-[#FFF4E5] px-4 py-3 text-sm text-[#7A4300]">
      <p>학교·졸업 시기를 안 적어서 전문대 재학·1년 뒤 졸업 기준으로 계산했어요. 적으면 더 맞아져요.</p>
      {onGo ? (
        <button type="button" onClick={onGo} className="mt-1 inline-flex min-h-[44px] items-center gap-1 font-bold underline underline-offset-2">
          적으러 가기 <ChevronRight aria-hidden="true" size={16} />
        </button>
      ) : (
        <Link href="/interview?more=1" className="mt-1 inline-flex min-h-[44px] items-center gap-1 font-bold underline underline-offset-2">
          적으러 가기 <ChevronRight aria-hidden="true" size={16} />
        </Link>
      )}
    </section>
  );
}

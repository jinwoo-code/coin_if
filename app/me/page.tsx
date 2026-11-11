"use client";
// 내 정보: 진로 고르기에서 옮긴 부가 메뉴(체크인·파일럿·이야기·더 정확하게)와 지우기.
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AiSwitch } from "@/components/ai-switch";
import { MyData } from "@/components/my-data";
import { Screen } from "@/components/ui";
import { canDeepen } from "@/lib/assessment";
import { chaptersDone } from "@/lib/chapters";
import { isDemoPerson } from "@/lib/demo";
import { daysToCheckin } from "@/lib/ongoing";
import { PILOT_SJT, pilotAnswered } from "@/lib/pilot";
import { store } from "@/lib/store";
import type { Profile } from "@/lib/types";

function Item({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <Link href={href} className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-hair bg-surface px-4 py-2.5 text-sm hover:border-ink">
      <span>
        <strong className="font-semibold">{title}</strong>
        <span className="text-muted"> · {note}</span>
      </span>
      <ChevronRight aria-hidden="true" size={16} className="flex-none" />
    </Link>
  );
}

function checkinNote(p: Profile) {
  const d = daysToCheckin(p);
  if (d === null || d <= 0) return "지금 할 때예요";
  return isDemoPerson(p) ? `${d}일 뒤(시연용으로 지금도 돼요)` : `${d}일 뒤`;
}

export default function MePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const p = store.getProfile();
    if (!p) setProfile(null);
    else setProfile(p);
    setChecked(true);
  }, [router]);
  // 프로필이 없어도 관리자 스위치는 보여야 해서(발표 기기) 검사로 보내지 않고 안내만 한다.
  if (!checked) return null;
  if (!profile)
    return (
      <Screen title="내 정보" back="/">
        <p className="card mt-3 p-5 text-sm text-muted">아직 검사를 안 했어요. 첫 화면에서 시작해 주세요.</p>
        <AiSwitch />
      </Screen>
    );
  return (
    <Screen title="내 정보" back="/choose">
      <nav aria-label="내 정보 메뉴" className="mt-3 flex flex-col gap-3">
        {Object.keys(profile.holdoutPicks).length ? <Item href="/checkin" title="한 달 체크인" note={checkinNote(profile)} /> : null}
        {store.isPilotInvited() ? <Item href="/pilot" title="파일럿 상황 질문" note={profile.pilot?.withdrawnAt ? "빠짐" : `${pilotAnswered(profile)}/${PILOT_SJT.length}개`} /> : null}
        {profile.depthMode !== "quick" ? <Item href="/story" title="인생 이야기" note={`${chaptersDone(profile)}/6장, 정밀 단계`} /> : null}
        {canDeepen(profile) ? <Item href="/interview?more=1" title="더 정확하게 하기" note="성격 50문항, 흥미 검사(약 20~30분)" /> : null}
      </nav>
      <AiSwitch />
      <MyData />
    </Screen>
  );
}

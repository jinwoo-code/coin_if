"use client";
// 내 정보 지우기: "내 이야기 지우기"(원문과 뽑은 값 모두), "전체 지우기"(이 기기 + 로그인했으면 계정의 프로필·시뮬레이션·대화).
// 되돌릴 수 없어서 두 번 눌러야 지워진다(브라우저 확인 창은 쓰지 않는다).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { store } from "@/lib/store";
import type { Profile } from "@/lib/types";

export function MyData() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [armed, setArmed] = useState<"story" | "all" | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => setProfile(store.getProfile()), []);
  if (!profile) return null;
  const hasStory = profile.story !== null || Object.keys(profile.storyRaw).length > 0;

  function removeStory() {
    if (armed !== "story") return setArmed("story");
    const next = { ...profile!, story: null, storyRaw: {} };
    store.setProfile(next); // 로그인했으면 계정의 확인값(story)도 이걸로 덮인다
    setProfile(next);
    setArmed(null);
    setMsg("내 이야기를 지웠어요.");
  }

  async function removeAll() {
    if (armed !== "all") return setArmed("all");
    const res = await fetch("/api/sync", { method: "DELETE" }).catch(() => null);
    if (res && !res.ok && res.status !== 401) {
      setMsg("계정의 기록을 지우지 못했어요. 잠시 뒤 다시 눌러 주세요.");
      setArmed(null);
      return;
    }
    store.reset();
    router.push("/");
  }

  return (
    <section aria-labelledby="my-data" className="mt-8 border-t border-hair pt-5">
      <h2 id="my-data" className="label">
        내 정보
      </h2>
      <p className="mt-1 text-cap text-muted">검사 결과는 이 기기에 저장되고, 로그인하면 계정에도 저장돼요. 이야기 원문은 이 기기에만 있어요.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {hasStory ? (
          <button className="btn-ghost min-h-[44px] flex-1 text-sm" onClick={removeStory}>
            {armed === "story" ? "한 번 더 누르면 지워져요" : "내 이야기 지우기"}
          </button>
        ) : null}
        <button className="btn-ghost min-h-[44px] flex-1 text-sm text-[#A12828]" onClick={removeAll}>
          {armed === "all" ? "한 번 더 누르면 모두 지워져요" : "전체 지우기"}
        </button>
      </div>
      {armed === "all" ? <p className="mt-2 text-cap text-muted">이 기기의 검사·시뮬레이션 결과와, 로그인했으면 계정의 프로필·시뮬레이션·대화까지 지워요. 토큰·결제 기록은 남아요.</p> : null}
      {msg ? (
        <p role="status" className="mt-2 text-sm">
          {msg}
        </p>
      ) : null}
    </section>
  );
}

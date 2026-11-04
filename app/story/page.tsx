"use client";
// 정밀: 인생 이야기 6장 목록. 장마다 따로 하고, 멈췄다가 이어서 할 수 있다(lib/chapters.ts).
import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { chapterDone, chaptersDone, CHAPTERS, readTurns } from "@/lib/chapters";
import { store } from "@/lib/store";
import type { Profile } from "@/lib/types";

export default function StoryPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [redo, setRedo] = useState<string | null>(null);

  useEffect(() => {
    const p = store.getProfile();
    if (!p) router.replace("/interview");
    else setProfile(p);
  }, [router]);

  if (!profile) return null;
  const done = chaptersDone(profile);
  function restart(id: string) {
    if (!profile) return;
    const { [id]: _gone, ...rest } = profile.storyRaw;
    const next = { ...profile, storyRaw: rest };
    store.setProfile(next);
    setProfile(next);
    setRedo(null);
    router.push(`/story/${id}`);
  }
  return (
    <Screen
      title="인생 이야기"
      back="/choose"
      footer={
        <Link href="/choose" className="btn-ghost flex w-full items-center justify-center">
          진로 고르기로
        </Link>
      }
    >
      <p className="mt-3 text-sm text-muted">
        여섯 장으로 나눠 물어요. 한 장에 15~20분쯤 걸리고, 아무 장부터 해도 돼요. 쓴 글은 이 기기에만 저장되고, 장이 끝나면 &quot;이렇게 이해했어요, 맞나요?&quot;로 확인받은 값만 시뮬레이션에 들어가요.
      </p>
      <p className="num mt-3 text-sm font-semibold">{done}/6장 끝냄</p>
      <ol className="mt-2 flex flex-col gap-2">
        {CHAPTERS.map((c, i) => {
          const finished = chapterDone(profile, c.id);
          const started = !finished && readTurns(profile.storyRaw[c.id]).some((t) => t.a.trim() || t.skipped);
          return (
            <li key={c.id}>
              <Link href={`/story/${c.id}`} className="flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-hair bg-surface px-4 py-3 hover:border-ink">
                <span>
                  <span className="num mr-2 text-cap text-muted">{i + 1}장</span>
                  <strong className="font-semibold">{c.title}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-cap text-muted">
                  {finished ? (
                    <>
                      <Check aria-hidden="true" size={14} className="text-[#0B6B4B]" /> 끝냄
                    </>
                  ) : started ? (
                    "이어서 하기"
                  ) : (
                    "시작"
                  )}
                  <ChevronRight aria-hidden="true" size={16} />
                </span>
              </Link>
              {finished ? (
                redo === c.id ? (
                  <div className="mt-1 rounded-2xl border border-hair bg-surface p-3">
                    <p className="text-sm">이 장에 쓴 글을 지우고 처음부터 다시 해요. 이미 확인한 값은 다시 확인할 때까지 남아 있고, 같은 칸이면 새 값으로 바뀌어요.</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn-primary flex-1" onClick={() => restart(c.id)}>
                        지우고 다시 하기
                      </button>
                      <button type="button" className="btn-ghost flex-1" onClick={() => setRedo(null)}>
                        그대로 두기
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="mt-1 min-h-[44px] px-2 text-cap font-semibold text-muted underline underline-offset-2" onClick={() => setRedo(c.id)}>
                    {c.title} 다시 하기
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}

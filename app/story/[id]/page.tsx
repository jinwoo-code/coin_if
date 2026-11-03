"use client";
// 인생 이야기 한 장: 시작 질문 → (답이 충분하면) AI 꼬리 질문 최대 2개 → 다음 시작 질문 → '맞나요?' 확인.
// 답할 때마다 이 기기에 저장한다(storyRaw, 계정 동기화에서 빠짐). 질문마다 '넘어가기'.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Ai, Me } from "@/components/chat";
import { Screen, Typing } from "@/components/ui";
import { answered, CHAPTERS, followsSinceStart, nextStart, readTurns, writeTurns, type Turn } from "@/lib/chapters";
import { hasCrisis } from "@/lib/crisis";
import { store } from "@/lib/store";
import { mergeSignals, type StorySignals } from "@/lib/story";
import type { Profile } from "@/lib/types";
import { CrisisNote, StoryConfirm } from "../../interview/story";

export default function ChapterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const ch = CHAPTERS.find((c) => c.id === params.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = store.getProfile();
    if (!p || !ch) {
      router.replace(p ? "/story" : "/interview");
      return;
    }
    setProfile(p);
    const saved = readTurns(p.storyRaw[ch.id]);
    // 처음이거나, 마지막 질문에 답한 뒤 나갔으면 다음 시작 질문을 붙인다
    const last = saved.at(-1);
    if (!last || last.a.trim() || last.skipped) {
      const q = nextStart(ch.id, saved);
      if (q) saved.push({ q, a: "", follow: false, skipped: false });
      else if (p.storyRaw[ch.id]?.done !== "1") setConfirming(true);
    }
    setTurns(saved);
    setCrisis(hasCrisis(saved.map((t) => t.a).join(" ")));
  }, [ch, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, waiting, confirming]);

  if (!profile || !ch) return null;
  const done = profile.storyRaw[ch.id]?.done === "1";
  const pending = turns.at(-1) && !turns.at(-1)!.a.trim() && !turns.at(-1)!.skipped ? turns.at(-1)! : null;

  // 저장: 원문은 이 기기에만
  function persist(next: Turn[], finished = false, story?: StorySignals) {
    const p = store.getProfile() ?? profile!;
    const updated: Profile = { ...p, storyRaw: { ...p.storyRaw, [ch!.id]: writeTurns(next, finished) }, ...(story ? { story: mergeSignals(p.story, story) } : {}) };
    store.setProfile(updated);
    setProfile(updated);
  }

  async function reply(skip: boolean) {
    if (!pending || waiting) return;
    const a = skip ? "" : draft.trim();
    if (!skip && !a) return;
    const filled = [...turns.slice(0, -1), { ...pending, a, skipped: skip }];
    setDraft("");
    setTurns(filled);
    persist(filled);
    if (!skip && hasCrisis(a)) setCrisis(true);

    // 꼬리 질문: 넘어가지 않았고, 이 스레드에서 아직 2개 미만일 때만
    let follow: string | null = null;
    if (!skip) {
      setWaiting(true);
      const start = filled.map((t) => !t.follow).lastIndexOf(true);
      const thread = filled
        .slice(start)
        .filter(answered)
        .map((t) => ({ q: t.q, a: t.a }));
      try {
        const r = await fetch("/api/story/followup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapter: ch!.id, thread, follows: followsSinceStart(filled) }) }).then((x) => x.json());
        follow = typeof r.q === "string" ? r.q : null;
        if (r.crisis) setCrisis(true);
      } catch {
        follow = null;
      }
      setWaiting(false);
    }
    const q = follow ?? nextStart(ch!.id, filled);
    if (q) {
      const next = [...filled, { q, a: "", follow: Boolean(follow), skipped: false }];
      setTurns(next);
      persist(next);
    } else setConfirming(true);
  }

  function finish(s: StorySignals | null) {
    const kept = turns.filter((t) => t.a.trim() || t.skipped);
    persist(kept, true, s ?? undefined);
    router.push("/story");
  }

  const qa = turns.filter(answered).map((t) => ({ q: t.q, a: t.a }));
  return (
    <Screen
      title={`${CHAPTERS.indexOf(ch) + 1}장 · ${ch.title}`}
      back="/story"
      footer={
        pending && !confirming ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="story-answer" className="sr-only">
              답
            </label>
            <textarea
              id="story-answer"
              rows={3}
              autoComplete="off"
              className="field min-h-[88px] resize-y rounded-2xl py-3"
              placeholder="생각나는 대로 써 주세요"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={waiting}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => reply(true)} disabled={waiting}>
                넘어가기
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => reply(false)} disabled={waiting || !draft.trim()}>
                보내기
              </button>
            </div>
          </div>
        ) : done ? (
          <Link href="/story" className="btn-primary flex w-full items-center justify-center">
            장 목록으로
          </Link>
        ) : null
      }
    >
      <div className="mt-3 flex flex-col gap-3">
        <Ai>{ch.title} 이야기예요. 답하기 싫은 질문은 넘어가도 돼요. 쓴 글은 이 기기에만 저장돼요.</Ai>
        {turns.map((t, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Ai>{t.q}</Ai>
            {t.skipped ? <Me>넘어갈게요</Me> : t.a.trim() ? <Me>{t.a}</Me> : null}
          </div>
        ))}
        {waiting ? (
          <span className="flex items-center gap-3">
            <Typing label="다음 질문을 생각하는 중" />
          </span>
        ) : null}
        {crisis ? <CrisisNote /> : null}
        {confirming && !done ? (
          qa.length ? (
            <>
              <Ai>이 장에서 이렇게 이해했어요. 맞나요?</Ai>
              <section aria-label="이야기에서 뽑은 값" className="card ml-[42px] animate-rise p-5">
                <StoryConfirm qa={qa} onDone={(s) => finish(s)} />
              </section>
            </>
          ) : (
            <>
              <Ai>이 장은 모두 넘어갔어요. 언제든 다시 할 수 있어요.</Ai>
              <button type="button" className="btn-primary ml-[42px]" onClick={() => finish(null)}>
                이 장 끝내기
              </button>
            </>
          )
        ) : null}
        {done ? <Ai>이 장은 끝냈어요. 확인한 값은 시뮬레이션에 들어가 있어요.</Ai> : null}
        <div ref={endRef} />
      </div>
    </Screen>
  );
}

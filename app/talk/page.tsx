"use client";
// 4. 피드백: 각 길의 끝에 선 '그때의 나'와 대화
import { ArrowUp, BarChart3, Clock, CornerDownRight, GitBranch } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LineBadge, MockNotice, Screen, Sheet, Typing } from "@/components/ui";
import { euro, iGa } from "@/lib/josa";
import { store } from "@/lib/store";
import type { ChatMessage, Line, Multiverse, Profile, Selection, SimEvent, WorldTemplate } from "@/lib/types";
import { getWorld } from "@/lib/worlds";

const QUICK = ["후회해?", "제일 힘들었던 건?", "다시 돌아가면 뭐 할 거야?", "돈은 좀 모았어?"];

function periodText(months: number) {
  return months >= 12 ? `${months / 12}년` : `${months}개월`;
}

function SelfBubble({ world, text, name, memory, onMemory }: { world: WorldTemplate; text: string; name: string; memory?: string; onMemory?: () => void }) {
  return (
    <div className="flex animate-rise items-start gap-2.5">
      <LineBadge world={world} size={32} />
      <div className="flex max-w-[85%] flex-col gap-1.5">
        <span className="text-cap font-semibold text-muted">{name}</span>
        <p className="rounded-[20px] rounded-tl-md px-4 py-3 text-base" style={{ background: `${world.color}14` }}>
          {text}
        </p>
        {memory ? (
          <button onClick={onMemory} className="chip min-h-[36px] self-start px-3 text-cap">
            <Clock aria-hidden="true" size={14} /> 기억: {memory}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TalkPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [scenes, setScenes] = useState<Record<string, SimEvent[]>>({});
  const [lines, setLines] = useState<Record<string, Line | undefined>>({});
  const [active, setActive] = useState("");
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [openMemory, setOpenMemory] = useState<SimEvent | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = store.getProfile();
    const s = store.getSelection();
    const mvs = store.getMultiverses();
    const act = store.getActive();
    if (!p || !s || !mvs) {
      router.replace("/simulate");
      return;
    }
    // 진로마다 지금 고른 세계선(없으면 본선)의 장면
    const sc: Record<string, SimEvent[]> = {};
    const ls: Record<string, Line | undefined> = {};
    for (const id of s.worldIds) {
      const mv: Multiverse | undefined = mvs[id];
      const lineId = act[id] ?? mv?.lines.find((l) => l.isMain)?.id ?? "";
      ls[id] = mv?.lines.find((l) => l.id === lineId);
      sc[id] = store.getLine(id, lineId) ?? [];
    }
    setProfile(p);
    setSelection(s);
    setScenes(sc);
    setLines(ls);
    const want = params.get("world");
    setActive(want && s.worldIds.includes(want) ? want : s.worldIds[0]);
  }, [router, params]);

  const chatKey = `${active}|${lines[active]?.id ?? ""}`;
  const messages = chats[chatKey] ?? [];
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy, active]);

  async function ask(text: string) {
    if (!profile || !selection || !text.trim() || busy) return;
    const worldId = active;
    const key = chatKey;
    const history = chats[key] ?? [];
    const withMine: ChatMessage[] = [...history, { role: "user", text }];
    setChats((c) => ({ ...c, [key]: withMine }));
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, worldId, scenes: scenes[worldId] ?? [], lineTitle: lines[worldId]?.title ?? "", months: selection.months, history, message: text }),
      });
      const data = await res.json();
      setChats((c) => ({ ...c, [key]: [...withMine, { role: "self", text: data.reply, memory: data.memory ?? undefined }] }));
    } catch {
      setChats((c) => ({ ...c, [key]: [...withMine, { role: "self", text: "지금은 대답하기 어려워. 잠깐 뒤에 다시 물어봐 줘." }] }));
    } finally {
      setBusy(false);
    }
  }

  // "1년차 4분기: 서비스 장애로 주말 출근" 같은 기억 문자열로 실제 사건을 찾는다.
  function findEvent(memory: string) {
    const evs = (scenes[active] ?? []).filter((e) => e.eventId !== "quiet");
    return evs.find((e) => memory.includes(e.title)) ?? evs.find((e) => memory.startsWith(e.label)) ?? null;
  }

  if (!profile || !selection || !active) return null;
  const world = getWorld(active);
  const period = periodText(selection.months);
  const selfName = `${period} 뒤의 ${profile.name}`;

  return (
    <Screen
      title={`${period} 뒤의 나`}
      back={`/multiverse?world=${active}`}
      right={
        <Link href="/report" className="pr-1 text-sm font-semibold text-muted underline underline-offset-4 hover:text-ink">
          리포트
        </Link>
      }
      footer={
        <div className="flex flex-col gap-2.5">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {QUICK.map((q) => (
              <button key={q} onClick={() => ask(q)} disabled={busy} className="chip flex-none">
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="ask" className="sr-only">
              그때의 나에게 질문
            </label>
            <input id="ask" name="ask" autoComplete="off" className="field h-[52px] flex-1 rounded-full py-0" value={input} onChange={(e) => setInput(e.target.value)} placeholder={`${iGa(world.short)} 된 나에게 물어보기…`} />
            <button type="submit" aria-label="질문 보내기" disabled={busy || !input.trim()} className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-ink text-white transition-colors disabled:bg-[#C9CDD4]">
              <ArrowUp aria-hidden="true" size={22} />
            </button>
          </form>
        </div>
      }
    >
      <MockNotice />
      <div role="tablist" aria-label="어느 길의 나와 대화할지 선택" className="mt-3 grid gap-1 rounded-full bg-hair/70 p-1" style={{ gridTemplateColumns: `repeat(${selection.worldIds.length}, minmax(0, 1fr))` }}>
        {selection.worldIds.map((id) => {
          const w = getWorld(id);
          const on = id === active;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(id)}
              className={`flex h-11 items-center justify-center gap-2 rounded-full text-sm transition-colors ${on ? "bg-surface font-bold text-ink shadow-[0_1px_2px_rgba(20,23,31,0.08)]" : "font-medium text-muted hover:text-ink"}`}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: w.color }} />
              {iGa(w.short)} 된 나
            </button>
          );
        })}
      </div>

      {lines[active] ? (
        <Link href={`/multiverse?world=${active}`} className="mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm" style={{ background: `${world.color}12` }}>
          <GitBranch aria-hidden="true" size={16} className="mt-0.5 flex-none" style={{ color: world.color }} />
          <span>
            <strong>{lines[active]!.isMain ? "AI가 먼저 간 세계" : "내가 고른 세계"}</strong>: {lines[active]!.title} (100번 중 {lines[active]!.count}번)
            <span className="block text-cap text-muted">다른 세계선의 나와 이야기하려면 눌러서 세계선을 고르세요</span>
          </span>
        </Link>
      ) : null}
      <div role="log" aria-live="polite" className="flex flex-col gap-5 py-6">
        <SelfBubble world={world} name={selfName} text={`안녕, ${period} 동안 ${euro(world.name)} 살아온 나야. 그동안 있었던 일, 뭐든 물어봐.`} />
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="max-w-[85%] animate-rise self-end rounded-[20px] rounded-br-md bg-ink px-4 py-3 text-base text-white">
              {m.text}
            </p>
          ) : (
            <SelfBubble key={i} world={world} name={selfName} text={m.text} memory={m.memory} onMemory={() => setOpenMemory(m.memory ? findEvent(m.memory) : null)} />
          ),
        )}
        {busy ? (
          <div className="flex items-center gap-2.5">
            <LineBadge world={world} size={32} />
            <span className="rounded-[20px] px-4 py-3.5" style={{ background: `${world.color}14` }}>
              <Typing label="그때의 내가 떠올리는 중" />
            </span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <Sheet open={openMemory !== null} onClose={() => setOpenMemory(null)} title={openMemory ? `${openMemory.label}의 기억` : "기억"}>
        {openMemory ? (
          <article>
            <h3 className="text-lg font-bold">{openMemory.title}</h3>
            <p className="mt-2 text-base text-muted">{openMemory.narration}</p>
            <p className="mt-3 flex gap-2 text-base font-medium">
              <CornerDownRight aria-hidden="true" size={18} className="mt-1 flex-none" style={{ color: world.color }} />
              {openMemory.choice}
            </p>
            {openMemory.evidence ? (
              <p className="mt-4 flex gap-1.5 border-t border-hair pt-3 text-sm text-muted">
                <BarChart3 aria-hidden="true" size={16} className="mt-0.5 flex-none" />
                근거: {openMemory.evidence.label} ({openMemory.evidence.source})
              </p>
            ) : null}
          </article>
        ) : null}
      </Sheet>
    </Screen>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TalkPage />
    </Suspense>
  );
}

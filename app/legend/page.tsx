"use client";
// 갈래 이야기(전설). 앞 두 장은 늘 열려 있고, 나머지는 앱을 쓰면서 열린다(이 기기 저장값으로만 판단).
import Link from "next/link";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { Mascot, MascotFace, type Mood } from "@/components/mascot";
import { DISCOVERIES, CHAPTERS, chapterOpen, foundList, markChaptersSeen, unlockState, type Chapter } from "@/lib/galae";

export default function LegendPage() {
  const [have, setHave] = useState({ profile: false, lines: false, report: false });
  const [peek, setPeek] = useState(false);

  const [found, setFound] = useState<string[]>([]);
  useEffect(() => {
    const h = unlockState();
    setHave(h);
    markChaptersSeen(h);
    setFound(foundList());
  }, []);

  const isOpen = (c: Chapter) => peek || chapterOpen(c, have);
  const opened = CHAPTERS.filter(isOpen).length;

  return (
    <Screen title="갈래 이야기" back="/">
      <div className="mt-4 flex flex-col items-center rounded-card bg-sunSoft px-5 py-6 text-center">
        <Mascot place="legend" mood="happy" firstLine="제 이야기, 궁금했어요?" />
        <p className="mt-3 text-sm text-muted">
          진로 리허설의 안내자 갈래가 태어난 이야기예요. 앱을 쓰면서 한 장씩 열려요. <span className="num font-semibold text-ink">({opened}/{CHAPTERS.length})</span>
        </p>
      </div>

      <ol className="mt-6 flex flex-col gap-4">
        {CHAPTERS.map((c) => {
          const open = isOpen(c);
          return (
            <li key={c.title} className="card flex gap-4 p-5">
              <span className="flex-none">{open ? <MascotFace mood={c.mood} size={52} /> : <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-ground text-muted"><Lock aria-hidden="true" size={20} /></span>}</span>
              <div className="min-w-0">
                <h2 className="text-base font-bold">{c.title}</h2>
                {open ? (
                  c.body.map((b) => (
                    <p key={b} className="mt-2 text-sm">
                      {b}
                    </p>
                  ))
                ) : (
                  <p className="mt-2 text-sm text-muted">아직 잠겨 있어요 · {c.hint}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {opened < CHAPTERS.length ? (
          <button type="button" className="btn-ghost flex-1" onClick={() => setPeek(true)}>
            잠긴 장도 미리 읽기
          </button>
        ) : null}
        <Link href="/interview" className="btn-primary flex-1">
          갈래와 리허설 시작하기
        </Link>
      </div>
      <section aria-labelledby="found-title" className="card mt-6 p-5">
        <h2 id="found-title" className="text-base font-bold">
          발견한 갈래 모습 <span className="num text-muted">({DISCOVERIES.filter((d) => found.includes(d.key)).length}/{DISCOVERIES.length})</span>
        </h2>
        <p className="mt-1 text-cap text-muted">갈래를 누르고, 잡고, 던지고, 가만히 두면 숨은 모습이 나와요. 이 기기에만 저장돼요.</p>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {DISCOVERIES.map((d) => {
            const ok = found.includes(d.key);
            return (
              <li key={d.key} className="flex flex-col items-center gap-1 text-center">
                {ok ? (
                  <MascotFace mood={d.mood} size={48} />
                ) : (
                  <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-ground text-lg font-bold text-muted">?</span>
                )}
                <span className="text-cap">{ok ? d.label : "아직 몰라요"}</span>
                {!ok ? <span className="text-cap text-muted">{d.hint}</span> : null}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="mt-4 text-cap text-muted">갈래와 이 이야기는 서비스 안내를 위해 팀이 지은 가상의 캐릭터예요.</p>
    </Screen>
  );
}

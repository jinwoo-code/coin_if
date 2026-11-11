"use client";
// 갈래 이야기(전설). 앞 두 장은 늘 열려 있고, 나머지는 앱을 쓰면서 열린다(이 기기 저장값으로만 판단).
import Link from "next/link";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { Mascot, MascotFace, type Mood } from "@/components/mascot";
import { store } from "@/lib/store";

type Chapter = { title: string; body: string[]; mood: Mood; unlock: "open" | "profile" | "lines" | "report"; hint: string };

const CHAPTERS: Chapter[] = [
  {
    title: "1장. 갈림길 마을",
    mood: "think",
    unlock: "open",
    hint: "",
    body: ["길이 여러 갈래로 나뉘는 마을이 있었어요.", "사람들은 갈림길 앞에서 오래 서 있었어요. 저 길 끝에 무엇이 있는지 아무도 미리 볼 수 없었거든요."],
  },
  {
    title: "2장. 노란 새싹",
    mood: "surprise",
    unlock: "open",
    hint: "",
    body: ["어느 밤, 사람들의 망설임이 가장 많이 쌓인 갈림길 한가운데서 작고 노란 동그라미가 톡 하고 솟아났어요.", "머리에는 파란 새싹이 하나. 여러 갈래 길 앞에서 태어났다고, 사람들은 '갈래'라고 불렀어요."],
  },
  {
    title: "3장. 천 번의 발걸음",
    mood: "happy",
    unlock: "profile",
    hint: "검사를 마치면 열려요",
    body: ["갈래에게는 신기한 재주가 있었어요. 한 사람의 삶을 그 사람처럼 천 번 살아 보고 돌아오는 거예요.", "그래서 갈래는 그 사람을 먼저 알아야 했어요. 무엇을 아끼는지, 어떤 때 지치는지요."],
  },
  {
    title: "4장. 갈래 길 지도",
    mood: "cheer",
    unlock: "lines",
    hint: "살아 보기를 한 번 하면 열려요",
    body: ["천 번을 다녀온 갈래는 지도를 그렸어요. 정답 하나가 아니라, 어느 길로 몇 번 갔는지를요.", "자주 간 길은 굵게, 드문 길은 가늘게. 그리고 갈림길마다 '보통은 이렇고, 너라면 이렇더라'고 적어 두었어요."],
  },
  {
    title: "5장. 말하지 않는 것",
    mood: "base",
    unlock: "report",
    hint: "리포트를 보면 열려요",
    body: ["사람들이 물었어요. \"그래서 어느 길로 가야 해?\"", "갈래는 고개를 저었어요. 길은 직접 고르는 거니까요. 갈래가 해 줄 수 있는 건 '이 길은 이랬어'와 '이번 주엔 이걸 해 보자'까지예요."],
  },
  {
    title: "6장. 갈래의 비밀",
    mood: "sleepy",
    unlock: "report",
    hint: "리포트를 보면 열려요",
    body: ["사실 갈래도 아직 자기 길을 고르는 중이에요.", "그래서 오늘도 누군가의 갈림길 옆에서 함께 서 있어요. 혼자 고민하지 않아도 된다고, 먼저 다녀와 보겠다고요."],
  },
];

export default function LegendPage() {
  const [have, setHave] = useState({ profile: false, lines: false, report: false });
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    setHave({
      profile: !!store.getProfile(),
      lines: Object.keys(store.getMultiverses() ?? {}).length > 0,
      report: !!store.getReport(),
    });
  }, []);

  const isOpen = (c: Chapter) => peek || c.unlock === "open" || have[c.unlock];
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
      <p className="mt-4 text-cap text-muted">갈래와 이 이야기는 서비스 안내를 위해 팀이 지은 가상의 캐릭터예요.</p>
    </Screen>
  );
}

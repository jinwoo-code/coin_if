"use client";
// 상담사 화면: 학생이 직접 '보여 주기'를 켠 경우에만 그 학생의 요약을 본다. 숫자는 전부 엔진 결과이고, 대화·이야기 글은 없다.
import { useEffect, useState } from "react";
import { Ci, Screen } from "@/components/ui";
import { getWorld } from "@/lib/worlds";

interface Sim {
  career: string;
  months: number;
  startYm: string;
  runs: number;
  gate?: { label?: string; share?: number } | null;
  satisfied: number;
  stressed: number;
  levers?: string[] | null;
}
interface Student {
  id: string;
  sharedAt: string;
  name: string | null;
  major: string | null;
  dilemma: string | null;
  values: string[] | null;
  checkins: number;
  sims: Sim[];
}

const careerName = (id: string) => {
  try {
    return getWorld(id).name;
  } catch {
    return id;
  }
};

export default function Counselor() {
  const [list, setList] = useState<Student[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/counselor", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setList(d.students);
      })
      .catch((e) => setErr((e as Error).message || "불러오지 못했어요."));
  }, []);
  return (
    <Screen title="상담 학생" back="/">
      {err ? <p className="mt-4 text-sm">{err}</p> : null}
      {!err && !list ? <p className="mt-4 text-muted">불러오는 중…</p> : null}
      {list?.length === 0 ? <p className="mt-4 text-sm">아직 결과를 보여 주기로 한 학생이 없어요. 학생이 학교 초대코드 화면에서 켜면 여기에 나와요.</p> : null}
      {list?.length ? <p className="mt-3 text-sm text-muted">학생이 직접 켠 {list.length}명만 보여요. 끄면 바로 사라져요. 시뮬레이션 숫자는 예측이 아니라 가정값이 섞인 계산이에요. 상담의 출발점으로만 써 주세요.</p> : null}
      {list?.map((s) => (
        <section key={s.id} className="card mt-4 p-5" aria-label={`${s.name ?? "이름 없음"} 학생`}>
          <h2 className="text-lg font-bold">{s.name ?? "이름 없음"}</h2>
          <p className="text-sm text-muted">
            {s.major ?? "전공 안 적음"} · 체크인 <span className="num">{s.checkins}</span>번
          </p>
          {s.dilemma ? <p className="mt-2 text-sm">고민: {s.dilemma}</p> : null}
          {s.values?.length ? <p className="mt-1 text-sm">가치관: {s.values.join(" > ")}</p> : null}
          {s.sims.length === 0 ? <p className="mt-3 text-sm text-muted">아직 살아본 진로가 없어요.</p> : null}
          <ul className="mt-3 space-y-3">
            {s.sims.map((x) => (
              <li key={`${x.career}${x.startYm}${x.months}`} className="border-t border-hair pt-3 text-sm">
                <p className="font-semibold">{careerName(x.career)}</p>
                <p className="num mt-0.5">
                  {x.gate?.label ?? "합격·취업"} {x.gate?.share ?? 0}% <Ci pct={x.gate?.share ?? 0} n={x.runs} /> · 만족 {x.satisfied}% · 스트레스 높음 {x.stressed}%
                </p>
                {x.levers?.length ? <p className="mt-1 text-cap text-muted">바꿀 수 있는 것: {x.levers.join(", ")}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Screen>
  );
}

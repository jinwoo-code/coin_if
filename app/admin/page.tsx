"use client";
// 대학 관리자 대시보드. 숫자는 전부 DB 함수 org_stats가 엔진 결과를 센 값이고, 학생 5명 미만 항목은 함수 안에서 이미 빠져 있다.
import { useEffect, useState } from "react";
import { Screen } from "@/components/ui";
import { getWorld } from "@/lib/worlds";

interface Stats {
  org: { name: string; status: string; until: string };
  k: number;
  students: number;
  demoStudents: number;
  hidden: boolean;
  simulations?: number;
  careers?: { career: string; students: number; runs: number }[];
  stuck?: { career: string; line: string; students: number; satisfied: number }[];
  levers?: { career: string; title: string; students: number }[];
  cost?: { calls: number; krw: number; users?: number };
}

const careerName = (id: string) => {
  try {
    return getWorld(id).name;
  } catch {
    return id;
  }
};

export default function Admin() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setS(d);
      })
      .catch((e) => setErr((e as Error).message || "불러오지 못했어요."));
  }, []);

  if (err)
    return (
      <Screen title="대학 대시보드" back="/">
        <p className="card mt-4 p-5">{err}</p>
      </Screen>
    );
  if (!s)
    return (
      <Screen title="대학 대시보드" back="/">
        <p className="mt-4 text-muted">불러오는 중…</p>
      </Screen>
    );

  const empty = <p className="p-4 text-sm text-muted">{s.k}명 이상 모인 항목이 아직 없어요.</p>;
  return (
    <Screen title="대학 대시보드" back="/" wide>
      <p className="label mt-2">
        {s.org.name} · {s.org.status === "trial" ? "시범" : "계약"} · {s.org.until}까지
      </p>
      {s.demoStudents > 0 ? (
        <p role="note" className="mt-3 rounded-2xl border-2 border-[#F5C400] bg-[#FFF6CC] p-3 text-sm font-semibold">
          시연용 가상 데이터예요. 학생 {s.students}명 중 {s.demoStudents}명은 실제 학생이 아니라 엔진으로 만든 가상 학생이에요.
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="이용 학생" value={`${s.students}명`} />
        <Tile label="시뮬레이션" value={s.hidden ? "-" : `${s.simulations}회`} />
        <Tile label="이번 달 AI 비용" value={s.hidden || !s.cost?.calls ? "실측 전" : `${s.cost.krw.toLocaleString("ko-KR")}원`} />
        <Tile
          label="AI 쓴 학생 1명당"
          value={s.hidden || !s.cost?.calls || !s.cost.users ? "실측 전" : `${Math.round(s.cost.krw / s.cost.users).toLocaleString("ko-KR")}원`}
          sub={s.cost?.users ? `이번 달 ${s.cost.users}명 기준` : undefined}
        />
      </div>

      {s.hidden ? (
        <p className="card mt-4 p-5">
          학생이 {s.k}명 이상 모이면 보여요. 지금 {s.students}명이에요. 적은 인원의 결과로 개인을 짐작할 수 없게 숨겨요.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Block title="많이 살아본 진로" note="학생 수 기준 Top 10">
            {s.careers?.length
              ? s.careers.map((c) => <Row key={c.career} left={careerName(c.career)} right={`${c.students}명`} />)
              : empty}
          </Block>
          <Block title="많이 막힌 길" note="학생마다 만족 비율이 가장 낮게 끝난 세계선">
            {s.stuck?.length
              ? s.stuck.map((x) => <Row key={x.career + x.line} left={x.line} sub={`${careerName(x.career)} · 끝나고 만족 ${x.satisfied}%`} right={`${x.students}명`} />)
              : empty}
          </Block>
          <Block title="바꿀 수 있는 것" note="엔진이 학생마다 고른 상위 3개의 빈도">
            {s.levers?.length
              ? s.levers.map((x) => <Row key={x.career + x.title} left={x.title} sub={careerName(x.career)} right={`${x.students}명`} />)
              : empty}
          </Block>
        </div>
      )}
      <p className="mt-6 text-cap text-muted">
        학생 개인의 결과·대화는 볼 수 없어요. {s.k}명 미만인 항목은 DB에서 빼고 보내요. AI 비용은 호출 기록(토큰 수 × 단가)으로 계산해요.
      </p>
    </Screen>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="num mt-1 text-xl font-extrabold">{value}</p>
      {sub ? <p className="text-cap text-muted">{sub}</p> : null}
    </div>
  );
}

function Block({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-cap text-muted">{note}</p>
      <ul className="card mt-2 divide-y divide-hair">{children}</ul>
    </section>
  );
}

function Row({ left, sub, right }: { left: string; sub?: string; right: string }) {
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <span>
        <span className="font-semibold">{left}</span>
        {sub ? <span className="block text-cap text-muted">{sub}</span> : null}
      </span>
      <span className="num flex-none font-bold">{right}</span>
    </li>
  );
}

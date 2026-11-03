// 근거 자료 아래: 시뮬레이션이 쓰는 가중치(data/weights.json)를 가정값·보정값으로 나눠 보여 준다.
import { fittedCount, formatWeight, weightGroups, WEIGHTS } from "@/lib/weights";

export function WeightSources({ readiness }: { readiness: string[] }) {
  const groups = weightGroups(readiness);
  const all = groups.flatMap((g) => g.keys);
  const fitted = fittedCount(all);
  return (
    <div className="mt-5 border-t border-hair pt-4">
      <p className="label">시뮬레이션이 쓰는 가중치 {all.length}개</p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-cap">
        <span className="rounded-full bg-[#FFF4E5] px-2 py-0.5 font-semibold text-[#7A4300]">가정값 {all.length - fitted}개</span>
        <span className="rounded-full bg-[#E6F4EE] px-2 py-0.5 font-semibold text-[#0B6B4B]">보정값 {fitted}개</span>
      </p>
      <p className="mt-2 text-cap text-muted">가정값은 방향만 연구·문서를 따르고 크기는 팀이 정한 값이에요. 보정값은 파일럿 사용자 답으로 크기를 다시 잰 값이에요(사용 인원·95% 구간 표시).</p>
      {groups.map((g) => (
        <div key={g.title} className="mt-3">
          <p className="text-sm font-semibold">{g.title}</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            {g.keys.map((k) => {
              const w = WEIGHTS[k];
              const fit = w.magnitude === "fitted";
              return (
                <li key={k} className="text-cap">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="shrink-0">{w.label}</span>
                    <span className="num ml-auto min-w-0 text-right font-semibold">{formatWeight(w)}</span>
                  </span>
                  <span className={`block ${fit ? "text-[#0B6B4B]" : "text-muted"}`}>{fit ? `보정값 · ${w.n}명${w.ci ? ` · 95% 구간 ${w.ci[0]}~${w.ci[1]}` : ""}${w.prior !== undefined ? ` · 처음 값 ${w.prior}` : ""}` : "가정값"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

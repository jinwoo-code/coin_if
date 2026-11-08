// 공유본 화면(링크·PDF 같이 씀). 서버 컴포넌트로도 그린다. 값은 lib/shared-report.ts에 있는 칸뿐이다.
import { AI_NOTICE, type SharedReport } from "@/lib/shared-report";
import { plain, T } from "@/lib/copy";

const yearsOf = (m: number) => (m % 12 ? `${m}개월` : `${m / 12}년`);

export function SharedReportView({ data, expiresAt }: { data: SharedReport; expiresAt?: string }) {
  return (
    <article className="mx-auto w-full max-w-[720px] px-5 py-6 text-ink print:max-w-none print:px-0" data-testid="shared-report">
      <p className="rounded-lg border-2 border-ink px-4 py-3 text-base font-bold" data-testid="ai-notice">
        {AI_NOTICE}
      </p>
      <p className="mt-1 text-cap text-muted">사건·확률·돈은 규칙 엔진이 계산했고, 문장 일부는 AI가 썼어요. 준비 계획이지 합격·취업을 보장하지 않아요.</p>
      <h1 className="mt-5 text-2xl font-extrabold">{data.person.name}의 진로 리허설 결과</h1>
      <p className="mt-1 text-sm text-muted">
        {data.person.major}
        {data.createdAt ? ` · ${data.createdAt.slice(0, 10)} 기준` : ""}
        {expiresAt ? ` · 링크는 ${expiresAt.slice(0, 10)}까지` : ""}
      </p>

      {data.worlds.map((w) => (
        <section key={w.id} className="mt-7 break-inside-avoid-page" aria-label={w.name}>
          <h2 className="text-xl font-bold">{w.name}</h2>
          <p className="mt-2 text-sm">
            종합 점수 <strong>{w.fit}점</strong> · {yearsOf(w.months)} 안에 {w.gateLabel} <strong>{w.gateShare}%</strong> · 만족하며 끝난 비율 {w.satisfied}% · 스트레스 높게 끝남 {w.stressed}%
          </p>
          <p className="text-cap text-muted">{w.runs.toLocaleString()}번 살아 본 결과예요. 확률의 바탕이 된 배수는 대부분 {T.assumedFull}이에요.</p>
          {w.good || w.hard ? (
            <p className="mt-2 text-sm">
              좋았던 점: {w.good}
              <br />
              힘들었던 점: {w.hard}
            </p>
          ) : null}

          <h3 className="mt-4 text-base font-bold">필요한 것과 격차</h3>
          <p className="text-sm">
            있음 {w.gap.have} · 부분적 {w.gap.partial} · 없음 {w.gap.none}
          </p>
          <ol className="mt-1 list-decimal pl-5 text-sm">
            {w.gap.top.map((t) => (
              <li key={t.title} className="mt-1">
                {t.title} <span className="text-cap text-muted">({t.status})</span>
                {t.why.length ? <span className="block text-cap text-muted">{t.why.map((x) => plain(x)).join(" · ")}</span> : null}
              </li>
            ))}
          </ol>

          <h3 className="mt-4 text-base font-bold">월별 일정</h3>
          <p className="text-cap text-muted">
            주당 {w.plan.weekly}시간, {w.plan.months}개월 기준. 시간은 NCS 훈련 기준 또는 {T.assumedFull}이에요. {plain(w.plan.note)}
          </p>
          <ul className="mt-1 text-sm">
            {w.plan.rows.map((r) => (
              <li key={r.title} className="mt-0.5">
                {r.title} <span className="text-cap text-muted">{r.range}</span>
              </li>
            ))}
          </ul>

          {w.evidence.length ? (
            <>
              <h3 className="mt-4 text-base font-bold">증거물</h3>
              <ul className="mt-1 text-sm">
                {w.evidence.map((e) => (
                  <li key={e.title} className="mt-0.5">
                    {e.title} <span className="text-cap text-muted">{plain(e.amount)}({T.assumed})</span>
                    {e.topic ? <span className="block text-cap">주제: {e.topic}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {w.rerun ? (
            <p className="mt-4 text-sm">
              이 계획대로 하면 {yearsOf(w.rerun.months)} 안에 {w.rerun.label}{" "}
              <strong>
                {w.rerun.before}% → {w.rerun.after}%
              </strong>
              <span className="block text-cap text-muted">{w.rerun.n.toLocaleString()}번, 같은 시드. 계획을 제때 다 해낸다고 본 값이에요.</span>
            </p>
          ) : null}
        </section>
      ))}

      <section className="mt-7 break-inside-avoid-page" aria-label="실행 계획">
        <h2 className="text-xl font-bold">이번 주 실행 계획(WOOP)</h2>
        <dl className="mt-2 text-sm">
          <dt className="mt-2 font-semibold">바라는 것</dt>
          <dd>{data.woop.wish}</dd>
          <dt className="mt-2 font-semibold">이루면 좋은 점</dt>
          <dd>{data.woop.outcome}</dd>
          <dt className="mt-2 font-semibold">걸림돌</dt>
          <dd>
            {data.woop.obstacle}
            {data.forks.length ? <span className="block text-cap text-muted">자주 만난 갈림길: {data.forks.map((f) => `${f.worldName} '${f.label}' ${f.share}%`).join(", ")}</span> : null}
          </dd>
          <dt className="mt-2 font-semibold">만약 그러면 계획</dt>
          <dd>{data.woop.plan}</dd>
        </dl>
        {data.week.length ? (
          <>
            <h3 className="mt-4 text-base font-bold">이번 주 할 일</h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {data.week.map((t) => (
                <li key={`${t.when}${t.what}`}>{[t.when, t.where, t.what].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <p className="mt-7 text-cap text-muted">인생 이야기 원문과 검사 문항별 답은 이 공유본에 들어 있지 않아요.</p>
    </article>
  );
}

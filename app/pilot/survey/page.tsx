"use client";
// 파일럿 사용 전·후 설문. 전(when=pre): 동의 → 질문 3개, 검사 전이라 프로필이 없으면 대기 값으로 두었다가 프로필이 생길 때 붙인다.
// 후(when=post): 리포트를 본 뒤 같은 질문 3개 + 판단이 바뀌었는지 자유 답. 이전 답은 안 보여 준다(기억에 맞추지 않게).
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChoiceItem } from "@/components/scale";
import { Screen } from "@/components/ui";
import { hasCrisis, CRISIS_CONTACTS } from "@/lib/crisis";
import { CHANGED_MAX, CONFIDENCE_LABELS, parseCareers, PILOT_CONSENT, PILOT_VERSION } from "@/lib/pilot";
import { store } from "@/lib/store";
import type { PilotSurveyAnswer, Profile } from "@/lib/types";

type Pilot = NonNullable<Profile["pilot"]>;

export default function PilotSurveyPage() {
  const router = useRouter();
  const [when, setWhen] = useState<"pre" | "post" | null>(null);
  const [consented, setConsented] = useState(false);
  const [confidence, setConfidence] = useState<number | undefined>();
  const [careers, setCareers] = useState("");
  const [action, setAction] = useState<number | undefined>();
  const [changed, setChanged] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    store.setPilotInvited();
    const w = new URLSearchParams(window.location.search).get("when") === "post" ? "post" : "pre";
    const pilot = store.getProfile()?.pilot ?? store.getPilotPending();
    if (w === "post" && (!pilot?.survey?.pre || pilot.withdrawnAt)) {
      router.replace("/report");
      return;
    }
    setConsented(!!pilot && !pilot.withdrawnAt);
    setWhen(w);
  }, [router]);

  if (!when) return null;

  if (!consented) {
    return (
      <Screen
        title="파일럿 참여 동의"
        back="/"
        footer={
          <div className="flex gap-2">
            <Link href="/" className="btn-ghost flex flex-1 items-center justify-center">
              참여 안 함
            </Link>
            <button type="button" className="btn-primary flex-1" onClick={() => setConsented(true)}>
              동의하고 시작
            </button>
          </div>
        }
      >
        <ol className="mt-4 flex flex-col gap-3">
          {PILOT_CONSENT.map((c, i) => (
            <li key={c.title} className="card p-4">
              <p className="text-base font-bold">
                <span className="num mr-1.5 text-muted">{i + 1}.</span>
                {c.title}
              </p>
              <p className="mt-1 text-sm text-muted">{c.body}</p>
            </li>
          ))}
        </ol>
      </Screen>
    );
  }

  function submit() {
    const now = new Date().toISOString();
    const profile = store.getProfile();
    const old: Pilot = profile?.pilot && !profile.pilot.withdrawnAt ? profile.pilot : (store.getPilotPending() ?? { version: PILOT_VERSION, consentAt: now, withdrawnAt: null });
    const answer: PilotSurveyAnswer = { confidence: (confidence ?? 0) + 1, careers: parseCareers(careers), hasAction: action === 0, at: now };
    if (when === "pre" && profile) answer.usedBefore = true; // 이미 검사를 한 사람은 '쓰기 전'이 아니다
    const survey = when === "pre" ? { ...old.survey, pre: answer } : { ...old.survey, post: answer, changed: changed.trim().slice(0, CHANGED_MAX) };
    const next: Pilot = { ...old, survey };
    store.setPilotPending(next);
    if (profile) store.setProfile({ ...profile, pilot: next });
    if (when === "pre") {
      router.push(profile ? "/pilot" : "/interview");
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0 });
  }

  if (done) {
    return (
      <Screen
        title="파일럿 설문"
        back="/report"
        footer={
          <Link href="/report" className="btn-primary flex w-full items-center justify-center">
            리포트로 돌아가기
          </Link>
        }
      >
        <div className="card mt-4 p-5" data-testid="pilot-survey-done">
          <p className="flex items-center gap-2 text-base font-bold">
            <Check aria-hidden="true" size={18} className="text-[#0B6B4B]" /> 답해 주셔서 고마워요.
          </p>
          <p className="mt-2 text-sm text-muted">로그인했다면 계정에 저장돼 다른 참여자 답과 묶어서 분석해요. 로그인하지 않았다면 이 기기에만 남아요.</p>
        </div>
      </Screen>
    );
  }

  const complete = confidence !== undefined && action !== undefined;
  return (
    <Screen
      title={when === "pre" ? "시작 전 설문" : "마무리 설문"}
      back={when === "pre" ? "/" : "/report"}
      footer={
        <button type="button" className="btn-primary w-full" disabled={!complete} onClick={submit}>
          {when === "pre" ? "다음" : "끝내기"}
        </button>
      }
    >
      <p className="mt-3 text-cap text-muted">{when === "pre" ? "지금 마음 그대로 답해 주세요. 정답은 없어요." : "처음과 같은 질문이에요. 지금 마음 그대로 답해 주세요."}</p>
      <ol className="mt-2">
        <ChoiceItem id="survey-confidence" n={1} text="내 진로 결정에 얼마나 확신이 있나요?" options={CONFIDENCE_LABELS} value={confidence} onPick={setConfidence} />
        <li className="border-b border-hair py-4">
          <label htmlFor="survey-careers" className="text-base font-bold">
            <span className="num mr-1.5 text-muted">2.</span>
            지금 고려 중인 진로를 적어 주세요.
          </label>
          <p className="mt-1 text-cap text-muted">쉼표로 나눠 주세요. 없으면 비워 두세요.</p>
          <input id="survey-careers" className="field mt-2 w-full" value={careers} onChange={(e) => setCareers(e.target.value)} placeholder="예: 개발자, 공무원" />
        </li>
        <ChoiceItem id="survey-action" n={3} text="이번 주에 진로를 위해 할 일이 정해져 있나요?" options={["네, 있어요", "아니요, 없어요"]} value={action} onPick={setAction} />
      </ol>
      {when === "post" ? (
        <div className="py-4">
          <label htmlFor="survey-changed" className="text-base font-bold">
            판단이 바뀌었나요? 무엇이요?
          </label>
          <p className="mt-1 text-cap text-muted">안 바뀌었어도 괜찮아요. 이름이나 연락처는 적지 말아 주세요.</p>
          <textarea id="survey-changed" className="field mt-2 min-h-[110px] w-full resize-none" maxLength={CHANGED_MAX} value={changed} onChange={(e) => setChanged(e.target.value)} />
          {hasCrisis(changed) ? <p className="mt-2 rounded-xl bg-[#FFF4E5] px-3 py-2 text-cap text-[#7A4300]">많이 힘드시다면 혼자 견디지 마세요. {CRISIS_CONTACTS}</p> : null}
        </div>
      ) : null}
    </Screen>
  );
}

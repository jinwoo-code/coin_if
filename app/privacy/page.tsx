// 개인정보 처리방침(초안). 법률 검토 전이라 화면에 '초안'이라고 크게 표시한다.
import { Screen } from "@/components/ui";
import { COLLECTED, CONSENT_VERSION } from "@/lib/consent";
import { FLAGS } from "@/lib/flags";

export const metadata = { title: "개인정보 처리방침(초안) · AI 진로 리허설" };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "보관 기간과 파기",
    body: [
      "탈퇴할 때까지 보관하고, 탈퇴하면 바로 지워요.",
      "로그인하지 않고 쓴 결과는 서버에 저장하지 않고 이 기기의 브라우저에만 남아요.",
      "나에 대한 이야기(진로 구성 인터뷰) 원문은 로그인해도 서버에 저장하지 않고 이 기기에만 남아요. 값을 뽑을 때 AI에 보내지만 저장하거나 기록에 남기지 않아요.",
      "진로 고르기·리포트 화면의 '내 정보'에서 '내 이야기 지우기'(원문과 뽑은 값), '전체 지우기'(이 기기와 계정의 프로필·시뮬레이션·대화)를 할 수 있어요. 토큰·결제 기록은 결제 확인을 위해 남아요.",
    ],
  },
  {
    title: "처리를 맡기는 곳(위탁)",
    body: [
      "Supabase: 계정과 결과 저장(데이터베이스)",
      "Google(Gemini API, 유료 등급): 정해진 결과를 문장으로 쓰는 데 답변 일부를 보냄. 유료 등급은 입력을 모델 학습에 쓰지 않아요.",
      "Vercel: 웹 서버",
      "토스페이먼츠: 토큰 충전 결제(카드 정보는 토스페이먼츠만 처리)",
      ...(FLAGS.checkinMail ? ["Resend: 체크인 메일을 켠 사람에게 알림 메일 발송(메일 주소만 보냄, 진로 결과나 답 내용은 안 넣음)"] : []),
    ],
  },
  {
    title: "대학에 주는 정보",
    body: [
      "초대코드로 대학에 가입하면, 대학 담당자는 이용 학생 수·많이 살아본 진로 같은 통계만 봐요.",
      "학생 5명 미만인 항목은 숨기고, 이름·이메일·개인별 결과는 대학에 주지 않아요.",
      ...(FLAGS.counselor ? ["예외: 학교 초대코드 화면에서 본인이 '보여 주기'를 켜면 그 학교 상담 선생님이 내 이름, 전공, 고민, 가치관, 체크인 횟수, 진로별 결과 요약, 바꿀 수 있는 것을 봐요. 끄면 바로 안 보여요. 대화와 이야기 글은 안 보여요."] : []),
    ],
  },
  {
    title: "내 권리",
    body: ["언제든 내 정보를 보거나, 고치거나, 지우거나, 동의를 철회할 수 있어요.", "요청: 운영팀 이메일(정식 출시 전 확정)"],
  },
];

export default function Privacy() {
  return (
    <Screen title="개인정보 처리방침" back="/">
      <p className="mt-2 rounded-2xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-4 font-semibold">초안이에요. 법률 검토 전이라 실제 서비스 전에 바뀔 수 있어요. (판: {CONSENT_VERSION})</p>
      <h2 className="mt-8 text-lg font-bold">모으는 정보와 쓰는 곳</h2>
      <ul className="card mt-3 divide-y divide-hair">
        {COLLECTED.map((c) => (
          <li key={c.item} className="p-4">
            <p className="font-semibold">{c.item}</p>
            <p className="mt-1 text-sm text-muted">{c.why}</p>
          </li>
        ))}
      </ul>
      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="mt-8 text-lg font-bold">{s.title}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
            {s.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      ))}
    </Screen>
  );
}

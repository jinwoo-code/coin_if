"use client";
// 기능 설명: 갈래가 기능마다 한마디로 소개하고, 펼치면 자세한 설명과 근거·한계를 보여 준다.
// 숫자·근거는 CLAUDE.md·docs와 같은 값만 쓴다(새로 지어내지 않음).
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Screen } from "@/components/ui";
import { Mascot, MascotFace, type Mood } from "@/components/mascot";
import { T } from "@/lib/copy";

type Feature = { id: string; mood: Mood; title: string; say: string; points: string[]; href?: string; go?: string };

const FEATURES: Feature[] = [
  {
    id: "interview",
    mood: "think",
    title: "1. 나 만들기(검사)",
    say: "먼저 당신을 알아야 대신 살아 볼 수 있어요!",
    points: [
      "깊이를 골라요: 빠르게(약 11분) · 표준 · 정밀(인생 이야기 6장) · 계속 닮아 가기(체크인).",
      "가치관, 성격(Mini-IPIP 20문항, 표준이면 IPIP 50문항), 흥미, 상황 질문, 생활 조건을 물어요.",
      "상황 질문 일부는 채점용으로 따로 둬서, 분신이 나를 얼마나 닮았는지 'n개 중 m개'로 보여 줘요.",
      "모든 질문은 건너뛸 수 있고, 이야기 원문은 이 기기에만 저장돼요.",
    ],
    href: "/interview",
    go: "검사 시작하기",
  },
  {
    id: "simulate",
    mood: "happy",
    title: "2. 1,000번 살아 보기",
    say: "고른 진로마다 한 달씩, 1,000번 살아 보고 올게요!",
    points: [
      "사건·합격·돈·상태값은 규칙 엔진이 계산하고, 같은 입력이면 같은 결과가 나와요(시드 고정).",
      "그중 가장 흔한 길 하나를 타임라인으로 보여 주고, 요약 카드에 시기·만족도·모은 돈·연봉을 적어요.",
      "평균 확률은 공개 통계(9급 합격자 2년 안 73.3%, 청년 첫 취업 평균 11.2개월 등)에 맞췄어요.",
    ],
  },
  {
    id: "odds",
    mood: "surprise",
    title: "3. 갈림길: 보통은 N%, 나는 M%",
    say: "갈림길마다 보통 사람과 나를 나란히 보여 드려요.",
    points: [
      "큰 갈림길에서는 AI 분신이 '나라면 어떻게 할지' 확률을 말하고, 엔진이 기준 비율 근처(0.67~1.5배)에서만 반영해요.",
      "배지를 누르면 출처(통계 / 우리가 정한 값)와 판단 주체(AI / 규칙 계산)가 펼쳐져요.",
      "AI가 실패해도 멈추지 않고 규칙 계산으로 이어 가며, 그렇게 표시해요.",
    ],
  },
  {
    id: "map",
    mood: "cheer",
    title: `4. ${T.lineMap}`,
    say: "1,000번 다녀온 길을 나무처럼 그려 왔어요!",
    points: [
      `자주 간 ${T.line}은 굵게, 드문 길은 접어서 보여 줘요. 확률 옆 괄호는 표본 오차 범위예요.`,
      "갈림길을 바꿔 보면 그 뒤 인생이 어떻게 달라지는지 1,000번 다시 살아 봐요.",
      "'바꿀 수 있는 것 Top 3': 내 조건을 하나씩 바꿔 가장 크게 달라지는 것을 찾아요.",
      "고용24 공식 데이터로 '지금 현실에서는'을 함께 보여 줘요.",
    ],
  },
  {
    id: "talk",
    mood: "happy",
    title: "5. 그 길의 나와 대화",
    say: "몇 년 뒤의 나한테 직접 물어볼 수 있어요.",
    points: [
      `고른 ${T.line}을 실제로 걸어온 미래의 나가, 그 길에서 겪은 기억만 근거로 답해요.`,
      "가라/가지 말라고 단정하지 않아요. 결정은 지금의 나에게 맡겨요.",
      "위기 표현이 보이면 도움받을 곳을 먼저 안내해요.",
    ],
  },
  {
    id: "live",
    mood: "think",
    title: "6. AI가 직접 살아 보기(실시간 판단)",
    say: "이번엔 갈림길마다 제가 직접 멈춰서 판단해 볼게요.",
    points: [
      "30번의 삶을, 큰 갈림길에 닿을 때마다 AI가 그때 상황을 보고 판단하며 살아요.",
      "1,000번 통계와 섞지 않고 'AI가 직접 살아 본 30개의 삶'으로 따로 보여 줘요.",
      "기본 모드보다 낫다는 근거는 아직 없어요(비교 전). 그래서 따로 둬요.",
    ],
  },
  {
    id: "report",
    mood: "cheer",
    title: "7. 리포트와 실행 계획",
    say: "다녀온 걸 정리해서, 이번 주에 할 일까지 드려요!",
    points: [
      "무료: 가치관 부합도, 1,000번 결과 한 줄, 이번 주 할 일 3개, WOOP(바라는 것·장애물·계획), 격차 미리 보기.",
      "프리미엄: 필요한 것과 내 격차 전체(NCS·자격 공식 목록에서만), 월별 일정, 계획 넣고 다시 살아 보기, 증거물, 상담사 공유(PDF·링크).",
      "리포트는 준비 계획이지 합격·취업 보장이 아니에요.",
    ],
    href: "/report",
    go: "리포트 보기",
  },
  {
    id: "ongoing",
    mood: "sleepy",
    title: "8. 계속 닮아 가기",
    say: "한 달 뒤에 또 만나요. 그때 더 닮아 있을게요.",
    points: [
      "시뮬레이션 속 선택이 나와 다르면 '나라면 이렇게 안 해'로 고칠 수 있어요.",
      "한 달 체크인에서 같은 질문을 다시 묻고, 지난 한 달 실제 선택을 반영해요.",
      "인생 이야기 6장(정밀)으로 결정 방식·후회·가족 기대를 더 깊이 담아요.",
    ],
  },
  {
    id: "honest",
    mood: "base",
    title: "9. 솔직하게 말할게요",
    say: "모르는 건 모른다고 적어 뒀어요.",
    points: [
      "통계 출처가 없는 숫자는 화면에 '우리가 정한 값'이라고 표시해요.",
      "개인 배수와 가중치 대부분은 아직 우리가 정한 값이에요. 파일럿 데이터로 보정할 준비가 돼 있어요.",
      "자격증·훈련과정은 공식 데이터 목록에서만 고르고, AI는 고르고 설명만 해요.",
      "공유본에는 이름·전공·결과·계획만 담고, 이야기 원문은 담지 않아요.",
    ],
  },
];

export default function GuidePage() {
  return (
    <Screen title="기능 둘러보기" back="/">
      <div className="mt-4 flex flex-col items-center rounded-card bg-sunSoft px-5 py-6 text-center">
        <Mascot place="legend" mood="cheer" firstLine="제가 하나씩 소개해 드릴게요! 궁금한 걸 눌러 보세요." />
        <p className="mt-3 text-sm text-muted">진로 리허설이 하는 일 {FEATURES.length}가지예요. 처음이라면 예시 인물로 직접 둘러보는 게 제일 빨라요.</p>
      </div>

      <nav aria-label="기능 목록" className="mt-5 flex flex-wrap gap-2">
        {FEATURES.map((f) => (
          <a key={f.id} href={`#${f.id}`} className="inline-flex min-h-11 items-center rounded-full border border-hair bg-surface px-3 text-sm font-semibold hover:border-ink">
            {f.title.replace(/^\d+\. /, "")}
          </a>
        ))}
      </nav>

      <ol className="mt-6 flex flex-col gap-4">
        {FEATURES.map((f) => (
          <li key={f.id} id={f.id} className="scroll-mt-20">
            <details className="card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <MascotFace mood={f.mood} size={52} className="flex-none" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold">{f.title}</span>
                  <span className="mt-1 inline-block rounded-2xl border-2 border-ink bg-surface px-3 py-1 text-sm">{f.say}</span>
                </span>
                <ChevronDown aria-hidden="true" size={20} className="flex-none transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-hair px-5 pb-5 pt-3">
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
                  {f.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {f.href ? (
                  <Link href={f.href} className="btn-ghost mt-4 w-full">
                    {f.go}
                  </Link>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/legend" className="btn-ghost flex-1">
          갈래 이야기 읽기
        </Link>
        <Link href="/" className="btn-primary flex-1">
          처음 화면에서 시작하기
        </Link>
      </div>
    </Screen>
  );
}

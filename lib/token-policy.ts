// 토큰 정책 한 곳(2026-11-08 팀장 결정). 가격·횟수·안내 문구는 여기만 고친다. 브라우저와 서버가 같이 읽는다.
// 가입 선물 5토큰은 DB(0002_tokens.sql)에도 같은 숫자가 있다. 바꾸면 둘 다 고친다.

// 기능마다 쓰는 토큰. 0이면 무료(로그인했으면 원장에 0토큰 행만 남아 이용 횟수를 센다).
export const COSTS = {
  simulate: 0, // 기본 시뮬레이션(1,000번). 한 달 3회 제한은 발표 뒤
  live_simulate: 3, // AI가 직접 살아 보는 모드 1회(진로 2~3개)
  premium_report: 5, // 프리미엄 리포트
  talk: 0, // 미래의 나와 대화. 갈래 길마다 TALK_LIMIT마디까지
} as const;
export type Feature = keyof typeof COSTS;

export const TALK_LIMIT = 20; // 대화: 갈래 길 하나에 내가 보내는 마디 수
export const LIVE_MONTHLY_LIMIT = 3; // 대학 계약 학생의 직접 모드 한 달 횟수
export const SIGNUP_BONUS = 5; // 가입 선물(DB 트리거와 같은 값)

// 충전 상품. 결제 금액은 서버가 이 표로 확인한다. 1개 단위 판매는 없다.
export const PRODUCTS = [
  { id: "t5", tokens: 5, price: 4950 },
  { id: "t12", tokens: 12, price: 9900 },
] as const;
export type ProductId = (typeof PRODUCTS)[number]["id"];

// 환불·유효기간. 환불은 수동 처리(토스 취소 API 연결은 발표 뒤), 유효기간 소멸 처리도 발표 뒤.
export const REFUND_DAYS = 7;
export const VALID_YEARS = 5;
export const SUPPORT_CONTACT = "문의처(준비 중)"; // 정해지면 이메일 등으로 바꾼다
export const REFUND_NOTICE = `결제 후 ${REFUND_DAYS}일 안에 하나도 쓰지 않았으면 전액 환불해 드려요. 쓴 토큰은 환불되지 않아요. 산 토큰은 ${VALID_YEARS}년 동안 쓸 수 있어요. 환불은 ${SUPPORT_CONTACT}로 요청해 주세요.`;

export const FEATURE_LABEL: Record<string, string> = {
  simulate: "진로 시뮬레이션(1,000번)",
  live_simulate: "AI가 직접 살아 보는 모드",
  premium_report: "프리미엄 리포트",
  talk: "미래의 나와 대화",
};

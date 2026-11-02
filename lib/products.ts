// 토큰 상품(사업계획서 6장: 1토큰 990원, 묶음 할인 없음). 결제 금액은 서버가 이 표로 확인한다.
export const TOKEN_PRICE = 990;
export const PRODUCTS = [
  { id: "t5", tokens: 5, price: 5 * TOKEN_PRICE },
  { id: "t10", tokens: 10, price: 10 * TOKEN_PRICE },
  { id: "t30", tokens: 30, price: 30 * TOKEN_PRICE },
] as const;
export type ProductId = (typeof PRODUCTS)[number]["id"];

export const FEATURE_LABEL: Record<string, string> = {
  simulate: "진로 시뮬레이션 1회",
  premium_report: "프리미엄 리포트",
  talk: "미래의 나와 대화(세계선 1개)",
};

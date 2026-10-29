// 서버·브라우저 공통 숫자 표시
// 만원 단위 금액을 읽기 쉽게: 1240 → "1,240만원", 12400 → "1억 2,400만원"
export function won(n: number) {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(Math.round(n));
  if (a >= 10000) {
    const eok = Math.floor(a / 10000);
    const rest = a % 10000;
    return `${sign}${eok}억${rest ? ` ${rest.toLocaleString("ko-KR")}만` : ""}원`;
  }
  return `${sign}${a.toLocaleString("ko-KR")}만원`;
}

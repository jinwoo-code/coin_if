// 실제 달력. 시뮬레이션은 '다음 달'부터 한 달 단위로 돌고, 화면에는 몇 달씩 묶은 '역'으로 보여 준다.
// 브라우저에서도 쓰므로 서버 전용 코드를 import하지 않는다.

export function nextMonthYm(now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth() + 2; // 다음 달(1~12 기준으로 +1)
  return m > 12 ? `${y + 1}-01` : `${y}-${String(m).padStart(2, "0")}`;
}

// 시작 연월에서 offset개월 뒤의 {연, 월(1~12)}
export function ymAt(startYm: string, offset: number) {
  const [y, m] = startYm.split("-").map(Number);
  const idx = y * 12 + (m - 1) + offset;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function monthLabel(startYm: string, offset: number) {
  const { year, month } = ymAt(startYm, offset);
  return `${year}년 ${month}월`;
}

// 기간이 길수록 역 하나에 더 많은 달을 묶는다.
export function stationSize(months: number) {
  if (months <= 12) return 1;
  if (months <= 36) return 3;
  if (months <= 60) return 6;
  return 12;
}

export function planStations(months: number, startYm: string) {
  const size = stationSize(months);
  const count = Math.ceil(months / size);
  const labels = Array.from({ length: count }, (_, i) => stationLabel(startYm, i * size, size));
  return { size, count, labels };
}

function stationLabel(startYm: string, offset: number, size: number) {
  const a = ymAt(startYm, offset);
  if (size === 1) return `${a.year}년 ${a.month}월`;
  const b = ymAt(startYm, offset + size - 1);
  if (a.year === b.year) return `${a.year}년 ${a.month}~${b.month}월`;
  return `${a.year}년 ${a.month}월~${String(b.year).slice(2)}년 ${b.month}월`;
}

// "보통 몇 달 뒤"를 사람 말로
export function durationLabel(months: number) {
  if (months < 12) return `${months}개월`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y}년 ${m}개월` : `${y}년`;
}

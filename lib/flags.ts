// 기능 플래그. 값이 "1"일 때만 켜진다(빌드할 때 들어가므로 바꾸면 다시 배포). 배포에서는 끄고 개발 환경(.env.local)에서만 켠다.
// 화면에서도 안 보이고, API도 404를 돌려준다. 등장인물별 호출은 기본 켬이고 서버 전용 NPC_AGENTS=0(lib/sim.ts)으로 끈다.
export const FLAGS = {
  checkinMail: process.env.NEXT_PUBLIC_FEATURE_CHECKIN_MAIL === "1", // 체크인 메일(0006 마이그레이션, 메일 키 필요. 켤 때 vercel.json에 crons도 넣기)
  counselor: process.env.NEXT_PUBLIC_FEATURE_COUNSELOR === "1", // 상담사 화면(0006 마이그레이션 필요)
};

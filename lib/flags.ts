// 기능 플래그. 값이 "1"일 때만 켜진다(빌드할 때 들어가므로 바꾸면 다시 배포). 발표 전까지 전부 끈다.
// 화면에서도 안 보이고, API도 404를 돌려준다. 등장인물별 호출은 서버 전용 NPC_AGENTS(lib/sim.ts)로 따로 켠다.
export const FLAGS = {
  checkinMail: process.env.NEXT_PUBLIC_FEATURE_CHECKIN_MAIL === "1", // 체크인 메일(0006 마이그레이션, 메일 키 필요. 켤 때 vercel.json에 crons도 넣기)
  counselor: process.env.NEXT_PUBLIC_FEATURE_COUNSELOR === "1", // 상담사 화면(0006 마이그레이션 필요)
  liveLink: process.env.NEXT_PUBLIC_FEATURE_LIVE_LINK === "1", // 실시간 판단 결과 → 세계선 지도·대화·리포트(유료 키로 30번 확인 전까지 끔)
  liveRefund: process.env.NEXT_PUBLIC_FEATURE_LIVE_REFUND === "1", // 실시간 판단 토큰 돌려주기(실제 DB 확인 전까지 끔)
};

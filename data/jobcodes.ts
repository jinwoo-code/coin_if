// 진로 → 고용24 직업정보 직업코드. 직업 상세(임금 분위·만족도·전망)를 받을 때 쓴다.
// 이름으로 찾으면 엉뚱한 직업이 먼저 나온다(마케터 → 텔레마케터, 개발자 → 통신기술개발자).
// 그래서 2026-10-30 직업정보 검색 결과를 보고 진로마다 가장 가까운 직업 하나를 정해 두었다.
// 여기 없는 진로는 맞는 직업이 없어서(대학원, 공공기관, 창업, 호텔리어, 환경 컨설턴트, 전기 엔지니어) 보여 주지 않는다.
export interface JobCode {
  code: string;
  name: string; // 고용24 직업명
}

export const JOBCODES: Record<string, JobCode> = {
  developer: { code: "K000001176", name: "응용소프트웨어개발자" },
  "civil-servant": { code: "K000000995", name: "일반행정공무원" },
  "data-analyst": { code: "K000001080", name: "데이터분석가(빅데이터분석가)" },
  marketer: { code: "K000001069", name: "광고·홍보·마케팅사무원" },
  "app-dev": { code: "K000001042", name: "모바일앱개발자" },
  security: { code: "K000000832", name: "정보 보안 전문가" },
  "sys-eng": { code: "K000001132", name: "정보 시스템 운영자" },
  "game-dev": { code: "K000007580", name: "게임프로그래머" },
  "mech-eng": { code: "K000000870", name: "플랜트기계공학기술자" },
  "semi-eng": { code: "K000001184", name: "반도체공학 기술자 및 연구원" },
  "chem-eng": { code: "K000000865", name: "석유화학공학기술자 및 연구원" },
  architect: { code: "K000001014", name: "건축가(건축설계사)" },
  "civil-eng": { code: "K000000940", name: "건축시공기술자 및 견적원" },
  "car-tech": { code: "K000001070", name: "자동차 정비원" },
  "food-qc": { code: "K000000970", name: "식품공학 시험원" },
  trainer: { code: "K000000957", name: "스포츠강사 및 트레이너" },
  chef: { code: "K000007538", name: "한식조리사" },
  beauty: { code: "K000007481", name: "미용사" },
  accountant: { code: "K000007487", name: "회계사무원" },
  hr: { code: "K000001196", name: "인사·교육·훈련사무원" },
  sales: { code: "K000001200", name: "영업기획·관리·지원사무원" },
  "trade-log": { code: "K000000918", name: "무역 사무원" },
  banker: { code: "K000001136", name: "은행 사무원" },
  "tax-acct": { code: "K000007525", name: "세무사" },
  "social-worker": { code: "K000000857", name: "사회복지사" },
  "flight-crew": { code: "K000007506", name: "항공기객실승무원" },
  editor: { code: "K000001198", name: "출판물기획자" },
  journalist: { code: "K000000937", name: "신문기자" },
  translator: { code: "K000000824", name: "번역가" },
  pd: { code: "K000001138", name: "방송연출가" },
  "ux-designer": { code: "K000000890", name: "UX/UI디자이너" },
  "visual-designer": { code: "K000001060", name: "시각 디자이너" },
  webtoon: { code: "K000008495", name: "만화가 및 만화영화 작가" },
  fashion: { code: "K000007454", name: "의상디자이너" },
  musician: { code: "K000001181", name: "연주가" },
  "teacher-elem": { code: "K000007558", name: "초등학교교사" },
  "teacher-sec": { code: "K000001065", name: "중·고등학교 교사" },
  tutor: { code: "K000000947", name: "문리학원 강사" },
  childcare: { code: "K000007502", name: "보육교사" },
  nurse: { code: "K000007494", name: "간호사" },
  physio: { code: "K000007501", name: "물리치료사" },
  "clinical-lab": { code: "K000007544", name: "임상병리사" },
  "dental-hyg": { code: "K000000830", name: "치과위생사" },
  radiologist: { code: "K000001017", name: "방사선사" },
  emt: { code: "K000007461", name: "응급구조사" },
  police: { code: "K000007521", name: "경찰관" },
  firefighter: { code: "K000007495", name: "소방관" },
};

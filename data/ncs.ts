// 진로 → NCS 직무(세분류). 고용24 직무정보 API로 '실제로 하는 일'(능력단위)을 찾을 때 쓴다.
// 직무정보 API는 비슷한 말 검색이라 진로 이름으로 찾으면 엉뚱한 직무가 섞인다(브랜드 마케터 → 완구콘텐츠제작).
// 그래서 진로마다 NCS 직무 이름(name)을 정해 두고, 결과에서 이 이름과 똑같은 직무의 능력단위만 남긴다.
// - q: 검색어. 이름으로는 검색이 안 되는 직무가 있어 따로 둔다(예: '응용SW엔지니어링'은 '응용소프트웨어 개발자'로 찾아야 나온다).
// - 2026-10-30 실제 응답에서 능력단위가 나온 이름만 넣었다.
// - 여기 없는 진로는 NCS에 맞는 직무가 없어서(간호사·물리치료사 같은 보건 면허직, 교사, 경찰, 기자, 통번역사, 대학원, 창업 등) 직무를 보여 주지 않는다.
export interface NcsDuty {
  q: string;
  name: string;
}

const same = (...names: string[]): NcsDuty[] => names.map((name) => ({ q: name, name }));

export const NCS: Record<string, NcsDuty[]> = {
  developer: [
    { q: "응용소프트웨어 개발자", name: "응용SW엔지니어링" },
    { q: "웹 개발", name: "응용SW엔지니어링" },
  ],
  "app-dev": [
    { q: "응용소프트웨어 개발자", name: "응용SW엔지니어링" },
    { q: "웹 개발", name: "응용SW엔지니어링" },
  ],
  "civil-servant": same("사무행정"),
  "data-analyst": same("빅데이터분석"),
  marketer: same("마케팅전략기획"),
  security: same("보안엔지니어링"),
  "sys-eng": [
    { q: "시스템 관리", name: "IT시스템관리" },
    { q: "네트워크 엔지니어", name: "NW엔지니어링" },
  ],
  "game-dev": [{ q: "게임개발", name: "게임콘텐츠제작" }],
  "mech-eng": same("기계요소설계", "기계시스템설계"),
  "elec-eng": same("전기설비설계"),
  "semi-eng": same("반도체제조"),
  "chem-eng": same("화학공정유지운영"),
  architect: same("건축설계"),
  "civil-eng": same("건설공사공무관리", "건설공사품질관리"),
  "car-tech": [...same("자동차엔진정비"), { q: "자동차정비", name: "자동차섀시정비" }],
  "food-qc": same("식품품질관리"),
  "env-consult": same("환경영향평가", "대기환경관리"),
  trainer: same("건강운동관리"),
  chef: same("한식조리", "양식조리"),
  beauty: same("헤어미용", "메이크업"),
  accountant: [{ q: "회계감사", name: "회계·감사" }],
  hr: same("인사", "총무"),
  sales: same("유통관리"),
  "trade-log": same("수출입관리", "유통관리"),
  banker: same("창구사무", "여신심사"),
  "tax-acct": same("세무"),
  "pub-office": same("사무행정", "총무"),
  "social-worker": same("사회복지프로그램운영", "사회복지사례관리"),
  hotelier: same("객실관리", "접객서비스"),
  "flight-crew": same("항공객실서비스"),
  editor: same("출판기획", "편집"),
  pd: same("영상연출", "방송콘텐츠제작"),
  "ux-designer": same("디지털디자인"),
  "visual-designer": same("시각디자인"),
  webtoon: same("만화콘텐츠제작"),
  fashion: same("패션디자인"),
  musician: same("음악콘텐츠제작", "실용음악"),
  childcare: same("보육"),
  firefighter: same("구조구급"),
};

// 위기 신호(자해·자살 관련 말) 감지. 미래의 나와 대화(/api/talk)와 이야기 검사(/api/story/extract)가 같이 쓴다.
export const CRISIS_WORDS = ["죽고 싶", "죽고싶", "자살", "자해", "사라지고 싶", "살기 싫"];

export const hasCrisis = (text: string) => CRISIS_WORDS.some((w) => text.includes(w));

// 연락처(대화 답장과 검사 화면 안내에 같이 쓴다)
export const CRISIS_CONTACTS = "자살예방상담전화 109, 정신건강위기상담 1577-0199(24시간), 학교 학생상담센터";

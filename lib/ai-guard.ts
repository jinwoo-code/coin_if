// 리포트 AI 호출 범위. 무료 키는 입력이 구글 서비스 개선에 쓰일 수 있어서, 실제 사람 데이터는 보내지 않는다.
// 시연 인물(가상)만 무료 키로 부른다. 키가 없으면 어차피 generateJSON이 규칙 문장을 돌려준다.
import { isDemoPerson } from "./demo";
import { geminiTier } from "./llm";

export function ruleOnly(person: { name?: string; major?: string }) {
  return geminiTier() === "free" && !isDemoPerson(person);
}

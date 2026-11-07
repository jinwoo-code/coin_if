// 화면 용어를 한 곳에 모은다. 여기만 고치면 화면 전체가 바뀐다(코드 변수명·AI 프롬프트·저장값은 그대로).
// '세계선'을 '갈래 길'로 바꾸려면 T.line 한 줄만 고친다(팀 확정 전이라 기본값은 지금 표현).
import { euro } from "./josa";

const line = "세계선";
const assumed = "우리가 정한 값";

export const T = {
  line,
  lineMap: `${line} 지도`,
  lineHint: "1,000번 중 비슷하게 흘러간 삶을 묶은 것이에요.",
  mainLine: "가장 흔한 길",
  ci: "오차 범위",
  ciDetail: "오차 범위는 95% 신뢰구간(Wilson)이에요.",
  assumed,
  assumedFull: `${assumed}(아직 데이터 없음)`,
  liveMode: "AI가 직접 살아 보는 모드",
} as const;

// 진로 데이터·lib에서 온 글에 든 예전 용어를 화면 용어로 바꾼다. 데이터 파일은 그대로 두고 그릴 때만.
// 괄호 안이나 바로 뒤에 괄호가 오면 '(아직 데이터 없음)'을 또 붙이지 않는다.
export function plain(text: string): string;
export function plain(text: string | null | undefined): string | null | undefined;
export function plain(text: string | null | undefined) {
  if (!text) return text;
  if (text === "가정") return assumed;
  return text
    .replace(/가정값\(팀이 정함\)/g, assumed)
    .replace(/가정값/g, (_, at: number, all: string) => {
      const before = all.slice(0, at);
      const inParen = before.split("(").length > before.split(")").length;
      return inParen || all[at + 3] === "(" ? assumed : T.assumedFull;
    })
    .replace(/세계선 지도/g, T.lineMap)
    .replace(/세계선으로/g, euro(line))
    .replace(/세계선/g, line);
}

// ×1.23 같은 배수를 말로. 경계(±3%, ±25%)는 표현을 고르는 데만 쓰는 값이고, 정확한 배수는 '자세히'에 둔다.
export function multWord(mult: number) {
  if (mult >= 1.25) return "보통보다 유리해요";
  if (mult > 1.03) return "보통보다 조금 유리해요";
  if (mult <= 0.75) return "보통보다 불리해요";
  if (mult < 0.97) return "보통보다 조금 불리해요";
  return "보통과 비슷해요";
}

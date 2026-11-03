// 가중치 한 곳(data/weights.json). 엔진·배수·이야기 값이 여기서 읽는다.
// 민감도 분석(scripts/sensitivity.ts)만 setScale로 하나씩 키우고 줄인다. 배수 k = 1이면 파일 값을 그대로 돌려줘서 결과가 바뀌지 않는다.
import raw from "@/data/weights.json";

export type WeightKind = "add" | "slope" | "share" | "scale" | "mult" | "table" | "options";
export interface Weight {
  label: string; // 화면에 보여 주는 이름
  value: number | number[] | Record<string, number>;
  kind: WeightKind;
  direction: string; // 방향의 근거(문서·연구)
  magnitude: "assumed" | "fitted"; // 크기: 우리가 정한 값 | 파일럿 데이터로 보정한 값
  n?: number; // 보정에 쓴 인원
  ci?: [number, number]; // 보정 95% 구간
  prior?: number; // 보정 전 값(scripts/fit-weights.ts가 남김)
  fittedAt?: string;
  note?: string;
}

export const WEIGHTS = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "_about")) as Record<string, Weight>;

const scales = new Map<string, number>();
export function setScale(key: string, k: number) {
  if (!WEIGHTS[key]) throw new Error(`없는 가중치: ${key}`);
  if (k === 1) scales.delete(key);
  else scales.set(key, k);
}
export const resetScales = () => scales.clear();

// 더하는 값은 k배, 배수는 k제곱(0이면 효과 없음 = 1배)
const apply = (kind: WeightKind, v: number, k: number) => (kind === "mult" || kind === "table" || kind === "options" ? v ** k : v * k);

function get(key: string) {
  const w = WEIGHTS[key];
  if (!w) throw new Error(`없는 가중치: ${key}`);
  return w;
}

export function W(key: string): number {
  const w = get(key);
  const k = scales.get(key);
  return k === undefined ? (w.value as number) : apply(w.kind, w.value as number, k);
}

export function WA(key: string): number[] {
  const w = get(key);
  const k = scales.get(key);
  return k === undefined ? (w.value as number[]) : (w.value as number[]).map((v) => apply(w.kind, v, k));
}

export function WT(key: string): Record<string, number> {
  const w = get(key);
  const k = scales.get(key);
  return k === undefined ? (w.value as Record<string, number>) : Object.fromEntries(Object.entries(w.value as Record<string, number>).map(([n, v]) => [n, apply(w.kind, v, k)]));
}

// 화면용: 가중치 묶음(근거 자료). 준비도는 그 진로가 묻는 질문만.
export function weightGroups(readinessIds: string[]) {
  const keys = Object.keys(WEIGHTS);
  const pick = (re: RegExp) => keys.filter((k) => re.test(k));
  return [
    { title: "선택 규칙(가치관·성격·상태)", keys: pick(/^(decide|value|trait|state)\./) },
    { title: "이야기 값·고친 선택", keys: pick(/^(story|correction)\./) },
    { title: "확률 배수(내 조건)", keys: [...pick(/^factor\./), ...readinessIds.map((id) => `readiness.${id}`).filter((k) => WEIGHTS[k])] },
  ];
}

// 보정값 개수(전체 또는 고른 키)
export function fittedCount(keys: string[] = Object.keys(WEIGHTS)) {
  return keys.filter((k) => WEIGHTS[k].magnitude === "fitted").length;
}

const num = (x: number) => String(Math.round(x * 1000) / 1000);
export function formatWeight(w: Weight) {
  const pre = w.kind === "mult" || w.kind === "options" || w.kind === "table" ? "×" : "";
  if (Array.isArray(w.value)) return w.value.map((v) => pre + num(v)).join(" / ");
  if (typeof w.value === "object")
    return Object.entries(w.value)
      .map(([k, v]) => `${k} ${pre}${num(v)}`)
      .join(" · ");
  return pre + num(w.value);
}

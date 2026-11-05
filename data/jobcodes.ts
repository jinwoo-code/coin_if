// 진로 → 고용24 직업 코드 하나(직업 상세: 임금 분위·만족도·전망을 받을 때). 값은 data/job-codes.json 한 곳에 있다. 코드가 둘이면 첫 번째를 쓴다.
import { ALL_WORLD_IDS, codeName, codesFor } from "@/lib/job-codes";

export interface JobCode {
  code: string;
  name: string; // 고용24 직업명
}

export const JOBCODES: Record<string, JobCode> = Object.fromEntries(
  ALL_WORLD_IDS.flatMap((id) => {
    const code = codesFor(id).work24[0];
    return code ? [[id, { code, name: codeName(code) }]] : [];
  }),
);

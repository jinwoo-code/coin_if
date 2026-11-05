// 리포트는 저장해 둔 목록(data/requirements/{진로id}.json)만 읽는다. 다시 열어도 같은 목록이 나오게 하려고 실시간으로 받지 않는다. 갱신은 scripts/build-requirements.ts.
import type { MajorFamily } from "./job-codes";
import type { Requirements, RequirementsFile } from "./requirements";

export async function requirementsFor(worldId: string, family: MajorFamily | null): Promise<Requirements> {
  const file = (await import(`@/data/requirements/${worldId}.json`)).default as unknown as RequirementsFile;
  return (family && file.byFamily?.[family]) || file.default;
}

// 무료 키 개발용(GEMINI_TIER=free) 호출 간격과 429 재시도. AI 호출을 인자로 받아서 가짜 응답으로 시험할 수 있다(scripts/check-judge.ts).

export const FREE_RPM = 15; // 3.5 Flash-Lite 무료 한도(대시보드 기준 분당 15회, 하루 500회)
export const FREE_GAP_MS = 4500; // 앞 호출이 끝나고 다음 호출까지. 60초 ÷ 4.5초 = 분당 최대 13.3회라 FREE_RPM을 안 넘는다
export const FREE_RETRIES = 3; // 첫 호출 뒤 다시 시도하는 횟수
const DEFAULT_RETRY_MS = 60_000; // 응답에 재시도 시간이 없을 때

const messageOf = (err: unknown) => String((err as Error)?.message ?? err);
export const is429 = (err: unknown) => /"code":\s*429|RESOURCE_EXHAUSTED/.test(messageOf(err));
// 하루 한도는 몇 초 기다려도 안 풀린다
export const isDailyLimit = (err: unknown) => is429(err) && /PerDay/.test(messageOf(err));

// 응답이 알려 주는 재시도 시간. "retry in 1m2.5s" 또는 "retryDelay":"12s"
export function retryDelayMs(err: unknown): number {
  const msg = messageOf(err);
  const a = msg.match(/retry in (?:(\d+)m)?([\d.]+)s/i);
  if (a) return (Number(a[1] ?? 0) * 60 + Number(a[2])) * 1000;
  const b = msg.match(/retryDelay\\?":\s*\\?"([\d.]+)s/);
  if (b) return Number(b[1]) * 1000;
  return DEFAULT_RETRY_MS;
}

export const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 429면 재시도 시간만큼 기다렸다가 다시. 하루 한도와 다른 오류는 바로 던진다.
export async function withRetry429<T>(call: () => Promise<T>, onRetry?: (attempt: number, waitMs: number) => void, sleep = realSleep, retries = FREE_RETRIES, minGapMs = FREE_GAP_MS): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (!is429(err) || isDailyLimit(err) || attempt >= retries) throw err;
      const waitMs = Math.max(retryDelayMs(err), minGapMs);
      onRetry?.(attempt + 1, waitMs);
      await sleep(waitMs);
    }
  }
}

// 한 번에 하나씩, 앞 호출이 끝나고 gapMs 뒤에 다음 호출. 앞 호출이 실패해도 다음은 돈다.
export function makeQueue(gapMs = FREE_GAP_MS, sleep = realSleep) {
  let tail: Promise<unknown> = Promise.resolve();
  let used = false;
  return function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = tail.then(async () => {
      if (used) await sleep(gapMs);
      used = true;
      return job();
    });
    tail = run.catch(() => undefined);
    return run;
  };
}

// 무료 키 여러 개(GEMINI_API_KEY_2~4): 한도에 걸린 키는 쉬게 하고 다음 키로 넘어간다. 값이 아니라 번호만 다룬다.
export const DAILY_REST_MS = 30 * 60_000;
export function makeKeyPool(size: number, now: () => number = Date.now) {
  let active = 0;
  const until = new Map<string, number>();
  return {
    size,
    active: () => active,
    use: (i: number) => void (active = i),
    order: () => Array.from({ length: size }, (_, k) => (active + k) % size), // 지금 키부터
    resting: (i: number, model: string) => (until.get(`${i}|${model}`) ?? 0) > now(),
    rest: (i: number, model: string, ms: number) => void until.set(`${i}|${model}`, now() + ms),
  };
}
export type KeyPool = ReturnType<typeof makeKeyPool>;

// 한 모델을 키를 바꿔 가며 부른다. 키마다 429 재시도를 하고, 하루 한도이거나 재시도가 끝나면 다음 키로. 다른 오류는 바로 던진다.
export async function callWithKeys<T>(pool: KeyPool, model: string, call: (key: number) => Promise<T>, onEvent?: (msg: string) => void, sleep = realSleep): Promise<T> {
  let last: unknown = new Error("쓸 수 있는 키가 없어요");
  for (const key of pool.order()) {
    if (pool.resting(key, model)) continue;
    try {
      const out = await withRetry429(
        () => call(key),
        (attempt, waitMs) => onEvent?.(`${key + 1}번 키 429 → ${(waitMs / 1000).toFixed(1)}초 뒤 다시(${attempt}번째)`),
        sleep,
      );
      pool.use(key);
      return out;
    } catch (err) {
      if (!is429(err)) throw err;
      last = err;
      pool.rest(key, model, isDailyLimit(err) ? DAILY_REST_MS : Math.max(retryDelayMs(err), FREE_GAP_MS));
      onEvent?.(`${key + 1}번 키 한도 → 다음 키`);
    }
  }
  throw last;
}

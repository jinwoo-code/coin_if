// 전체 목업 스위치: 켜면 모든 사용자(심사위원 기기 포함)의 AI 호출이 목업 문장으로 간다.
// 값은 Supabase app_settings('ai_off', 0008). 표가 없거나 읽기에 실패하면 꺼진 것으로 본다(AI 그대로).
// 서버 인스턴스마다 10초 동안 기억한다(호출마다 DB를 안 읽게). 바꾼 인스턴스는 바로 반영.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

let cache: { off: boolean; at: number } | null = null;
const TTL = 10_000;

export async function aiOff(): Promise<boolean> {
  if (cache && Date.now() - cache.at < TTL) return cache.off;
  let off = false;
  try {
    const sb = supabaseAdmin();
    if (sb) {
      const { data, error } = await sb.from("app_settings").select("value").eq("key", "ai_off").maybeSingle();
      off = !error && data?.value === true;
    }
  } catch {
    off = false;
  }
  cache = { off, at: Date.now() };
  return off;
}

// 표가 있는지(0008 적용 여부)까지 같이 알려 준다.
export async function readAiSwitch(): Promise<{ off: boolean; ready: boolean }> {
  const sb = supabaseAdmin();
  if (!sb) return { off: false, ready: false };
  const { data, error } = await sb.from("app_settings").select("value").eq("key", "ai_off").maybeSingle();
  if (error) return { off: false, ready: false };
  return { off: data?.value === true, ready: true };
}

export async function setAiOff(off: boolean, userId: string): Promise<boolean> {
  const sb = supabaseAdmin();
  if (!sb) return false;
  const { error } = await sb.from("app_settings").upsert({ key: "ai_off", value: off, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) return false;
  cache = { off, at: Date.now() };
  return true;
}

// 공유 링크 저장(서버 전용). Supabase 표 shared_reports(0007). e2e는 SHARE_MEMORY=1이면 메모리에 둔다(운영에서는 안 켜진다).
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SHARE_DAYS, type SharedReport } from "./shared-report";
import { supabaseAdmin } from "./supabase/admin";

interface Row {
  token: string;
  user_id: string | null;
  owner_hash: string;
  data: SharedReport;
  expires_at: string;
  revoked_at: string | null;
}
const memoryOn = () => process.env.SHARE_MEMORY === "1" && process.env.NODE_ENV !== "production";
const memory = () => ((globalThis as unknown as { __shares?: Map<string, Row> }).__shares ??= new Map<string, Row>());
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createShare(data: SharedReport, userId: string | null) {
  const token = randomBytes(24).toString("base64url");
  const ownerKey = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + SHARE_DAYS * 86400_000).toISOString();
  const row: Row = { token, user_id: userId, owner_hash: hash(ownerKey), data, expires_at: expires, revoked_at: null };
  if (memoryOn()) {
    memory().set(token, row);
    return { token, ownerKey, expiresAt: expires };
  }
  const admin = supabaseAdmin();
  if (!admin) return null;
  await admin.from("shared_reports").delete().lt("expires_at", new Date().toISOString()); // 만료된 건 지운다
  const { error } = await admin.from("shared_reports").insert(row);
  if (error) {
    console.error("[공유 저장 실패]", error.message);
    return null;
  }
  return { token, ownerKey, expiresAt: expires };
}

// 없거나, 취소됐거나, 만료됐으면 null
export async function readShare(token: string): Promise<{ data: SharedReport; expiresAt: string } | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  let row: Row | null;
  if (memoryOn()) row = memory().get(token) ?? null;
  else {
    const res = await supabaseAdmin()?.from("shared_reports").select("*").eq("token", token).maybeSingle();
    row = (res?.data as Row | null) ?? null;
  }
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { data: row.data, expiresAt: row.expires_at };
}

export async function revokeShare(token: string, ownerKey: string) {
  const now = new Date().toISOString();
  if (memoryOn()) {
    const row = memory().get(token);
    if (!row || row.owner_hash !== hash(ownerKey)) return false;
    row.revoked_at = now;
    return true;
  }
  const res = await supabaseAdmin()?.from("shared_reports").update({ revoked_at: now }).eq("token", token).eq("owner_hash", hash(ownerKey)).select("token");
  return Boolean(res?.data?.length);
}

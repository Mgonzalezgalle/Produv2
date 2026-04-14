import { sb } from "./supabaseClient";

export async function dbGet(key) {
  try {
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

export async function dbSet(key, val) {
  try {
    const { error } = await sb.from("storage").upsert({ key, value: JSON.stringify(val) }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

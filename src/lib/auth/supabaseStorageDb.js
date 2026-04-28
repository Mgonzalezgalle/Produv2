import { sb } from "./supabaseClient";

function parseStoredValue(key, rawValue) {
  try {
    return {
      ok: true,
      value: JSON.parse(rawValue),
    };
  } catch (error) {
    console.error("[lab-storage] No pudimos parsear el valor persistido", { key, error });
    return {
      ok: false,
      value: null,
      errorType: "parse_error",
      error,
    };
  }
}

export async function dbGetDetailed(key) {
  try {
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error) {
      console.error("[lab-storage] Error leyendo storage", { key, error });
      return {
        ok: false,
        exists: false,
        value: null,
        errorType: "read_error",
        error,
      };
    }
    if (!data) {
      return {
        ok: true,
        exists: false,
        value: null,
      };
    }
    const parsed = parseStoredValue(key, data.value);
    return {
      exists: true,
      ...parsed,
    };
  } catch (error) {
    console.error("[lab-storage] Excepción leyendo storage", { key, error });
    return {
      ok: false,
      exists: false,
      value: null,
      errorType: "read_exception",
      error,
    };
  }
}

export async function dbGet(key) {
  const result = await dbGetDetailed(key);
  return result.ok ? result.value : null;
}

export async function dbSetDetailed(key, val) {
  try {
    const { error } = await sb.from("storage").upsert({ key, value: JSON.stringify(val) }, { onConflict: "key" });
    if (error) {
      console.error("[lab-storage] Error guardando storage", { key, error });
      return {
        ok: false,
        value: val,
        errorType: "write_error",
        error,
      };
    }
    return {
      ok: true,
      value: val,
    };
  } catch (error) {
    console.error("[lab-storage] Excepción guardando storage", { key, error });
    return {
      ok: false,
      value: val,
      errorType: "write_exception",
      error,
    };
  }
}

export async function dbSet(key, val) {
  const result = await dbSetDetailed(key, val);
  return result.ok;
}

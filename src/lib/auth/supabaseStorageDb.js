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

let legacyStorageRpcAvailability = "unknown";

function shouldTryLegacyStorageRpc() {
  return legacyStorageRpcAvailability !== "unavailable";
}

function markLegacyStorageRpcAvailable() {
  legacyStorageRpcAvailability = "available";
}

function markLegacyStorageRpcUnavailable() {
  legacyStorageRpcAvailability = "unavailable";
}

async function readViaLegacyStorageRpc(key) {
  const { data, error } = await sb.rpc("get_legacy_storage_item", { p_key: key });
  if (error) throw error;
  markLegacyStorageRpcAvailable();
  return {
    ok: true,
    exists: data?.exists === true,
    value: data?.value ?? null,
  };
}

async function writeViaLegacyStorageRpc(key, rawValue) {
  const { data, error } = await sb.rpc("upsert_legacy_storage_item", {
    p_key: key,
    p_value: rawValue,
  });
  if (error) throw error;
  markLegacyStorageRpcAvailable();
  return {
    ok: data?.ok === true,
    value: rawValue,
  };
}

export async function dbGetDetailed(key) {
  try {
    if (shouldTryLegacyStorageRpc()) {
      try {
        const rpcResult = await readViaLegacyStorageRpc(key);
        if (!rpcResult.exists) {
          return {
            ok: true,
            exists: false,
            value: null,
          };
        }
        const parsed = parseStoredValue(key, rpcResult.value);
        return {
          exists: true,
          ...parsed,
        };
      } catch (rpcError) {
        markLegacyStorageRpcUnavailable();
        console.warn("[lab-storage] RPC de lectura no disponible, usamos fallback directo", { key, error: rpcError?.message || String(rpcError || "") });
      }
    }
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
    const rawValue = JSON.stringify(val);
    if (shouldTryLegacyStorageRpc()) {
      try {
        return await writeViaLegacyStorageRpc(key, rawValue);
      } catch (rpcError) {
        markLegacyStorageRpcUnavailable();
        console.warn("[lab-storage] RPC de escritura no disponible, usamos fallback directo", { key, error: rpcError?.message || String(rpcError || "") });
      }
    }
    const { error } = await sb.from("storage").upsert({ key, value: rawValue }, { onConflict: "key" });
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

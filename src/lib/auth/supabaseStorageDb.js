import { fallbackSb, sb, supabaseUsingFallback } from "./supabaseClient";

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

// RLS intentionally hides public.storage from anon direct reads; the RPC is the supported read path.
let legacyStorageReadRpcAvailability = "preferred";
let legacyStorageWriteRpcAvailability = "unknown";

function isLegacyStorageRpcUnavailableError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || message.includes("could not find the function");
}

function shouldRetryWithFallbackClient(error) {
  if (supabaseUsingFallback) return false;
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").trim().toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return status === 401
    || code === "401"
    || code === "invalid_api_key"
    || message.includes("invalid api key")
    || message.includes("unauthorized");
}

function shouldTryLegacyStorageRpc() {
  return legacyStorageReadRpcAvailability === "preferred" || legacyStorageReadRpcAvailability === "available";
}

function shouldFallbackToLegacyStorageRpc() {
  return legacyStorageReadRpcAvailability !== "unavailable";
}

function markLegacyStorageRpcAvailable() {
  legacyStorageReadRpcAvailability = "available";
}

function markLegacyStorageRpcUnavailable() {
  legacyStorageReadRpcAvailability = "unavailable";
}

function shouldTryLegacyStorageWriteRpc() {
  return legacyStorageWriteRpcAvailability !== "unavailable";
}

function markLegacyStorageWriteRpcAvailable() {
  legacyStorageWriteRpcAvailability = "available";
}

function markLegacyStorageWriteRpcUnavailable() {
  legacyStorageWriteRpcAvailability = "unavailable";
}

async function readViaLegacyStorageRpc(key, client = sb) {
  const { data, error } = await client.rpc("get_legacy_storage_item", { p_key: key });
  if (error) throw error;
  markLegacyStorageRpcAvailable();
  return {
    ok: true,
    exists: data?.exists === true,
    value: data?.value ?? null,
  };
}

async function writeViaLegacyStorageRpc(key, rawValue, client = sb) {
  const { data, error } = await client.rpc("upsert_legacy_storage_item", {
    p_key: key,
    p_value: rawValue,
  });
  if (error) throw error;
  markLegacyStorageWriteRpcAvailable();
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
        if (shouldRetryWithFallbackClient(rpcError)) {
          const rpcResult = await readViaLegacyStorageRpc(key, fallbackSb);
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
        }
        if (isLegacyStorageRpcUnavailableError(rpcError)) {
          markLegacyStorageRpcUnavailable();
          console.warn("[lab-storage] RPC de lectura no disponible, usamos fallback directo", { key, error: rpcError?.message || String(rpcError || "") });
        } else {
          console.error("[lab-storage] RPC de lectura falló", { key, error: rpcError });
          return {
            ok: false,
            exists: false,
            value: null,
            errorType: "rpc_read_error",
            error: rpcError,
          };
        }
      }
    }
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error) {
      if (shouldFallbackToLegacyStorageRpc()) {
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
          if (shouldRetryWithFallbackClient(rpcError)) {
            const rpcResult = await readViaLegacyStorageRpc(key, fallbackSb);
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
          }
          if (isLegacyStorageRpcUnavailableError(rpcError)) {
            markLegacyStorageRpcUnavailable();
          } else {
            console.error("[lab-storage] Fallback RPC de lectura falló", { key, error: rpcError });
          }
        }
      }
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
    if (shouldTryLegacyStorageWriteRpc()) {
      try {
        return await writeViaLegacyStorageRpc(key, rawValue);
      } catch (rpcError) {
        if (shouldRetryWithFallbackClient(rpcError)) {
          return await writeViaLegacyStorageRpc(key, rawValue, fallbackSb);
        }
        if (isLegacyStorageRpcUnavailableError(rpcError)) {
          markLegacyStorageWriteRpcUnavailable();
          console.warn("[lab-storage] RPC de escritura no disponible, intentaremos fallback directo", { key, error: rpcError?.message || String(rpcError || "") });
        } else {
          console.error("[lab-storage] RPC de escritura falló", { key, error: rpcError });
          return {
            ok: false,
            value: val,
            errorType: "rpc_write_error",
            error: rpcError,
          };
        }
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

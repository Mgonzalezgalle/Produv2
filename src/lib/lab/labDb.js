import { LAB_DATA_CONFIG, labStorageKey, prodStorageKey } from "./labStorageConfig";

let supabaseStoragePromise = null;

async function loadSupabaseStorageDb() {
  if (!supabaseStoragePromise) {
    supabaseStoragePromise = import("../auth/supabaseStorageDb");
  }
  return supabaseStoragePromise;
}

async function readStorage(key) {
  const { dbGet } = await loadSupabaseStorageDb();
  return dbGet(key);
}

async function writeStorage(key, value) {
  const { dbSet } = await loadSupabaseStorageDb();
  return dbSet(key, value);
}

export function createLabDb() {
  const dbGet = key => readStorage(labStorageKey(key));

  const dbSet = async (key, val) => {
    const resolved = typeof val === "function" ? await val(await dbGet(key)) : val;
    return writeStorage(labStorageKey(key), resolved);
  };

  const dbCloneFromProd = async (key, fallback = null) => {
    if (!LAB_DATA_CONFIG.cloneProdOnBoot) return fallback;
    const data = await readStorage(prodStorageKey(key));
    if (data !== null) await dbSet(key, data);
    return data !== null ? data : fallback;
  };

  return { dbGet, dbSet, dbCloneFromProd };
}

export const { dbGet, dbSet, dbCloneFromProd } = createLabDb();

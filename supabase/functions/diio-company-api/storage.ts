import { type SupabaseServiceRoleClient } from "../_shared/supabaseClient.ts";
import { firstString } from "./mapping.ts";

type StorageTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data?: { value?: unknown } | null; error?: unknown }>;
    };
  };
  upsert: (value: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error?: unknown }>;
};

type EnvReader = (key: string) => string | undefined;

function storageTable(client: SupabaseServiceRoleClient): StorageTable {
  return client.from("storage") as unknown as StorageTable;
}

export function resolveStorageNamespace(getEnv: EnvReader = (key) => Deno.env.get(key)) {
  return firstString(
    getEnv("APP_STORAGE_NAMESPACE"),
    getEnv("LAB_STORAGE_NAMESPACE"),
    "produ-lab",
  );
}

export function getEmpresasStorageKey(getEnv?: EnvReader) {
  return `${resolveStorageNamespace(getEnv)}:produ:empresas`;
}

export function getIncomingStorageKey(tenantId = "", getEnv?: EnvReader) {
  return `${resolveStorageNamespace(getEnv)}:produ:diio:${tenantId || "global"}:incoming`;
}

export async function loadStorageJson(client: SupabaseServiceRoleClient, key: string) {
  const { data, error } = await storageTable(client).select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  try {
    return JSON.parse(String(data.value));
  } catch {
    return null;
  }
}

export async function saveStorageJson(client: SupabaseServiceRoleClient, key: string, value: unknown) {
  const { error } = await storageTable(client).upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
  if (error) throw error;
}

export function upsertQueue(records: Record<string, unknown>[] = [], interaction: Record<string, unknown> = {}) {
  const current = Array.isArray(records) ? records : [];
  const sourceId = firstString(interaction.sourceId, interaction.id);
  const existingIndex = current.findIndex((item) =>
    firstString(item?.id, item?.sourceId) === firstString(interaction.id, sourceId) ||
    (sourceId && firstString(item?.sourceId) === sourceId)
  );
  if (existingIndex < 0) return [interaction, ...current];
  return current.map((item, index) => {
    if (index !== existingIndex) return item;
    const existingStatus = firstString(item?.matchStatus);
    const nextStatus = firstString(interaction?.matchStatus);
    const preserveConfirmed = existingStatus === "confirmed" && nextStatus !== "confirmed";
    return {
      ...item,
      ...interaction,
      matchStatus: preserveConfirmed ? existingStatus : (nextStatus || existingStatus || "pending"),
      entityType: firstString(item?.entityType) || firstString(interaction?.entityType),
      entityId: firstString(item?.entityId) || firstString(interaction?.entityId),
      entityLabel: firstString(item?.entityLabel) || firstString(interaction?.entityLabel),
      matchConfidence: preserveConfirmed
        ? Number(item?.matchConfidence || interaction?.matchConfidence || 0)
        : Number(interaction?.matchConfidence || item?.matchConfidence || 0),
      confirmedAt: preserveConfirmed ? firstString(item?.confirmedAt, interaction?.confirmedAt) : firstString(interaction?.confirmedAt, item?.confirmedAt),
    };
  });
}

export async function loadEmpresas(client: SupabaseServiceRoleClient) {
  const parsed = await loadStorageJson(client, getEmpresasStorageKey());
  return Array.isArray(parsed) ? parsed : [];
}

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, DO-Signature, DO-Timestamp",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function firstString(...values: unknown[]) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function resolveStorageNamespace() {
  return firstString(
    Deno.env.get("APP_STORAGE_NAMESPACE"),
    Deno.env.get("LAB_STORAGE_NAMESPACE"),
    "produ-lab",
  );
}

function getEmpresasStorageKey() {
  return `${resolveStorageNamespace()}:produ:empresas`;
}

function getIncomingStorageKey(tenantId = "") {
  return `${resolveStorageNamespace()}:produ:diio:${tenantId || "global"}:incoming`;
}

function normalizeCommitments(items: unknown[] = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title } : null;
      }
      if (item && typeof item === "object") {
        const source = item as Record<string, unknown>;
        const title = firstString(source.title, source.text, source.value, source.description);
        if (!title) return null;
        const user = source.user && typeof source.user === "object"
          ? source.user as Record<string, unknown>
          : null;
        return {
          id: firstString(source.id),
          title,
          deadline: firstString(source.deadline, source.due_date, source.dueDate),
          done: source.done === true,
          user: user
            ? {
                id: firstString(user.id),
                name: firstString(user.name),
                email: firstString(user.email),
              }
            : null,
          createdAt: firstString(source.created_at, source.createdAt),
          updatedAt: firstString(source.updated_at, source.updatedAt),
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeParticipants(items: unknown[] = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      return {
        name: firstString(source.name, source.full_name),
        email: firstString(source.email),
        phone: firstString(source.phone),
        role: firstString(source.role),
        userId: firstString(source.user_id, source.userId),
        show: source.show === true,
        speakTime: Number(source.speak_time || source.speakTime || 0),
        arriveTime: firstString(source.arrive_time, source.arriveTime),
      };
    })
    .filter((item) => item && (item.name || item.email || item.phone || item.userId));
}

function normalizeTrackerValues(value: unknown = {}) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).map(([key, raw]) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return {
        key,
        ...(raw as Record<string, unknown>),
      };
    }
    return { key, value: raw };
  });
}

function normalizePlaybook(value: unknown = null) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
}

function trackerSummary(trackerValues: unknown[] = []) {
  const summaryEntry = (Array.isArray(trackerValues) ? trackerValues : []).find((item) => {
    if (!item || typeof item !== "object") return false;
    const source = item as Record<string, unknown>;
    return firstString(source.key, source.name, source.label).toLowerCase() === "summary";
  }) as Record<string, unknown> | undefined;
  return firstString(summaryEntry?.value, summaryEntry?.text, summaryEntry?.description, summaryEntry?.answer);
}

function normalizeTranscript(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const source = item as Record<string, unknown>;
          const speaker = firstString(source.speaker);
          const text = firstString(source.text, source.content, source.body, source.value);
          if (!text) return "";
          return speaker ? `${speaker}: ${text}` : text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return firstString(source.text, source.content, source.body, source.value);
  }
  return "";
}

function normalizeDiioEvent(payload: Record<string, unknown> = {}, tenantId = "") {
  const event = firstString(payload.event, payload.type, payload.event_type);
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
  const trackerValues = normalizeTrackerValues(data.tracker_values || data.trackerValues || {});
  const playbook = normalizePlaybook(data.playbook);
  const attendees = data.attendees && typeof data.attendees === "object" ? data.attendees as Record<string, unknown> : {};
  const attendeeList = [
    ...(Array.isArray(attendees.sellers) ? attendees.sellers as Record<string, unknown>[] : []),
    ...(Array.isArray(attendees.support) ? attendees.support as Record<string, unknown>[] : []),
    ...(Array.isArray(attendees.customers) ? attendees.customers as Record<string, unknown>[] : []),
  ];
  return {
    id: `diio_${firstString(data.id, payload.id, payload.webhook_object_id) || crypto.randomUUID()}`,
    tenantId,
    sourceId: firstString(data.id, payload.id, payload.webhook_object_id),
    sourceType: event || "meeting.finished",
    sourceUrl: firstString(data.url, data.recording_url, payload.url),
    recordedAt: firstString(data.ended_at, data.created_at, payload.created_at, new Date().toISOString()),
    title: firstString(data.title, data.name, data.subject, payload.title),
    summary: firstString(trackerSummary(trackerValues), data.summary, data.meeting_summary, data.notes, data.transcript_summary, payload.summary),
    transcript: firstString(
      normalizeTranscript(data.transcript),
      normalizeTranscript(data.transcription),
      normalizeTranscript(data.transcript_text),
      normalizeTranscript(data.transcriptText),
      normalizeTranscript(data.notes),
    ),
    commitments: normalizeCommitments(Array.isArray(data.commitments) ? data.commitments : []),
    trackerValues,
    playbook,
    participants: normalizeParticipants(Array.isArray(data.participants) ? data.participants : attendeeList),
    rawPayload: payload,
    matchStatus: "pending",
  };
}

function normalizeTenantDiioConfig(config: Record<string, unknown> = {}) {
  return {
    status: firstString(config.status, config.connected ? "connected" : "disconnected") || "disconnected",
    workspaceLabel: firstString(config.workspaceLabel, config.companyLabel),
    workspaceId: firstString(config.workspaceId),
    adminEmail: firstString(config.adminEmail),
    clientId: firstString(config.clientId),
    clientSecret: firstString(config.clientSecret),
    refreshToken: firstString(config.refreshToken),
    webhookId: firstString(config.webhookId),
    webhookSecret: firstString(config.webhookSecret),
    connected: config.connected === true || firstString(config.status) === "connected",
    connectedAt: firstString(config.connectedAt),
    lastValidatedAt: firstString(config.lastValidatedAt),
    lastImportedAt: firstString(config.lastImportedAt),
    lastImportCount: Number(config.lastImportCount || 0),
    lastImportQueueSize: Number(config.lastImportQueueSize || 0),
    lastWebhookAt: firstString(config.lastWebhookAt),
    lastWebhookEvent: firstString(config.lastWebhookEvent),
    lastWebhookObjectId: firstString(config.lastWebhookObjectId),
    lastError: firstString(config.lastError),
  };
}

function resolveTenantDiioConfig(
  empresas: Record<string, unknown>[] = [],
  {
    tenantId = "",
    tenantCode = "",
    workspaceId = "",
    webhookId = "",
  }: {
    tenantId?: string;
    tenantCode?: string;
    workspaceId?: string;
    webhookId?: string;
  } = {},
) {
  const safeTenantId = firstString(tenantId);
  const safeTenantCode = firstString(tenantCode);
  const safeWorkspaceId = firstString(workspaceId);
  const safeWebhookId = firstString(webhookId);
  const empresa = (Array.isArray(empresas) ? empresas : []).find((item) => {
    const integrationConfigs = item?.integrationConfigs && typeof item.integrationConfigs === "object"
      ? item.integrationConfigs as Record<string, unknown>
      : {};
    const diio = integrationConfigs.diio && typeof integrationConfigs.diio === "object"
      ? integrationConfigs.diio as Record<string, unknown>
      : {};
    const tenant = normalizeTenantDiioConfig(diio.tenant && typeof diio.tenant === "object" ? diio.tenant as Record<string, unknown> : {});
    return (
      (safeTenantId && firstString(item.id) === safeTenantId) ||
      (safeTenantCode && firstString(item.tenantCode) === safeTenantCode) ||
      (safeWorkspaceId && tenant.workspaceId === safeWorkspaceId) ||
      (safeWebhookId && tenant.webhookId === safeWebhookId)
    );
  }) || null;

  if (!empresa) return { empresa: null, tenantDiio: normalizeTenantDiioConfig({}) };

  const integrationConfigs = empresa?.integrationConfigs && typeof empresa.integrationConfigs === "object"
    ? empresa.integrationConfigs as Record<string, unknown>
    : {};
  const diio = integrationConfigs.diio && typeof integrationConfigs.diio === "object"
    ? integrationConfigs.diio as Record<string, unknown>
    : {};
  return {
    empresa,
    tenantDiio: normalizeTenantDiioConfig(diio.tenant && typeof diio.tenant === "object" ? diio.tenant as Record<string, unknown> : {}),
  };
}

function timingSafeEqualHex(a = "", b = "") {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadStorageJson(client: ReturnType<typeof createClient>, key: string) {
  const { data, error } = await client.from("storage").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  try {
    return JSON.parse(String(data.value));
  } catch {
    return null;
  }
}

async function loadQueue(client: ReturnType<typeof createClient>, key: string) {
  const parsed = await loadStorageJson(client, key);
  return Array.isArray(parsed) ? parsed : [];
}

async function loadEmpresas(client: ReturnType<typeof createClient>) {
  const parsed = await loadStorageJson(client, getEmpresasStorageKey());
  return Array.isArray(parsed) ? parsed : [];
}

function upsertQueue(records: Record<string, unknown>[] = [], interaction: Record<string, unknown> = {}) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const echoString = String(url.searchParams.get("echo_string") || "").trim();
  if (req.method === "GET" && echoString) {
    return new Response(echoString, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const rawBody = await req.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return json({ ok: false, error: "invalid_json", message: "El webhook Diio no trae JSON válido." }, 400);
  }

  const supabaseUrl = firstString(Deno.env.get("SUPABASE_URL"));
  const supabaseServiceRoleKey = firstString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const timestampHeader = String(req.headers.get("DO-Timestamp") || "").trim();
  const signatureHeader = String(req.headers.get("DO-Signature") || "").trim();
  const tenantIdFromUrl = String(url.searchParams.get("tenantId") || "").trim();
  const tenantCodeFromUrl = String(url.searchParams.get("tenantCode") || "").trim();
  const tenantIdFromPayload = firstString(payload.tenantId, payload.tenant_id, payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>).tenantId : "");
  const tenantCodeFromPayload = firstString(payload.tenantCode, payload.tenant_code, payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>).tenantCode : "");
  const workspaceIdFromPayload = firstString(
    payload.workspace_id,
    payload.workspaceId,
    payload.company_id,
    payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>).workspace_id : "",
  );
  const webhookIdFromPayload = firstString(payload.webhook_id, payload.webhookId);

  let tenantId = firstString(tenantIdFromUrl, tenantIdFromPayload);

  if (supabaseUrl && supabaseServiceRoleKey) {
    try {
      const client = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
      const empresas = await loadEmpresas(client);
      const { empresa, tenantDiio } = resolveTenantDiioConfig(empresas, {
        tenantId,
        tenantCode: firstString(tenantCodeFromUrl, tenantCodeFromPayload),
        workspaceId: workspaceIdFromPayload,
        webhookId: webhookIdFromPayload,
      });

      tenantId = firstString(tenantId, empresa?.id);

      const signatureSecret = firstString(tenantDiio.webhookSecret, Deno.env.get("DIIO_WEBHOOK_SECRET"));
      if (signatureSecret) {
        if (!timestampHeader || !signatureHeader) {
          return json({ ok: false, error: "missing_signature", message: "Faltan headers de firma Diio." }, 401);
        }
        const webhookObjectId = firstString(payload.webhook_object_id, payload.id, payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>).id : "");
        const signedValue = `${webhookObjectId}-${timestampHeader}`;
        const computed = await hmacSha256Hex(signatureSecret, signedValue);
        if (!timingSafeEqualHex(computed, signatureHeader)) {
          return json({ ok: false, error: "invalid_signature", message: "La firma Diio no coincide." }, 401);
        }
      }

      const interaction = normalizeDiioEvent(payload, tenantId);
      const storageKey = getIncomingStorageKey(tenantId);
      const currentQueue = await loadQueue(client, storageKey);
      const nextQueue = upsertQueue(currentQueue, interaction);
      const { error } = await client.from("storage").upsert({ key: storageKey, value: JSON.stringify(nextQueue) }, { onConflict: "key" });
      if (error) {
        return json({ ok: false, error: "storage_write_failed", message: "No pudimos persistir la interacción Diio.", details: error.message }, 500);
      }

      if (empresa) {
        const webhookAt = new Date().toISOString();
        const nextEmpresas = empresas.map((item) => {
          if (firstString(item?.id) !== firstString(empresa?.id)) return item;
          const integrationConfigs = item?.integrationConfigs && typeof item.integrationConfigs === "object"
            ? item.integrationConfigs as Record<string, unknown>
            : {};
          const diio = integrationConfigs.diio && typeof integrationConfigs.diio === "object"
            ? integrationConfigs.diio as Record<string, unknown>
            : {};
          const currentTenant = diio.tenant && typeof diio.tenant === "object"
            ? diio.tenant as Record<string, unknown>
            : tenantDiio;
          return {
            ...item,
            integrationConfigs: {
              ...integrationConfigs,
              diio: {
                ...diio,
                tenant: {
                  ...normalizeTenantDiioConfig(currentTenant),
                  lastWebhookAt: webhookAt,
                  lastWebhookEvent: firstString(payload.event, payload.type, payload.event_type),
                  lastWebhookObjectId: firstString(payload.webhook_object_id, payload.id, interaction.sourceId),
                  lastError: "",
                },
              },
            },
          };
        });
        const { error: tenantStateError } = await client.from("storage").upsert({
          key: getEmpresasStorageKey(),
          value: JSON.stringify(nextEmpresas),
        }, { onConflict: "key" });
        if (tenantStateError) {
          return json({ ok: false, error: "tenant_update_failed", message: "Persistimos la interacción, pero no el estado operativo Diio.", details: tenantStateError.message }, 500);
        }
      }

      return json({
        ok: true,
        source: "remote",
        provider: "diio",
        tenantId,
        tenantName: firstString(empresa?.nombre),
        interaction,
      });
    } catch (error) {
      return json({
        ok: false,
        error: "storage_exception",
        message: "Falló la persistencia de la interacción Diio.",
        details: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  }

  const interaction = normalizeDiioEvent(payload, tenantId);
  return json({
    ok: true,
    source: "remote",
    provider: "diio",
    tenantId,
    interaction,
  });
});

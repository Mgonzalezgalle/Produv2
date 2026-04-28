import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function normalizeCompanyUrl(value: unknown) {
  const raw = firstString(value);
  if (!raw) return "";
  try {
    const safe = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
    const parsed = new URL(safe);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw.replace(/\/+$/, "");
  }
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

async function saveStorageJson(client: ReturnType<typeof createClient>, key: string, value: unknown) {
  const { error } = await client.from("storage").upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
  if (error) throw error;
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

async function loadEmpresas(client: ReturnType<typeof createClient>) {
  const parsed = await loadStorageJson(client, getEmpresasStorageKey());
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeTenantDiioConfig(config: Record<string, unknown> = {}) {
  return {
    status: firstString(config.status) || "disconnected",
    workspaceLabel: firstString(config.workspaceLabel, config.companyLabel),
    companyUrl: normalizeCompanyUrl(config.companyUrl || config.baseUrl || config.workspaceUrl),
    workspaceId: firstString(config.workspaceId),
    adminEmail: firstString(config.adminEmail),
    clientId: firstString(config.clientId),
    clientSecret: firstString(config.clientSecret),
    refreshToken: firstString(config.refreshToken),
    webhookId: firstString(config.webhookId),
    webhookSecret: firstString(config.webhookSecret),
    connected: config.connected === true,
    connectedAt: firstString(config.connectedAt),
    lastValidatedAt: firstString(config.lastValidatedAt),
    lastImportedAt: firstString(config.lastImportedAt),
    lastImportCount: Number(config.lastImportCount || 0),
    lastImportQueueSize: Number(config.lastImportQueueSize || 0),
    lastWebhookAt: firstString(config.lastWebhookAt),
    lastWebhookEvent: firstString(config.lastWebhookEvent),
    lastWebhookObjectId: firstString(config.lastWebhookObjectId),
    lastError: firstString(config.lastError),
    notes: firstString(config.notes),
  };
}

function resolveTenant(empresas: Record<string, unknown>[] = [], tenantId = "") {
  const empresa = (Array.isArray(empresas) ? empresas : []).find((item) => firstString(item?.id) === firstString(tenantId));
  if (!empresa) return { empresa: null, tenantDiio: normalizeTenantDiioConfig({}) };
  const integrationConfigs = empresa?.integrationConfigs && typeof empresa.integrationConfigs === "object"
    ? empresa.integrationConfigs as Record<string, unknown>
    : {};
  const diio = integrationConfigs.diio && typeof integrationConfigs.diio === "object"
    ? integrationConfigs.diio as Record<string, unknown>
    : {};
  const tenant = diio.tenant && typeof diio.tenant === "object"
    ? normalizeTenantDiioConfig(diio.tenant as Record<string, unknown>)
    : normalizeTenantDiioConfig({});
  return { empresa, tenantDiio: tenant };
}

async function refreshAccessToken({
  companyUrl,
  clientId,
  clientSecret,
  refreshToken,
}: {
  companyUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const response = await fetch(`${companyUrl}/api/external/refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const accessToken = firstString(parsed?.access_token);
  return {
    ok: response.ok && Boolean(accessToken),
    status: response.status,
    accessToken,
    raw,
    parsed,
  };
}

async function listMeetings(companyUrl: string, accessToken: string, page = 1, limit = 10) {
  const response = await fetch(`${companyUrl}/api/external/v1/meetings?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

async function listAllMeetings(companyUrl: string, accessToken: string) {
  const allMeetings: Record<string, unknown>[] = [];
  let page = 1;
  const limit = 100;
  const maxPages = 20;
  let lastResponse: { ok: boolean; status: number; raw: string; parsed: Record<string, unknown> | null } | null = null;

  while (page <= maxPages) {
    const current = await listMeetings(companyUrl, accessToken, page, limit);
    lastResponse = current;
    if (!current.ok) return { ...current, meetings: allMeetings };
    const currentMeetings = Array.isArray(current.parsed?.meetings) ? current.parsed.meetings as Record<string, unknown>[] : [];
    allMeetings.push(...currentMeetings);
    const nextPage = Number(current.parsed?.next || 0);
    if (!nextPage || currentMeetings.length < limit) {
      return { ...current, meetings: allMeetings };
    }
    page = nextPage;
  }

  return {
    ok: true,
    status: lastResponse?.status || 200,
    raw: lastResponse?.raw || "",
    parsed: lastResponse?.parsed || { meetings: allMeetings },
    meetings: allMeetings,
  };
}

async function getMeetingDetail(companyUrl: string, accessToken: string, meetingId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/meetings/${encodeURIComponent(meetingId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

async function getTranscriptDetail(companyUrl: string, accessToken: string, transcriptId: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/transcripts/${encodeURIComponent(transcriptId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

async function listUsers(companyUrl: string, accessToken: string) {
  const response = await fetch(`${companyUrl}/api/external/v1/users?page=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const raw = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    raw,
    parsed,
  };
}

async function listAllUsers(companyUrl: string, accessToken: string) {
  const allUsers: Record<string, unknown>[] = [];
  let page = 1;
  const maxPages = 20;
  let lastResponse: { ok: boolean; status: number; raw: string; parsed: Record<string, unknown> | null } | null = null;

  while (page <= maxPages) {
    const response = await fetch(`${companyUrl}/api/external/v1/users?page=${page}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const raw = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const current = {
      ok: response.ok,
      status: response.status,
      raw,
      parsed,
    };
    lastResponse = current;
    if (!current.ok) return { ...current, users: allUsers };
    const currentUsers = Array.isArray(parsed?.users) ? parsed.users as Record<string, unknown>[] : [];
    allUsers.push(...currentUsers);
    if (currentUsers.length < 10) {
      return { ...current, users: allUsers };
    }
    page += 1;
  }

  return {
    ok: true,
    status: lastResponse?.status || 200,
    raw: lastResponse?.raw || "",
    parsed: lastResponse?.parsed || { users: allUsers },
    users: allUsers,
  };
}

function normalizePlaybookSummary(items: unknown[] = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const source = item as Record<string, unknown>;
        return firstString(
          source.title,
          source.name,
          source.label,
          source.question,
          source.answer,
          source.text,
          source.value,
          source.description,
        );
      }
      return "";
    })
    .filter(Boolean)
    .join(" · ");
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

function trackerSummary(trackerValues: unknown = {}) {
  const normalized = Array.isArray(trackerValues)
    ? trackerValues
    : trackerValues && typeof trackerValues === "object"
      ? Object.entries(trackerValues as Record<string, unknown>).map(([key, raw]) => {
          if (raw && typeof raw === "object" && !Array.isArray(raw)) {
            return { key, ...(raw as Record<string, unknown>) };
          }
          return { key, value: raw };
        })
      : [];
  const summaryEntry = normalized.find((item) => {
    if (!item || typeof item !== "object") return false;
    const source = item as Record<string, unknown>;
    return firstString(source.key, source.name, source.label).toLowerCase() === "summary";
  }) as Record<string, unknown> | undefined;
  return firstString(summaryEntry?.value, summaryEntry?.text, summaryEntry?.description, summaryEntry?.answer);
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

function buildUsersIndex(items: unknown[] = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    if (!item || typeof item !== "object") return acc;
    const source = item as Record<string, unknown>;
    const id = firstString(source.id);
    if (!id) return acc;
    acc[id] = {
      id,
      name: firstString(source.name),
      email: firstString(source.email),
    };
    return acc;
  }, {} as Record<string, { id: string; name: string; email: string }>);
}

function normalizeParticipants(items: unknown[] = [], usersIndex: Record<string, { id: string; name: string; email: string }> = {}) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const userId = firstString(source.user_id, source.userId);
      const user = userId ? usersIndex[userId] : null;
      return {
        name: firstString(source.name, source.full_name, user?.name),
        email: firstString(source.email, user?.email),
        phone: firstString(source.phone),
        role: firstString(source.role),
        userId,
        show: source.show === true,
        speakTime: Number(source.speak_time || source.speakTime || 0),
        arriveTime: firstString(source.arrive_time, source.arriveTime),
      };
    })
    .filter((item) => item && (item.name || item.email || item.phone || item.userId));
}

function normalizeMeetingToInteraction(meeting: Record<string, unknown> = {}, tenantId = "", companyUrl = "", usersIndex: Record<string, { id: string; name: string; email: string }> = {}) {
  const detail = meeting.detail && typeof meeting.detail === "object"
    ? meeting.detail as Record<string, unknown>
    : meeting;
  const transcriptDetail = meeting.transcriptDetail && typeof meeting.transcriptDetail === "object"
    ? meeting.transcriptDetail as Record<string, unknown>
    : {};
  const attendees = detail.attendees && typeof detail.attendees === "object"
    ? detail.attendees as Record<string, unknown>
    : meeting.attendees && typeof meeting.attendees === "object"
      ? meeting.attendees as Record<string, unknown>
      : {};
  const sellers = Array.isArray(attendees?.sellers)
    ? (attendees.sellers as Record<string, unknown>[])
    : [];
  const support = Array.isArray(attendees?.support)
    ? (attendees.support as Record<string, unknown>[])
    : [];
  const customers = Array.isArray(attendees?.customers)
    ? (attendees.customers as Record<string, unknown>[])
    : [];
  const participants = Array.isArray(detail.participants)
    ? detail.participants as Record<string, unknown>[]
    : Array.isArray(meeting.participants)
      ? meeting.participants as Record<string, unknown>[]
      : [];
  const participantList = participants.length
    ? normalizeParticipants(participants, usersIndex)
    : normalizeParticipants([...sellers, ...support, ...customers], usersIndex);
  const trackerValues = detail.tracker_values && typeof detail.tracker_values === "object"
    ? detail.tracker_values
    : detail.trackerValues && typeof detail.trackerValues === "object"
      ? detail.trackerValues
      : {};
  const playbook = detail.playbook && typeof detail.playbook === "object"
    ? detail.playbook
    : {};
  const commitments = normalizeCommitments(Array.isArray(detail.commitments) ? detail.commitments : []);
  const summary = firstString(
    trackerSummary(trackerValues),
    detail.summary,
    detail.meeting_summary,
    detail.notes,
    detail.transcript_summary,
    meeting.summary,
  );
  const transcript = firstString(
    normalizeTranscript(transcriptDetail.transcript),
    normalizeTranscript(transcriptDetail.transcription),
    normalizeTranscript(transcriptDetail.text),
    normalizeTranscript(transcriptDetail.content),
    normalizeTranscript(transcriptDetail.body),
    normalizeTranscript(detail.transcript),
    normalizeTranscript(detail.transcription),
    normalizeTranscript(detail.transcript_text),
    normalizeTranscript(detail.transcriptText),
    normalizeTranscript(meeting.transcript),
    normalizeTranscript(meeting.transcription),
    normalizeTranscript(meeting.transcript_text),
    normalizeTranscript(meeting.transcriptText),
  );
  const sourceUrl = firstString(
    detail.url,
    detail.recording_url,
    meeting.url,
    meeting.recording_url,
    companyUrl ? `${companyUrl}/dashboard?type=meetings` : "",
  );

  return {
    id: `diio_meeting_${firstString(meeting.id)}`,
    tenantId,
    sourceId: firstString(meeting.id),
    sourceType: "meeting.finished",
    sourceUrl,
    recordedAt: firstString(detail.ended_at, detail.updated_at, detail.created_at, meeting.updated_at, meeting.created_at, meeting.scheduled_at),
    title: firstString(detail.title, detail.name, meeting.name, "Meeting"),
    summary,
    transcript,
    commitments,
    trackerValues,
    playbook,
    participants: participantList.filter((item) => item.name || item.email || item.phone),
    rawPayload: detail,
    matchStatus: "pending",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = firstString(Deno.env.get("SUPABASE_URL"));
  const supabaseServiceRoleKey = firstString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ ok: false, error: "missing_supabase_env", message: "Faltan credenciales server-side de Supabase." }, 500);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json", message: "La solicitud no trae JSON válido." }, 400);
  }

  const tenantId = firstString(payload.tenantId, payload.tenant_id);
  const action = firstString(payload.action) || "health_check";
  if (!tenantId) {
    return json({ ok: false, error: "missing_tenant", message: "Falta tenantId." }, 400);
  }

  try {
    const client = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    const empresas = await loadEmpresas(client);
    const { empresa, tenantDiio } = resolveTenant(empresas, tenantId);
    if (!empresa) {
      return json({ ok: false, error: "tenant_not_found", message: "No encontramos el tenant para Diio." }, 404);
    }

    const companyUrl = normalizeCompanyUrl(tenantDiio.companyUrl);
    const clientId = firstString(tenantDiio.clientId);
    const clientSecret = firstString(tenantDiio.clientSecret);
    const refreshToken = firstString(tenantDiio.refreshToken);
    if (!companyUrl || !clientId || !clientSecret || !refreshToken) {
      return json({ ok: false, error: "missing_diio_config", message: "Faltan datos base de Diio para este tenant." }, 400);
    }

    const refreshed = await refreshAccessToken({ companyUrl, clientId, clientSecret, refreshToken });
    if (!refreshed.ok) {
      return json({
        ok: false,
        error: refreshed.status === 401 ? "invalid_credentials" : "refresh_failed",
        message: "Diio no entregó un access_token válido.",
        status: refreshed.status,
        details: refreshed.parsed || refreshed.raw,
      }, refreshed.status || 401);
    }

    if (action === "refresh_token") {
      return json({
        ok: true,
        tenantId,
        companyUrl,
        accessTokenPreview: `${refreshed.accessToken.slice(0, 12)}...`,
      });
    }

    const meetings = await listMeetings(companyUrl, refreshed.accessToken);
    if (!meetings.ok) {
      return json({
        ok: false,
        error: meetings.status === 401 ? "invalid_token" : "meetings_failed",
        message: "Diio autenticó pero no pudimos listar reuniones.",
        status: meetings.status,
        details: meetings.parsed || meetings.raw,
      }, meetings.status || 500);
    }

    const nextEmpresas = empresas.map((item) => {
      if (firstString(item?.id) !== tenantId) return item;
      const integrationConfigs = item?.integrationConfigs && typeof item.integrationConfigs === "object"
        ? item.integrationConfigs as Record<string, unknown>
        : {};
      const diio = integrationConfigs.diio && typeof integrationConfigs.diio === "object"
        ? integrationConfigs.diio as Record<string, unknown>
        : {};
      return {
        ...item,
        integrationConfigs: {
          ...integrationConfigs,
          diio: {
            ...diio,
            tenant: {
              ...tenantDiio,
              status: "connected",
              connected: true,
              connectedAt: new Date().toISOString(),
              lastValidatedAt: new Date().toISOString(),
              lastError: "",
            },
          },
        },
      };
    });
    await saveStorageJson(client, getEmpresasStorageKey(), nextEmpresas);

    if (action === "import_meetings") {
      const currentQueue = await loadStorageJson(client, getIncomingStorageKey(tenantId));
      const queue = Array.isArray(currentQueue) ? currentQueue : [];
      const allMeetings = await listAllMeetings(companyUrl, refreshed.accessToken);
      if (!allMeetings.ok) {
        return json({
          ok: false,
          error: allMeetings.status === 401 ? "invalid_token" : "meetings_failed",
          message: "Diio autenticó, pero no pudimos completar el histórico de reuniones.",
          status: allMeetings.status,
          details: allMeetings.parsed || allMeetings.raw,
        }, allMeetings.status || 500);
      }
      const meetingsList = Array.isArray(allMeetings.meetings) ? allMeetings.meetings : [];
      const users = await listAllUsers(companyUrl, refreshed.accessToken);
      const usersIndex = buildUsersIndex(Array.isArray(users.users) ? users.users as unknown[] : []);
      const detailedMeetings = await Promise.all(meetingsList.map(async (meeting) => {
        const meetingId = firstString(meeting.id);
        if (!meetingId) return meeting;
        const detail = await getMeetingDetail(companyUrl, refreshed.accessToken, meetingId);
        if (!detail.ok || !detail.parsed) return meeting;
        const transcriptId = firstString(
          detail.parsed.last_transcript_id,
          detail.parsed.transcript_id,
          detail.parsed.transcriptId,
          (detail.parsed.transcript as Record<string, unknown> | undefined)?.id,
          (detail.parsed.transcription as Record<string, unknown> | undefined)?.id,
          meeting.last_transcript_id,
          meeting.transcript_id,
          meeting.transcriptId,
        );
        let transcript: Record<string, unknown> | null = null;
        if (transcriptId) {
          const transcriptDetail = await getTranscriptDetail(companyUrl, refreshed.accessToken, transcriptId);
          if (transcriptDetail.ok && transcriptDetail.parsed) transcript = transcriptDetail.parsed;
        }
        return {
          ...meeting,
          detail: detail.parsed,
          transcriptDetail: transcript,
        };
      }));
      const nextQueue = detailedMeetings.reduce((acc, meeting) => upsertQueue(acc, normalizeMeetingToInteraction(meeting, tenantId, companyUrl, usersIndex)), queue);
      await saveStorageJson(client, getIncomingStorageKey(tenantId), nextQueue);
      const importedAt = new Date().toISOString();
      const nextEmpresasAfterImport = nextEmpresas.map((item) => {
        if (firstString(item?.id) !== tenantId) return item;
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
                status: "connected",
                connected: true,
                connectedAt: firstString(currentTenant.connectedAt, tenantDiio.connectedAt, importedAt),
                lastValidatedAt: firstString(currentTenant.lastValidatedAt, tenantDiio.lastValidatedAt, importedAt),
                lastImportedAt: importedAt,
                lastImportCount: detailedMeetings.length,
                lastImportQueueSize: nextQueue.length,
                lastError: "",
              },
            },
          },
        };
      });
      await saveStorageJson(client, getEmpresasStorageKey(), nextEmpresasAfterImport);
      return json({
        ok: true,
        tenantId,
        companyUrl,
        imported: detailedMeetings.length,
        queueSize: nextQueue.length,
        importedAt,
      });
    }

    return json({
      ok: true,
      tenantId,
      companyUrl,
      meetings: meetings.parsed,
    });
  } catch (error) {
    return json({
      ok: false,
      error: "diio_company_api_exception",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createJsonResponder } from "../_shared/http.ts";
import {
  createSupabaseServiceRoleClient,
  readSupabaseServiceRoleEnv,
} from "../_shared/supabaseClient.ts";
import {
  buildUsersIndex,
  firstString,
  normalizeCompanyUrl,
  normalizeMeetingToInteraction,
  normalizePhoneCallToInteraction,
  normalizeTenantDiioConfig,
  resolveTenant,
} from "./mapping.ts";
import {
  getMeetingDetail,
  getPhoneCallDetail,
  getPlaybookDetail,
  getTranscriptDetail,
  listAllMeetings,
  listAllPhoneCalls,
  listAllUsers,
  listMeetings,
  refreshAccessToken,
} from "./diioApi.ts";
import {
  getEmpresasStorageKey,
  getIncomingStorageKey,
  loadEmpresas,
  loadStorageJson,
  saveStorageJson,
  upsertQueue,
} from "./storage.ts";

const json = createJsonResponder(corsHeaders);

Deno.serve(async (req) => {
  const preflight = handleCors(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const { supabaseUrl, serviceRoleKey } = readSupabaseServiceRoleEnv();
  if (!supabaseUrl || !serviceRoleKey) {
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
    const client = createSupabaseServiceRoleClient(supabaseUrl, serviceRoleKey);
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
        const playbookId = firstString(
          detail.parsed.playbook && typeof detail.parsed.playbook === "object" ? (detail.parsed.playbook as Record<string, unknown>).id : "",
          meeting.playbook && typeof meeting.playbook === "object" ? (meeting.playbook as Record<string, unknown>).id : "",
        );
        let playbookDetail: Record<string, unknown> | null = null;
        if (playbookId) {
          const playbookResponse = await getPlaybookDetail(companyUrl, refreshed.accessToken, playbookId);
          if (playbookResponse.ok && playbookResponse.parsed) playbookDetail = playbookResponse.parsed;
        }
        return {
          ...meeting,
          detail: detail.parsed,
          transcriptDetail: transcript,
          playbookDetail,
        };
      }));
      const allCalls = await listAllPhoneCalls(companyUrl, refreshed.accessToken);
      if (!allCalls.ok) {
        return json({
          ok: false,
          error: allCalls.status === 401 ? "invalid_token" : "phone_calls_failed",
          message: "Diio autenticó, pero no pudimos completar el histórico de llamadas.",
          status: allCalls.status,
          details: allCalls.parsed || allCalls.raw,
        }, allCalls.status || 500);
      }
      const phoneCallsList = Array.isArray(allCalls.phoneCalls) ? allCalls.phoneCalls : [];
      const detailedCalls = await Promise.all(phoneCallsList.map(async (phoneCall) => {
        const phoneCallId = firstString(phoneCall.id);
        if (!phoneCallId) return phoneCall;
        const detail = await getPhoneCallDetail(companyUrl, refreshed.accessToken, phoneCallId);
        if (!detail.ok || !detail.parsed) return phoneCall;
        const transcriptId = firstString(
          detail.parsed.last_transcript_id,
          detail.parsed.transcript_id,
          detail.parsed.transcriptId,
          (detail.parsed.transcript as Record<string, unknown> | undefined)?.id,
          (detail.parsed.transcription as Record<string, unknown> | undefined)?.id,
          phoneCall.last_transcript_id,
          phoneCall.transcript_id,
          phoneCall.transcriptId,
        );
        let transcript: Record<string, unknown> | null = null;
        if (transcriptId) {
          const transcriptDetail = await getTranscriptDetail(companyUrl, refreshed.accessToken, transcriptId);
          if (transcriptDetail.ok && transcriptDetail.parsed) transcript = transcriptDetail.parsed;
        }
        const playbookId = firstString(
          detail.parsed.playbook && typeof detail.parsed.playbook === "object" ? (detail.parsed.playbook as Record<string, unknown>).id : "",
          phoneCall.playbook && typeof phoneCall.playbook === "object" ? (phoneCall.playbook as Record<string, unknown>).id : "",
        );
        let playbookDetail: Record<string, unknown> | null = null;
        if (playbookId) {
          const playbookResponse = await getPlaybookDetail(companyUrl, refreshed.accessToken, playbookId);
          if (playbookResponse.ok && playbookResponse.parsed) playbookDetail = playbookResponse.parsed;
        }
        return {
          ...phoneCall,
          detail: detail.parsed,
          transcriptDetail: transcript,
          playbookDetail,
        };
      }));
      const importedInteractions = [
        ...detailedMeetings.map((meeting) => normalizeMeetingToInteraction(meeting, tenantId, companyUrl, usersIndex)),
        ...detailedCalls.map((phoneCall) => normalizePhoneCallToInteraction(phoneCall, tenantId, companyUrl, usersIndex)),
      ];
      const nextQueue = importedInteractions.reduce((acc, interaction) => upsertQueue(acc, interaction), queue);
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
                lastImportCount: importedInteractions.length,
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
        imported: importedInteractions.length,
        importedMeetings: detailedMeetings.length,
        importedPhoneCalls: detailedCalls.length,
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

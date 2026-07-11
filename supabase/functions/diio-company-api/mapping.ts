export type DiioUserIndex = Record<string, { id: string; name: string; email: string }>;

type DiioParticipant = {
  name: string;
  email: string;
  phone: string;
  role: string;
  userId: string;
  show: boolean;
  speakTime: number;
  arriveTime: string;
};

function hasParticipantIdentity(item: DiioParticipant | null): item is DiioParticipant {
  return Boolean(item && (item.name || item.email || item.phone || item.userId));
}

export function firstString(...values: unknown[]) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

export function normalizeCompanyUrl(value: unknown) {
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

export function normalizeTenantDiioConfig(config: Record<string, unknown> = {}) {
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

export function resolveTenant(empresas: Record<string, unknown>[] = [], tenantId = "") {
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

export function normalizePlaybookSummary(items: unknown[] = []) {
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

export function normalizeTranscript(value: unknown) {
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

export function trackerSummary(trackerValues: unknown = {}) {
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

export function normalizeCommitments(items: unknown[] = []) {
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

export function buildUsersIndex(items: unknown[] = []): DiioUserIndex {
  return (Array.isArray(items) ? items : []).reduce<DiioUserIndex>((acc, item) => {
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
  }, {} as DiioUserIndex);
}

export function normalizeParticipants(items: unknown[] = [], usersIndex: DiioUserIndex = {}) {
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
    .filter(hasParticipantIdentity);
}

export function normalizeMeetingToInteraction(meeting: Record<string, unknown> = {}, tenantId = "", companyUrl = "", usersIndex: DiioUserIndex = {}) {
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
  const playbook = meeting.playbookDetail && typeof meeting.playbookDetail === "object"
    ? meeting.playbookDetail as Record<string, unknown>
    : detail.playbook && typeof detail.playbook === "object"
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
    analyzedStatus: firstString(detail.analyzed_status, meeting.analyzed_status),
    errorCause: firstString(detail.error_cause, meeting.error_cause),
    duration: Number(detail.duration || meeting.duration || 0),
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

export function normalizePhoneCallToInteraction(phoneCall: Record<string, unknown> = {}, tenantId = "", companyUrl = "", usersIndex: DiioUserIndex = {}) {
  const detail = phoneCall.detail && typeof phoneCall.detail === "object"
    ? phoneCall.detail as Record<string, unknown>
    : phoneCall;
  const transcriptDetail = phoneCall.transcriptDetail && typeof phoneCall.transcriptDetail === "object"
    ? phoneCall.transcriptDetail as Record<string, unknown>
    : {};
  const attendees = detail.attendees && typeof detail.attendees === "object"
    ? detail.attendees as Record<string, unknown>
    : phoneCall.attendees && typeof phoneCall.attendees === "object"
      ? phoneCall.attendees as Record<string, unknown>
      : {};
  const sellers = Array.isArray(attendees?.sellers) ? (attendees.sellers as Record<string, unknown>[]) : [];
  const support = Array.isArray(attendees?.support) ? (attendees.support as Record<string, unknown>[]) : [];
  const customers = Array.isArray(attendees?.customers) ? (attendees.customers as Record<string, unknown>[]) : [];
  const trackerValues = detail.tracker_values && typeof detail.tracker_values === "object"
    ? detail.tracker_values
    : detail.trackerValues && typeof detail.trackerValues === "object"
      ? detail.trackerValues
      : {};
  const playbook = phoneCall.playbookDetail && typeof phoneCall.playbookDetail === "object"
    ? phoneCall.playbookDetail as Record<string, unknown>
    : detail.playbook && typeof detail.playbook === "object"
      ? detail.playbook
      : {};
  const commitments = normalizeCommitments(Array.isArray(detail.commitments) ? detail.commitments : []);
  const summary = firstString(
    trackerSummary(trackerValues),
    detail.summary,
    detail.notes,
    detail.transcript_summary,
    phoneCall.summary,
  );
  const transcript = firstString(
    normalizeTranscript(transcriptDetail.transcript),
    normalizeTranscript(transcriptDetail.transcription),
    normalizeTranscript(transcriptDetail.text),
    normalizeTranscript(detail.transcript),
    normalizeTranscript(detail.transcription),
    normalizeTranscript(detail.transcript_text),
    normalizeTranscript(phoneCall.transcript),
    normalizeTranscript(phoneCall.transcription),
  );
  const participants = normalizeParticipants([...sellers, ...support, ...customers], usersIndex);

  return {
    id: `diio_phone_call_${firstString(phoneCall.id)}`,
    tenantId,
    sourceId: firstString(phoneCall.id),
    sourceType: "phone_call.finished",
    analyzedStatus: firstString(detail.analyzed_status, phoneCall.analyzed_status),
    errorCause: firstString(detail.error_cause, phoneCall.error_cause),
    duration: Number(detail.duration || phoneCall.duration || 0),
    sourceUrl: firstString(
      detail.url,
      detail.recording_url,
      phoneCall.url,
      phoneCall.recording_url,
      companyUrl ? `${companyUrl}/dashboard?type=phone_calls` : "",
    ),
    recordedAt: firstString(detail.occurred_at, detail.ocurred_at, detail.updated_at, detail.created_at, phoneCall.occurred_at, phoneCall.ocurred_at, phoneCall.updated_at, phoneCall.created_at),
    title: firstString(detail.title, detail.name, phoneCall.name, "Phone call"),
    summary,
    transcript,
    commitments,
    trackerValues,
    playbook,
    participants: participants.filter((item) => item.name || item.email || item.phone),
    rawPayload: detail,
    matchStatus: "pending",
  };
}

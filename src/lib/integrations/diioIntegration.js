const uid = () => "_" + Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

function normalizeDiioCompanyUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const safeUrl = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
    const parsed = new URL(safeUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

export function getDiioIncomingStorageKey(tenantId = "") {
  return `produ:produ:diio:${tenantId || "global"}:incoming`;
}

export function getLegacyDiioIncomingStorageKey(tenantId = "") {
  return `produ:diio:${tenantId || "global"}:incoming`;
}

export function normalizeDiioGovernanceConfig(config = {}) {
  const governance = config?.governance || {};
  const modules = governance?.modules || {};
  return {
    governance: {
      mode: governance.mode || "disabled",
      enabled: governance.enabled === true || governance.mode === "manual" || governance.mode === "webhook",
      sellable: governance.sellable !== false,
      modules: {
        crm: modules.crm !== false,
        productions: modules.productions !== false,
        projects: modules.projects !== false,
        content: modules.content !== false,
      },
    },
    mapping: {
      strategy: config?.mapping?.strategy || "assisted",
      autoConfirmHighConfidence: config?.mapping?.autoConfirmHighConfidence === true,
      minConfidence: Number(config?.mapping?.minConfidence || 0.82),
    },
    tenant: normalizeDiioTenantConnection(config?.tenant || {}),
  };
}

export function normalizeDiioTenantConnection(config = {}) {
  const workspaceLabel = String(config?.workspaceLabel || config?.companyLabel || "").trim();
  const companyUrl = normalizeDiioCompanyUrl(config?.companyUrl || config?.baseUrl || config?.workspaceUrl || "");
  const clientId = String(config?.clientId || "").trim();
  const clientSecret = String(config?.clientSecret || "").trim();
  const refreshToken = String(config?.refreshToken || "").trim();
  const webhookId = String(config?.webhookId || "").trim();
  const webhookSecret = String(config?.webhookSecret || "").trim();
  const connectedAt = String(config?.connectedAt || "").trim();
  const lastValidatedAt = String(config?.lastValidatedAt || "").trim();
  const lastImportedAt = String(config?.lastImportedAt || "").trim();
  const lastImportCount = Number(config?.lastImportCount || 0);
  const lastImportQueueSize = Number(config?.lastImportQueueSize || 0);
  const lastWebhookAt = String(config?.lastWebhookAt || "").trim();
  const lastWebhookEvent = String(config?.lastWebhookEvent || "").trim();
  const lastWebhookObjectId = String(config?.lastWebhookObjectId || "").trim();
  const lastError = String(config?.lastError || "").trim();
  const configured =
    Boolean(workspaceLabel) ||
    Boolean(clientId) ||
    Boolean(webhookSecret) ||
    Boolean(refreshToken);
  const fullyConfigured =
    Boolean(workspaceLabel) &&
    Boolean(clientId) &&
    Boolean(refreshToken) &&
    Boolean(webhookSecret);
  const explicitStatus = String(config?.status || "").trim();
  const inferredStatus = explicitStatus || (config?.connected === true
    ? "connected"
    : configured
      ? (fullyConfigured ? "configured" : "draft")
      : "disconnected");
  const connected = config?.connected === true && inferredStatus === "connected";
  return {
    status: inferredStatus,
    workspaceLabel,
    companyUrl,
    workspaceId: String(config?.workspaceId || "").trim(),
    adminEmail: String(config?.adminEmail || "").trim(),
    clientId,
    clientSecret,
    refreshToken,
    webhookId,
    webhookSecret,
    connectedAt,
    lastValidatedAt,
    lastImportedAt,
    lastImportCount,
    lastImportQueueSize,
    lastWebhookAt,
    lastWebhookEvent,
    lastWebhookObjectId,
    lastError,
    notes: String(config?.notes || "").trim(),
    configured,
    fullyConfigured,
    connected,
  };
}

export function getDiioTenantWebhookUrl(baseUrl = "", tenantId = "") {
  const safeBase = String(baseUrl || "").trim();
  const safeTenantId = String(tenantId || "").trim();
  if (!safeBase || !safeTenantId) return safeBase;
  const separator = safeBase.includes("?") ? "&" : "?";
  return `${safeBase}${separator}tenantId=${encodeURIComponent(safeTenantId)}`;
}

export function getDiioProviderSnapshot() {
  const webhookBase = import.meta?.env?.VITE_DIIO_WEBHOOK_BASE || "";
  return {
    provider: "diio",
    webhookBase,
    ready: Boolean(webhookBase),
    mode: webhookBase ? "webhook" : "manual",
  };
}

export function normalizeDiioInteractionRecord(record = {}) {
  return {
    id: record.id || uid(),
    tenantId: record.tenantId || "",
    sourceId: record.sourceId || record.webhookObjectId || "",
    sourceType: record.sourceType || record.eventType || "meeting.finished",
    sourceUrl: record.sourceUrl || "",
    recordedAt: record.recordedAt || record.createdAt || nowIso(),
    title: record.title || record.subject || record.name || "Interacción Diio",
    summary: record.summary || record.text || "",
    transcript: normalizeTranscript(record.transcript || record.transcription || ""),
    commitments: Array.isArray(record.commitments) ? record.commitments : [],
    trackerValues: normalizeTrackerValues(record.trackerValues || {}),
    playbook: normalizePlaybook(record.playbook),
    participants: Array.isArray(record.participants) ? record.participants : [],
    rawPayload: record.rawPayload || null,
    matchStatus: record.matchStatus || "pending",
    matchConfidence: Number(record.matchConfidence || 0),
    entityType: record.entityType || "",
    entityId: record.entityId || "",
    entityLabel: record.entityLabel || "",
    suggestedTargets: Array.isArray(record.suggestedTargets) ? record.suggestedTargets : [],
  };
}

function firstString(...values) {
  return values.map(value => String(value || "").trim()).find(Boolean) || "";
}

function normalizeCommitments(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      if (typeof item === "string") {
        const title = item.trim();
        return title ? { title } : null;
      }
      if (!item || typeof item !== "object") return null;
      const title = firstString(item?.title, item?.text, item?.value, item?.description);
      if (!title) return null;
      return {
        id: firstString(item?.id),
        title,
        deadline: firstString(item?.deadline, item?.due_date, item?.dueDate),
        done: item?.done === true,
        user: item?.user && typeof item.user === "object"
          ? {
              id: firstString(item.user?.id),
              name: firstString(item.user?.name),
              email: firstString(item.user?.email),
            }
          : null,
        createdAt: firstString(item?.created_at, item?.createdAt),
        updatedAt: firstString(item?.updated_at, item?.updatedAt),
      };
    })
    .filter(Boolean);
}

function normalizeParticipants(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({
      name: firstString(item?.name, item?.full_name),
      email: firstString(item?.email),
      phone: firstString(item?.phone),
      role: firstString(item?.role),
      userId: firstString(item?.user_id, item?.userId),
      show: item?.show === true,
      speakTime: Number(item?.speak_time || item?.speakTime || 0),
      arriveTime: firstString(item?.arrive_time, item?.arriveTime),
    }))
    .filter(item => item.name || item.email || item.phone || item.userId);
}

function normalizeTrackerValues(value = {}) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).map(([key, raw]) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return {
        key,
        ...(raw || {}),
      };
    }
    return { key, value: raw };
  });
}

function normalizePlaybook(value = null) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function normalizeTranscript(value = "") {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const speaker = firstString(item?.speaker);
          const text = firstString(item?.text, item?.content, item?.body, item?.value);
          if (!text) return "";
          return speaker ? `${speaker}: ${text}` : text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") return firstString(value?.text, value?.content, value?.body, value?.value);
  return "";
}

function trackerSummary(trackerValues = []) {
  const normalized = normalizeTrackerValues(trackerValues);
  const summaryEntry = normalized.find(item => String(item?.key || item?.name || item?.label || "").toLowerCase() === "summary");
  return firstString(
    summaryEntry?.value,
    summaryEntry?.text,
    summaryEntry?.description,
    summaryEntry?.answer,
  );
}

function structuredSummaryFromPayload(data = {}, payload = {}, trackerValues = []) {
  return firstString(
    trackerSummary(trackerValues),
    data?.summary,
    data?.meeting_summary,
    data?.notes,
    data?.transcript_summary,
    payload?.summary,
  );
}

export function parseDiioWebhookPayload(raw = {}, tenantId = "") {
  const payload = raw && typeof raw === "object" ? raw : {};
  const event = firstString(payload?.event, payload?.type, payload?.event_type);
  const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const trackerValues = normalizeTrackerValues(data?.tracker_values || data?.trackerValues || {});
  const playbook = normalizePlaybook(data?.playbook);
  const commitments = normalizeCommitments(data?.commitments);
  const participantSeed = data?.participants || data?.attendees || data?.contacts || data?.sellers || data?.support || data?.customers;
  const participants = normalizeParticipants(participantSeed);
  const summary = structuredSummaryFromPayload(data, payload, trackerValues);
  const transcript = firstString(
    normalizeTranscript(data?.transcript),
    normalizeTranscript(data?.transcription),
    normalizeTranscript(data?.transcript_text),
    normalizeTranscript(data?.transcriptText),
    normalizeTranscript(data?.notes),
  );
  return normalizeDiioInteractionRecord({
    tenantId,
    sourceId: firstString(data?.id, payload?.id, payload?.webhook_object_id),
    sourceType: event || "meeting.finished",
    sourceUrl: firstString(data?.url, data?.recording_url, payload?.url),
    recordedAt: firstString(data?.ended_at, data?.created_at, payload?.created_at, nowIso()),
    title: firstString(data?.title, data?.name, data?.subject, payload?.title),
    summary,
    transcript,
    commitments,
    trackerValues,
    playbook,
    participants,
    rawPayload: payload,
    matchStatus: "pending",
  });
}

function scoreTermMatch(haystack = "", term = "") {
  if (!haystack || !term) return 0;
  const safeHaystack = String(haystack).toLowerCase();
  const safeTerm = String(term).toLowerCase().trim();
  if (!safeTerm) return 0;
  if (safeHaystack === safeTerm) return 1;
  if (safeHaystack.includes(safeTerm)) return 0.72;
  return 0;
}

function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compactWords(value = "") {
  return normalizeSearchText(value)
    .split(/[^a-z0-9@.+_-]+/i)
    .map(token => token.trim())
    .filter(token => token.length >= 3);
}

function buildParticipantSignals(participants = []) {
  const emails = [];
  const names = [];
  const tokens = [];
  (Array.isArray(participants) ? participants : []).forEach(item => {
    if (item?.email) {
      const email = normalizeSearchText(item.email);
      emails.push(email);
      tokens.push(...compactWords(email));
    }
    if (item?.name) {
      const name = normalizeSearchText(item.name);
      names.push(name);
      tokens.push(...compactWords(name));
    }
  });
  return { emails, names, tokens: [...new Set(tokens)] };
}

function buildTargetScore({ interaction, entity = {}, entityType = "" }) {
  const participantSignals = buildParticipantSignals(interaction?.participants);
  const candidateFields = [
    entity?.nom,
    entity?.nombre,
    entity?.empresaMarca,
    entity?.contacto,
    entity?.email,
    entity?.ema,
    entity?.invitado,
    entity?.conductor,
    entity?.prodEjec,
    entity?.des,
  ].filter(Boolean);
  const candidateText = normalizeSearchText(candidateFields.join(" \n "));
  const candidateTokens = compactWords(candidateText);
  const interactionTitle = normalizeSearchText(interaction?.title);
  const interactionSummary = normalizeSearchText(interaction?.summary);
  const entityLabel = normalizeSearchText(entity?.nombre || entity?.nom || entity?.empresaMarca || "");

  let score = 0;
  const reasons = [];
  participantSignals.emails.forEach(email => {
    const emailScore = scoreTermMatch(candidateText, email);
    if (emailScore >= 1) reasons.push(`email:${email}`);
    score = Math.max(score, emailScore);
  });
  participantSignals.names.forEach(name => {
    const nameScore = scoreTermMatch(candidateText, name);
    if (nameScore >= 0.72) reasons.push(`name:${name}`);
    score = Math.max(score, nameScore * 0.92);
  });
  if (entityLabel) {
    const titleScore = scoreTermMatch(interactionTitle, entityLabel);
    const summaryScore = scoreTermMatch(interactionSummary, entityLabel);
    if (titleScore >= 0.72) reasons.push("title_match");
    if (summaryScore >= 0.72) reasons.push("summary_match");
    score = Math.max(score, titleScore * 0.88, summaryScore * 0.82);
  }

  const sharedTokenCount = participantSignals.tokens.filter(token => candidateTokens.includes(token)).length;
  if (sharedTokenCount > 0) {
    score = Math.max(score, Math.min(0.9, 0.35 + sharedTokenCount * 0.12));
    reasons.push(`shared_tokens:${sharedTokenCount}`);
  }

  if (entityType === "crm_opportunity" && /meeting|phone_call|call|reunion/i.test(String(interaction?.sourceType || ""))) {
    score = Math.min(1, score + 0.03);
  }

  return {
    entityType,
    entityId: entity?.id || "",
    entityLabel: entity?.nombre || entity?.nom || entity?.empresaMarca || "Registro",
    score: Number(score.toFixed(3)),
    reasons,
  };
}

export function suggestDiioInteractionTargets({
  interaction = {},
  crmOpps = [],
  producciones = [],
  programas = [],
  piezas = [],
} = {}) {
  return [
    ...(Array.isArray(crmOpps) ? crmOpps : []).map(entity => buildTargetScore({ interaction, entity, entityType: "crm_opportunity" })),
    ...(Array.isArray(producciones) ? producciones : []).map(entity => buildTargetScore({ interaction, entity, entityType: "project" })),
    ...(Array.isArray(programas) ? programas : []).map(entity => buildTargetScore({ interaction, entity, entityType: "production" })),
    ...(Array.isArray(piezas) ? piezas : []).map(entity => buildTargetScore({ interaction, entity, entityType: "content_campaign" })),
  ]
    .filter(item => item.entityId && item.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function matchDiioParticipantsToCrew(participants = [], crewOptions = []) {
  const safeParticipants = Array.isArray(participants) ? participants : [];
  const safeCrew = Array.isArray(crewOptions) ? crewOptions : [];
  const normalizedParticipants = safeParticipants.map(item => ({
    email: String(item?.email || "").trim().toLowerCase(),
    name: String(item?.name || "").trim().toLowerCase(),
  }));
  return safeCrew
    .filter(member => {
      const memberName = String(member?.nom || member?.name || "").trim().toLowerCase();
      const memberEmail = String(member?.ema || member?.email || "").trim().toLowerCase();
      return normalizedParticipants.some(participant =>
        (participant.email && memberEmail && participant.email === memberEmail) ||
        (participant.name && memberName && participant.name === memberName),
      );
    })
    .map(member => member.id)
    .filter(Boolean);
}

export function buildDiioNarrative(interaction = {}) {
  const lines = [];
  if (interaction?.summary) lines.push(String(interaction.summary).trim());
  if (Array.isArray(interaction?.commitments) && interaction.commitments.length) {
    lines.push("");
    lines.push("Compromisos:");
    interaction.commitments.slice(0, 6).forEach(item => {
      const label = typeof item === "string" ? item : item?.title || item?.text || item?.value || "";
      if (label) lines.push(`- ${label}`);
    });
  }
  return lines.join("\n").trim();
}

export function buildDiioCommentEntry(interaction = {}, crewOptions = [], authorName = "Diio") {
  const source = interaction?.diio && typeof interaction.diio === "object" ? interaction.diio : {};
  const participants = Array.isArray(interaction?.participants)
    ? interaction.participants
    : Array.isArray(source?.participants)
      ? source.participants
      : [];
  const commitments = Array.isArray(interaction?.commitments)
    ? interaction.commitments
    : Array.isArray(source?.commitments)
      ? source.commitments
      : [];
  const assignedIds = matchDiioParticipantsToCrew(participants, crewOptions);
  return {
    id: uid(),
    actionType: "diio",
    text: buildDiioNarrative(interaction),
    assignedIds,
    asignadoA: assignedIds[0] || "",
    attachments: [],
    photos: [],
    cr: interaction?.recordedAt || nowIso().slice(0, 10),
    authorId: "diio",
    authorName,
    source: "diio",
    sourceId: interaction?.sourceId || source?.sourceId || "",
    sourceUrl: interaction?.sourceUrl || source?.sourceUrl || "",
    diio: {
      title: interaction?.title || source?.title || "",
      recordedAt: interaction?.recordedAt || source?.recordedAt || "",
      sourceType: interaction?.sourceType || source?.sourceType || "",
      sourceUrl: interaction?.sourceUrl || source?.sourceUrl || "",
      summary: interaction?.summary || source?.summary || "",
      transcript: interaction?.transcript || source?.transcript || "",
      commitments,
      trackerValues: normalizeTrackerValues(interaction?.trackerValues),
      playbook: normalizePlaybook(interaction?.playbook),
      participants,
    },
  };
}

export function upsertDiioIncomingInteraction(records = [], interaction = {}) {
  const normalized = normalizeDiioInteractionRecord(interaction);
  const current = Array.isArray(records) ? records : [];
  const existingIndex = current.findIndex(item =>
    item?.id === normalized.id ||
    (normalized.sourceId && item?.sourceId === normalized.sourceId),
  );
  if (existingIndex < 0) return [normalized, ...current];
  return current.map((item, index) => index === existingIndex ? { ...item, ...normalized } : item);
}

export function confirmDiioInteractionAssignment(records = [], interactionId = "", target = {}) {
  const normalizedInteractionId = typeof interactionId === "object"
    ? String(interactionId?.id || "").trim()
    : String(interactionId || "").trim();
  const interactionSourceId = typeof interactionId === "object"
    ? String(interactionId?.sourceId || "").trim()
    : "";
  return (Array.isArray(records) ? records : []).map(item => {
    const sameId = String(item?.id || "").trim() === normalizedInteractionId;
    const sameSourceId = interactionSourceId && String(item?.sourceId || "").trim() === interactionSourceId;
    if (!sameId && !sameSourceId) return item;
    return {
      ...item,
      matchStatus: "confirmed",
      entityType: target.entityType || item.entityType || "",
      entityId: target.entityId || item.entityId || "",
      entityLabel: target.entityLabel || item.entityLabel || "",
      matchConfidence: Number(target.matchConfidence || item.matchConfidence || 0),
      confirmedAt: nowIso(),
    };
  });
}

export function attachDiioToCommentCollection(collection = [], entityId = "", interaction = {}, crewOptions = []) {
  return (Array.isArray(collection) ? collection : []).map(item => {
    if (item?.id !== entityId) return item;
    const currentComments = Array.isArray(item?.comentarios) ? item.comentarios : [];
    const interactionSourceId = String(interaction?.sourceId || "").trim();
    const nextComment = buildDiioCommentEntry(interaction, crewOptions);
    if (interactionSourceId && currentComments.some(comment => String(comment?.sourceId || "").trim() === interactionSourceId)) {
      return {
        ...item,
        comentarios: currentComments.map(comment => String(comment?.sourceId || "").trim() === interactionSourceId
          ? {
              ...comment,
              ...nextComment,
              id: comment.id || nextComment.id,
            }
          : comment),
      };
    }
    return {
      ...item,
      comentarios: [nextComment, ...currentComments],
    };
  });
}

export function buildDiioCrmActivityEntry(interaction = {}, opportunityId = "", empId = "") {
  const source = interaction?.diio && typeof interaction.diio === "object" ? interaction.diio : {};
  const participants = Array.isArray(interaction?.participants)
    ? interaction.participants
    : Array.isArray(source?.participants)
      ? source.participants
      : [];
  const commitments = Array.isArray(interaction?.commitments)
    ? interaction.commitments
    : Array.isArray(source?.commitments)
      ? source.commitments
      : [];
  const assignedIds = matchDiioParticipantsToCrew(participants, interaction?.crewOptions || []);
  return {
    id: uid(),
    empId,
    opportunityId,
    text: buildDiioNarrative(interaction),
    type: "diio",
    actionType: "diio",
    createdAt: String(interaction?.recordedAt || nowIso()).slice(0, 10),
    byName: "Diio",
    subject: interaction?.title || "",
    to: "",
    attachments: [],
    delivery: null,
    assignedIds,
    source: "diio",
    sourceId: interaction?.sourceId || source?.sourceId || "",
    sourceUrl: interaction?.sourceUrl || source?.sourceUrl || "",
    diio: {
      title: interaction?.title || source?.title || "",
      recordedAt: interaction?.recordedAt || source?.recordedAt || "",
      sourceType: interaction?.sourceType || source?.sourceType || "",
      sourceUrl: interaction?.sourceUrl || source?.sourceUrl || "",
      summary: interaction?.summary || source?.summary || "",
      transcript: interaction?.transcript || source?.transcript || "",
      commitments,
      trackerValues: normalizeTrackerValues(interaction?.trackerValues),
      playbook: normalizePlaybook(interaction?.playbook),
      participants,
    },
  };
}

export function attachDiioToCrmActivities(activities = [], opportunityId = "", interaction = {}, empId = "") {
  const currentActivities = Array.isArray(activities) ? activities : [];
  const interactionSourceId = String(interaction?.sourceId || "").trim();
  const nextActivity = buildDiioCrmActivityEntry(interaction, opportunityId, empId);
  if (interactionSourceId && currentActivities.some(item => String(item?.sourceId || "").trim() === interactionSourceId)) {
    return currentActivities.map(item => String(item?.sourceId || "").trim() === interactionSourceId
      ? {
          ...item,
          ...nextActivity,
          id: item.id || nextActivity.id,
        }
      : item);
  }
  return [nextActivity, ...currentActivities];
}

export function refreshDiioCommentCollection(collection = [], interactions = [], crewOptions = []) {
  return (Array.isArray(collection) ? collection : []).map(item => {
    const currentComments = Array.isArray(item?.comentarios) ? item.comentarios : [];
    let changed = false;
    const nextComments = currentComments.map(comment => {
      const sourceId = String(comment?.sourceId || "").trim();
      if (!sourceId || comment?.source !== "diio") return comment;
      const interaction = (Array.isArray(interactions) ? interactions : []).find(entry => String(entry?.sourceId || "").trim() === sourceId);
      if (!interaction) return comment;
      changed = true;
      const nextComment = buildDiioCommentEntry(interaction, crewOptions);
      return {
        ...comment,
        ...nextComment,
        id: comment.id || nextComment.id,
      };
    });
    return changed ? { ...item, comentarios: nextComments } : item;
  });
}

export function refreshDiioCrmActivities(activities = [], interactions = [], empId = "") {
  return (Array.isArray(activities) ? activities : []).map(item => {
    const sourceId = String(item?.sourceId || "").trim();
    if (!sourceId || item?.source !== "diio") return item;
    const interaction = (Array.isArray(interactions) ? interactions : []).find(entry => String(entry?.sourceId || "").trim() === sourceId);
    if (!interaction) return item;
    const nextActivity = buildDiioCrmActivityEntry(interaction, item?.opportunityId || "", empId);
    return {
      ...item,
      ...nextActivity,
      id: item.id || nextActivity.id,
    };
  });
}

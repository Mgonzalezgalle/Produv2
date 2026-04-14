function normalizeRecipients(input = []) {
  const raw = Array.isArray(input) ? input : [input];
  return raw
    .map(item => {
      if (!item) return null;
      if (typeof item === "string") return { email: item.trim(), name: "" };
      return {
        email: String(item.email || item.ema || "").trim(),
        name: String(item.name || item.nom || "").trim(),
      };
    })
    .filter(item => item?.email);
}

function normalizeAttachments(input = []) {
  const raw = Array.isArray(input) ? input : [];
  return raw
    .map(item => {
      if (!item?.src) return null;
      return {
        id: String(item.id || "").trim(),
        name: String(item.name || "adjunto").trim(),
        type: String(item.type || (String(item.src).startsWith("data:application/pdf") ? "pdf" : "image")).trim(),
        src: String(item.src || "").trim(),
      };
    })
    .filter(item => item?.src);
}

export const TRANSACTIONAL_EMAIL_TEMPLATE = {
  PASSWORD_RESET: "password_reset",
  USER_INVITATION: "user_invitation",
  BILLING_DOCUMENT: "billing_document",
  STATEMENT: "statement",
  TREASURY_REMINDER: "treasury_reminder",
  GENERIC_NOTIFICATION: "generic_notification",
};

export function buildTransactionalEmailDraft(payload = {}) {
  const to = normalizeRecipients(payload.to || payload.recipients || []);
  return {
    tenantId: String(payload.tenantId || payload.empId || "").trim(),
    templateKey: String(payload.templateKey || payload.template || TRANSACTIONAL_EMAIL_TEMPLATE.GENERIC_NOTIFICATION).trim(),
    subject: String(payload.subject || "").trim(),
    previewText: String(payload.previewText || "").trim(),
    to,
    cc: normalizeRecipients(payload.cc || []),
    bcc: normalizeRecipients(payload.bcc || []),
    html: String(payload.html || "").trim(),
    text: String(payload.text || "").trim(),
    replyTo: String(payload.replyTo || "").trim(),
    tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [],
    attachments: normalizeAttachments(payload.attachments || []),
    entityType: String(payload.entityType || "").trim(),
    entityId: String(payload.entityId || "").trim(),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  };
}

export function validateTransactionalEmailDraft(draft = {}) {
  const errors = [];
  if (!draft?.to?.length) errors.push("Falta destinatario.");
  if (!draft?.subject) errors.push("Falta asunto.");
  if (!draft?.html && !draft?.text) errors.push("Falta contenido HTML o texto.");
  return {
    ok: errors.length === 0,
    errors,
  };
}

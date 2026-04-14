import { getTransactionalEmailConfig, getTransactionalEmailProviderSnapshot } from "./transactionalEmailConfig";
import { buildTransactionalEmailDraft, validateTransactionalEmailDraft } from "./transactionalEmailProvider";

export function buildResendEmailRequest(payload = {}) {
  const config = getTransactionalEmailConfig();
  const draft = buildTransactionalEmailDraft(payload);
  const validation = validateTransactionalEmailDraft(draft);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      provider: "resend",
      config: getTransactionalEmailProviderSnapshot(),
    };
  }
  return {
    ok: true,
    provider: "resend",
    config: getTransactionalEmailProviderSnapshot(),
    request: {
      from: config.fromName && config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail,
      to: draft.to.map(item => item.email),
      cc: draft.cc.map(item => item.email),
      bcc: draft.bcc.map(item => item.email),
      reply_to: draft.replyTo || config.replyTo || undefined,
      subject: draft.subject,
      html: draft.html || undefined,
      text: draft.text || undefined,
      attachments: draft.attachments.map(att => ({
        filename: att.name,
        path: att.src,
      })),
      tags: draft.tags.map(tag => ({ name: "context", value: String(tag) })),
      headers: draft.previewText ? { "X-Entity-Preview": draft.previewText } : undefined,
    },
    draft,
  };
}

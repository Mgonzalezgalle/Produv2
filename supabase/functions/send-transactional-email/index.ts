import { Resend } from "npm:resend";
import { renderTransactionalEmailTemplate } from "../_shared/emailTemplate.ts";

type Recipient = {
  email?: string;
  name?: string;
};

type Payload = {
  tenantId?: string;
  templateKey?: string;
  subject?: string;
  previewText?: string;
  to?: Recipient[] | string[];
  cc?: Recipient[] | string[];
  bcc?: Recipient[] | string[];
  html?: string;
  text?: string;
  attachments?: { name?: string; type?: string; src?: string }[];
  replyTo?: string;
  tags?: string[];
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

function resolveTenantCompanyName(payload: Payload) {
  const metadata = payload.metadata || {};
  const candidates = [
    metadata.companyName,
    metadata.tenantCompanyName,
    metadata.tenantName,
  ];
  const match = candidates.find((value) => String(value || "").trim());
  return String(match || "Produ").trim();
}

function resolveTenantSubject(payload: Payload) {
  return `Notificación de ${resolveTenantCompanyName(payload)}`;
}

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

function normalizeRecipients(input: Payload["to"] = []) {
  const raw = Array.isArray(input) ? input : [input];
  return raw
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") return { email: item.trim(), name: "" };
      return {
        email: String(item.email || "").trim(),
        name: String(item.name || "").trim(),
      };
    })
    .filter((item) => item?.email);
}

function normalizeAttachments(input: Payload["attachments"] = []) {
  const raw = Array.isArray(input) ? input : [];
  return raw
    .map((item) => {
      const src = String(item?.src || "").trim();
      if (!src) return null;
      const dataMatch = src.match(/^data:([^;]+);base64,(.+)$/);
      if (dataMatch) {
        return {
          filename: String(item?.name || "adjunto").trim(),
          content: dataMatch[2],
          contentType: dataMatch[1],
        };
      }
      if (!/^https?:\/\//i.test(src)) return null;
      return {
        filename: String(item?.name || "adjunto").trim(),
        path: src,
      };
    })
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Produ";
  const defaultReplyTo = Deno.env.get("RESEND_REPLY_TO") || "";

  if (!apiKey || !fromEmail) {
    return json({
      ok: false,
      source: "degraded",
      error: "missing_resend_configuration",
      message: "Faltan secretos de Resend en la función server-side.",
    }, 503);
  }

  const payload = await req.json() as Payload;
  const to = normalizeRecipients(payload.to || []);
  const cc = normalizeRecipients(payload.cc || []);
  const bcc = normalizeRecipients(payload.bcc || []);
  const attachments = normalizeAttachments(payload.attachments || []);

  if (!to.length) return json({ ok: false, error: "missing_recipient" }, 400);
  if (!payload.subject) return json({ ok: false, error: "missing_subject" }, 400);
  if (!payload.html && !payload.text) return json({ ok: false, error: "missing_content" }, 400);

  const resend = new Resend(apiKey);
  const renderedTemplate = renderTransactionalEmailTemplate({
    subject: resolveTenantSubject(payload),
    html: payload.html,
    text: payload.text,
    templateKey: payload.templateKey,
    companyName: resolveTenantCompanyName(payload),
  });

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: to.map((item) => item.email!),
      cc: cc.map((item) => item.email!),
      bcc: bcc.map((item) => item.email!),
      replyTo: payload.replyTo || defaultReplyTo || undefined,
      subject: resolveTenantSubject(payload),
      html: renderedTemplate.html || undefined,
      text: renderedTemplate.text || undefined,
      attachments: attachments.length ? attachments : undefined,
      tags: Array.isArray(payload.tags)
        ? payload.tags.filter(Boolean).map((value) => ({ name: "context", value: String(value) }))
        : undefined,
    });

    if (result.error) {
      return json({
        ok: false,
        source: "degraded",
        provider: "resend",
        error: "resend_send_failed",
        message: result.error.message || "Resend no pudo aceptar el envío.",
        details: result.error,
      }, 502);
    }

    const deliveryId = String(result.data?.id || "").trim();
    if (!deliveryId) {
      return json({
        ok: false,
        source: "degraded",
        provider: "resend",
        error: "resend_missing_delivery_id",
        message: "Resend respondió sin identificador de entrega. Revisa remitente, dominio o destinatario permitido.",
      }, 502);
    }

    return json({
      ok: true,
      source: "remote",
      provider: "resend",
      delivery: {
        id: deliveryId,
        tenantId: String(payload.tenantId || "").trim(),
        templateKey: String(payload.templateKey || "generic_notification").trim(),
        subject: resolveTenantSubject(payload),
        to,
        entityType: String(payload.entityType || "").trim(),
        entityId: String(payload.entityId || "").trim(),
        metadata: payload.metadata || {},
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "resend_send_failed";
    return json({
      ok: false,
      source: "degraded",
      provider: "resend",
      error: "resend_send_failed",
      message,
    }, 502);
  }
});

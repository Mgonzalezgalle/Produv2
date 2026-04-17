type TemplatePayload = {
  subject?: string;
  html?: string;
  text?: string;
  templateKey?: string;
  companyName?: string;
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bodyHtmlFromPayload(payload: TemplatePayload) {
  if (payload.html) return String(payload.html).trim();
  return `<p>${escapeHtml(String(payload.text || "").trim()).replace(/\n/g, "<br />")}</p>`;
}

function bodyTextFromPayload(payload: TemplatePayload) {
  if (payload.text) return String(payload.text).trim();
  return String(payload.html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function renderTransactionalEmailTemplate(payload: TemplatePayload) {
  const bodyHtml = bodyHtmlFromPayload(payload);
  const bodyText = bodyTextFromPayload(payload);
  const safeCompanyName = escapeHtml(String(payload.companyName || "Produ"));
  const footerHtml = `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e8eef8;font-size:12px;line-height:1.7;color:#64748b">Correo creado con ♥ por <a href="https://www.produ.cl/" target="_blank" rel="noreferrer" style="color:#1e4ed8;text-decoration:none;font-weight:700">Produ</a>.</div>`;
  const footerText = `\n\nCorreo creado con ♥ por Produ: https://www.produ.cl/`;
  return {
    html: `
      <div style="margin:0;padding:32px 16px;background:#eef4fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#132238">
        <div style="max-width:720px;margin:0 auto">
          <div style="background:linear-gradient(180deg,#dceafe 0%,#edf4ff 100%);border:1px solid #d5e3f7;border-bottom:none;border-radius:24px 24px 0 0;padding:28px 32px 22px 32px;text-align:center">
            <div style="text-align:center">
              <div style="font-size:30px;line-height:1;font-weight:800;letter-spacing:-.04em;color:#12233f">Produ</div>
              <div style="margin-top:6px;font-size:13px;line-height:1.2;color:#55708e">Gestión de Productoras</div>
              <div style="margin-top:16px;font-size:16px;line-height:1.4;color:#1f3655;font-weight:700">Notificación de ${safeCompanyName}</div>
            </div>
          </div>
          <div style="background:#ffffff;border:1px solid #d5e3f7;border-top:none;border-radius:0 0 24px 24px;padding:34px 36px 30px 36px;box-shadow:0 26px 50px rgba(15,23,42,.06)">
            <div style="max-width:560px;margin:0 auto">
              <div style="font-size:15px;line-height:1.9;color:#24364d">
                ${bodyHtml}
              </div>
              ${footerHtml}
            </div>
          </div>
          <div style="padding:14px 10px 0 10px;text-align:center;font-size:11px;line-height:1.6;color:#7b8ba3">
            Plataforma de gestión para productoras audiovisuales.
          </div>
        </div>
      </div>
    `.trim(),
    text: `${bodyText}${footerText}`.trim(),
  };
}

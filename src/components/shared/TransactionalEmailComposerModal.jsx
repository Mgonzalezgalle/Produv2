import React, { useEffect, useState } from "react";
import { Badge, FG, FI, FTA, GBtn, Modal } from "../../lib/ui/components";
import { getTransactionalEmailTemplateDefinition } from "../../lib/integrations/transactionalEmailTemplates";
import { commentAttachmentFromFile, normalizeCommentAttachments } from "../../lib/utils/helpers";

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function composePreviewHtml(body = "", fixedHtmlBlocks = [], insertAfterBlocks = null) {
  const blocks = String(body || "")
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`);
  const insertIndex = Number.isFinite(Number(insertAfterBlocks))
    ? Math.max(0, Math.min(blocks.length, Number(insertAfterBlocks)))
    : blocks.length;
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#0f172a">${[
    ...blocks.slice(0, insertIndex),
    ...fixedHtmlBlocks,
    ...blocks.slice(insertIndex),
  ].join("")}</div>`;
}

export function TransactionalEmailComposerModal({
  open,
  draft,
  sending = false,
  onClose,
  onSend,
}) {
  const [form, setForm] = useState({ to: "", subject: "", body: "" });
  const [attachments, setAttachments] = useState([]);
  const templateLabel = getTransactionalEmailTemplateDefinition(draft?.templateKey)?.label || "Correo";
  const fixedHtmlBlocks = Array.isArray(draft?.fixedHtmlBlocks) ? draft.fixedHtmlBlocks : [];
  const fixedHtmlInsertAfterBlocks = draft?.fixedHtmlInsertAfterBlocks ?? null;

  useEffect(() => {
    if (!open) return;
    setForm({
      to: String(draft?.to || "").trim(),
      subject: String(draft?.subject || "").trim(),
      body: String(draft?.body || "").trim(),
    });
    setAttachments(normalizeCommentAttachments({ attachments: draft?.attachments || [] }));
  }, [draft, open]);

  const loadAttachments = async files => {
    const nextAttachments = await Promise.all(Array.from(files || []).slice(0, 6).map(commentAttachmentFromFile));
    setAttachments(prev => [...prev, ...nextAttachments.filter(Boolean)].slice(0, 6));
  };

  return (
    <Modal
      open={open}
      onClose={sending ? () => {} : onClose}
      title="Revisar correo"
      sub="Antes de enviar, el tenant puede revisar destinatario, asunto y contenido."
      wide
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Badge sm label={templateLabel} color="purple" />
        {draft?.metadata?.entityLabel && <Badge sm label={String(draft.metadata.entityLabel)} color="cyan" />}
      </div>
      <FG label="Destinatario">
        <FI
          value={form.to}
          onChange={e => setForm(prev => ({ ...prev, to: e.target.value }))}
          placeholder="correo@cliente.cl"
        />
      </FG>
      <FG label="Asunto">
        <FI
          value={form.subject}
          onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
          placeholder="Asunto del correo"
        />
      </FG>
      <FG label="Mensaje">
        <FTA
          value={form.body}
          onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
          rows={10}
          placeholder="Escribe el cuerpo del correo"
        />
      </FG>
      <FG label="Adjuntos">
        <input type="file" accept="image/*,application/pdf" multiple onChange={async e => { await loadAttachments(e.target.files); e.target.value = ""; }} />
        {!!attachments.length && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 8, marginTop: 10 }}>
            {attachments.map(att => <div key={att.id || att.src} style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--bdr)", background: "var(--sur)" }}>
              {att.type === "pdf"
                ? <div style={{ display: "grid", placeItems: "center", height: 92, padding: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                    <div style={{ fontSize: 10, color: "var(--gr3)", lineHeight: 1.35, wordBreak: "break-word" }}>{att.name || "PDF"}</div>
                  </div>
                : <img src={att.src} alt={att.name || "Adjunto"} style={{ display: "block", width: "100%", height: 92, objectFit: "cover" }} />}
              <button onClick={() => setAttachments(prev => prev.filter(item => item.id !== att.id))} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(15,23,42,.84)", color: "#fff", cursor: "pointer" }}>×</button>
            </div>)}
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6 }}>Puedes adjuntar hasta 6 archivos entre imágenes y PDF.</div>
      </FG>
      <div style={{ marginTop: 18, padding: 14, borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
        <div style={{ fontSize: 11, color: "var(--gr3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Vista previa</div>
        <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 8 }}>Para: {form.to || "—"}</div>
        <div style={{ fontSize: 12, color: "var(--wh)", fontWeight: 700, marginBottom: 10 }}>{form.subject || "Sin asunto"}</div>
        {fixedHtmlBlocks.length ? (
          <div
            style={{ borderRadius: 10, overflow: "hidden", background: "#fff" }}
            dangerouslySetInnerHTML={{ __html: composePreviewHtml(form.body, fixedHtmlBlocks, fixedHtmlInsertAfterBlocks) }}
          />
        ) : (
          <div style={{ fontSize: 13, color: "var(--gr2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{form.body || "Sin contenido"}</div>
        )}
        {!!attachments.length && <div style={{ marginTop: 10, fontSize: 11, color: "var(--gr2)" }}>Adjuntos: {attachments.map(att => att.name || "archivo").join(", ")}</div>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--bdr)" }}>
        <GBtn onClick={onClose} disabled={sending}>Cancelar</GBtn>
        <button
          type="button"
          onClick={() => onSend?.({ ...draft, ...form, attachments })}
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--cy)",
            background: "var(--cy)",
            color: "#051018",
            fontWeight: 800,
            cursor: sending ? "default" : "pointer",
            opacity: sending ? 0.7 : 1,
          }}
        >
          {sending ? "Enviando..." : "Enviar correo"}
        </button>
      </div>
    </Modal>
  );
}

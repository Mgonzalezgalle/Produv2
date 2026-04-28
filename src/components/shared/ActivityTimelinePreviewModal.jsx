import React from "react";
import { Badge, Modal } from "../../lib/ui/components";
import { normalizeCommentAttachments } from "../../lib/utils/helpers";

function attachmentLabel(count = 0) {
  return `${count} adjunto${count === 1 ? "" : "s"}`;
}

export function ActivityTimelinePreviewModal({
  open,
  item,
  title,
  subtitle,
  dateLabel,
  authorLabel,
  originLabel,
  meta,
  preview,
  onClose,
}) {
  const attachments = normalizeCommentAttachments({ attachments: item?.attachments || [] });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || "Detalle"}
      sub={subtitle || "Vista del registro"}
      wide
    >
      {item && (
        <>
          <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}><b>Fecha:</b> {dateLabel || "—"}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}><b>Registrado por:</b> {authorLabel || "Sistema"}</div>
            {originLabel ? <div style={{ fontSize: 12, color: "var(--gr2)" }}><b>Origen:</b> {originLabel}</div> : null}
          </div>
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--bdr)", background: "var(--sur)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: meta?.accent || "#4f7cff" }}>
                {meta?.eyebrow || "Registro"}
              </span>
              <Badge label={meta?.label || "Actividad"} color="gray" sm />
              {!!attachments.length && <Badge label={attachmentLabel(attachments.length)} color="cyan" sm />}
            </div>
            <div style={{ fontSize: 13, color: "var(--gr3)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {preview || "Sin contenido"}
            </div>
          </div>
          {!!attachments.length && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginTop: 14 }}>
              {attachments.map(att => (
                <a
                  key={att.id || att.src}
                  href={att.src}
                  target="_blank"
                  rel="noreferrer"
                  download={att.name || true}
                  style={{ display: "block", borderRadius: 12, overflow: "hidden", border: "1px solid var(--bdr)", textDecoration: "none", background: "var(--bg2)" }}
                >
                  {att.type === "pdf" ? (
                    <div style={{ display: "grid", placeItems: "center", height: 96, padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                      <div style={{ fontSize: 10, color: "var(--gr3)", lineHeight: 1.35, wordBreak: "break-word" }}>{att.name || "Documento PDF"}</div>
                    </div>
                  ) : (
                    <img src={att.src} alt={att.name || "Adjunto"} style={{ display: "block", width: "100%", height: 96, objectFit: "cover" }} />
                  )}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

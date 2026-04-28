import React from "react";
import { Badge } from "../../lib/ui/components";

function renderAttachmentLabel(count = 0) {
  return `${count} adjunto${count === 1 ? "" : "s"}`;
}

export function ActivityTimelineCard({
  meta,
  headline,
  secondary,
  preview,
  attachments = [],
  dateLabel,
  authorLabel,
  onClick,
  interactive = false,
  previewLines = 3,
}) {
  const content = (
    <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 12, alignItems: "start" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          border: `1px solid ${meta?.accent || "#94a3b8"}`,
          color: meta?.accent || "#94a3b8",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          fontWeight: 800,
          marginTop: 2,
        }}
      >
        ›
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: meta?.accent || "#94a3b8",
            }}
          >
            {meta?.eyebrow || "Registro"}
          </span>
          <Badge label={meta?.label || "Actividad"} color="gray" sm />
          {!!attachments.length && <Badge label={renderAttachmentLabel(attachments.length)} color="cyan" sm />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", lineHeight: 1.4, marginBottom: 4 }}>
          {headline || "Registro sin asunto"}
        </div>
        {!!secondary && (
          <div
            style={{
              fontSize: 12,
              color: "var(--cy)",
              lineHeight: 1.45,
              marginBottom: 8,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {secondary}
          </div>
        )}
        <div
          style={{
            fontSize: 12,
            color: "var(--gr3)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            display: "-webkit-box",
            WebkitLineClamp: previewLines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {preview || "Sin contenido"}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--gr2)", whiteSpace: "nowrap", textAlign: "right" }}>
        <div>{dateLabel || "—"}</div>
        <div style={{ marginTop: 4 }}>{authorLabel || "Sistema"}</div>
      </div>
    </div>
  );

  const frameStyle = {
    width: "100%",
    textAlign: "left",
    padding: 14,
    borderRadius: 14,
    border: "1px solid var(--bdr2)",
    background: "var(--sur)",
    cursor: interactive ? "pointer" : "default",
  };

  const attachmentsBlock = !!attachments.length && (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginTop: 12, paddingLeft: 36 }}>
      {attachments.map(att => (
        <a
          key={att.id || att.src}
          href={att.src}
          target="_blank"
          rel="noreferrer"
          download={att.name || true}
          onClick={event => event.stopPropagation()}
          style={{
            display: "block",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--bdr)",
            textDecoration: "none",
            background: "var(--bg2)",
          }}
        >
          {att.type === "pdf" ? (
            <div style={{ display: "grid", placeItems: "center", height: 96, padding: 10, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
              <div style={{ fontSize: 10, color: "var(--gr3)", lineHeight: 1.35, wordBreak: "break-word" }}>
                {att.name || "Documento PDF"}
              </div>
            </div>
          ) : (
            <img src={att.src} alt={att.name || "Adjunto"} style={{ display: "block", width: "100%", height: 96, objectFit: "cover" }} />
          )}
        </a>
      ))}
    </div>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} style={frameStyle}>
        {content}
        {attachmentsBlock}
      </button>
    );
  }

  return (
    <div style={frameStyle}>
      {content}
      {attachmentsBlock}
    </div>
  );
}

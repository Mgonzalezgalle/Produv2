import React from "react";

function parseSimpleRichText(text = "") {
  const safeText = String(text || "");
  if (!safeText.trim()) return [{ id: "0-", bullet: false, parts: [{ text: "" }] }];
  return safeText.split("\n").map((rawLine, index) => {
    const bullet = /^\s*[-•]\s+/.test(rawLine);
    const content = bullet ? rawLine.replace(/^\s*[-•]\s+/, "") : rawLine;
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: content.slice(lastIndex, match.index) });
      }
      if (match[2]) {
        parts.push({ text: match[2], bold: true });
      } else if (match[3]) {
        parts.push({ text: match[3], italic: true });
      } else if (match[4] && match[5]) {
        parts.push({ text: match[4], href: match[5] });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < content.length) parts.push({ text: content.slice(lastIndex) });
    if (!parts.length) parts.push({ text: "" });
    return { id: `${index}-${content}`, bullet, parts };
  });
}

export function RichTextBlock({ text = "", style = {}, color = "inherit" }) {
  const lines = parseSimpleRichText(text);
  return <div style={style}>
    {lines.map(line => <div key={line.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", minHeight: line.parts.some(part => part.text) ? undefined : 10 }}>
      {line.bullet && <span style={{ color, opacity: 0.75, lineHeight: 1.5 }}>•</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        {line.parts.map((part, index) => part.href
          ? <a key={`${line.id}-${index}`} href={part.href} target="_blank" rel="noreferrer" style={{ fontWeight: part.bold ? 700 : 400, fontStyle: part.italic ? "italic" : "normal", color: "var(--cy)", textDecoration: "underline", textUnderlineOffset: 2, wordBreak: "break-word" }}>
              {part.text}
            </a>
          : <span key={`${line.id}-${index}`} style={{ fontWeight: part.bold ? 700 : 400, fontStyle: part.italic ? "italic" : "normal" }}>
              {part.text}
            </span>)}
      </span>
    </div>)}
  </div>;
}

export const StyleTag = ({ css = "" }) => <style dangerouslySetInnerHTML={{ __html: css }} />;

export function Skeleton({ w = "100%", h = 14, r = 6, mb = 8 }) {
  return <div style={{ width: w, height: h, borderRadius: r, marginBottom: mb, background: "linear-gradient(90deg,var(--bdr) 25%,var(--bdr2) 50%,var(--bdr) 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

export function SkeletonCard() {
  return <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 20 }}>
    <Skeleton h={18} w="60%" mb={12} />
    <Skeleton h={12} w="90%" mb={8} />
    <Skeleton h={12} w="75%" mb={8} />
    <Skeleton h={12} w="80%" />
  </div>;
}

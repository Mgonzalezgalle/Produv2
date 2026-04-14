import React from "react";

export function ContactBtns({ tel, ema, nombre, mensaje, origen, onEmail, emailLabel = "Email" }) {
  const originLabel = origen || "tu empresa";
  const waMsg = mensaje || `Hola ${nombre || ""}, te contactamos desde ${originLabel}.`;
  const waNum = (tel || "").replace(/[^0-9]/g, "");
  const waUrl = `https://wa.me/${waNum.startsWith("56") ? waNum : "56" + waNum}?text=${encodeURIComponent(waMsg)}`;
  const mailUrl = `mailto:${ema || ""}?subject=${encodeURIComponent(`Contacto desde ${originLabel}`)}&body=${encodeURIComponent(waMsg)}`;
  if (!tel && !ema) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {tel && <a href={waUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "#25D36618", border: "1px solid #25D36640", color: "#25D366", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        WhatsApp
      </a>}
      {ema && (onEmail
        ? <button
            type="button"
            onClick={onEmail}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "var(--cg)", border: "1px solid var(--cm)", color: "var(--cy)", fontSize: 12, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cy)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            {emailLabel}
          </button>
        : <a href={mailUrl} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, background: "var(--cg)", border: "1px solid var(--cm)", color: "var(--cy)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cy)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            {emailLabel}
          </a>)}
    </div>
  );
}

import React, { forwardRef, useEffect, useRef, useState } from "react";

const BP = {
  cyan: ["var(--cg)", "var(--cy)", "var(--cm)"],
  green: ["#00e08a18", "#00e08a", "#00e08a35"],
  red: ["#ff556618", "#ff5566", "#ff556635"],
  yellow: ["#ffcc4418", "#ffcc44", "#ffcc4435"],
  orange: ["#ff884418", "#ff8844", "#ff884435"],
  purple: ["#a855f718", "#a855f7", "#a855f735"],
  gray: ["var(--bdr)", "var(--gr2)", "var(--bdr2)"],
};

const SM = {
  "En Curso": "cyan",
  "Pre-Producción": "yellow",
  "Post-Producción": "orange",
  Finalizado: "green",
  Pausado: "gray",
  Activo: "green",
  "En Desarrollo": "yellow",
  Vigente: "green",
  Borrador: "gray",
  "En Revisión": "yellow",
  Firmado: "cyan",
  Vencido: "red",
  Planificado: "yellow",
  Grabado: "cyan",
  "En Edición": "cyan",
  Programado: "purple",
  Publicado: "green",
  Cancelado: "red",
  Negociación: "yellow",
  Aceptado: "green",
  Rechazado: "red",
  Pagado: "green",
  Pendiente: "yellow",
  Vencida: "red",
  "Auspiciador Principal": "cyan",
  "Auspiciador Secundario": "yellow",
  Colaborador: "green",
  Canje: "orange",
  "Media Partner": "gray",
};

export function Badge({ label, color, sm }) {
  const palette = BP[color || SM[label] || "gray"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: sm ? "2px 7px" : "3px 10px",
        borderRadius: 20,
        fontSize: sm ? 9 : 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        background: palette[0],
        color: palette[1],
        border: `1px solid ${palette[2]}`,
      }}
    >
      {label}
    </span>
  );
}

export function Paginator({ page, total, perPage, onChange }) {
  const pages = Math.ceil(total / perPage) || 1;
  if (total <= perPage) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const nums = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (Math.abs(i - page) === 2) nums.push("…");
  }
  const dd = nums.filter((v, i, a) => v !== "…" || a[i - 1] !== "…");
  const bs = on => ({
    width: 30,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${on ? "var(--cy)" : "var(--bdr2)"}`,
    background: on ? "var(--cy)" : "transparent",
    color: on ? "var(--bg)" : "var(--gr2)",
    fontFamily: "var(--fm)",
  });
  return (
    <div
      className="pager"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 16,
        paddingTop: 14,
        borderTop: "1px solid var(--bdr)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--gr2)" }}>
        Mostrando <b style={{ color: "var(--wh)" }}>{from}–{to}</b> de{" "}
        <b style={{ color: "var(--wh)" }}>{total}</b>
      </span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button style={bs(false)} disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
        {dd.map((v, i) =>
          v === "…" ? (
            <span key={i} style={{ color: "var(--gr)", padding: "0 4px", fontSize: 11, alignSelf: "center" }}>
              …
            </span>
          ) : (
            <button key={v} style={bs(v === page)} onClick={() => onChange(v)}>
              {v}
            </button>
          ),
        )}
        <button style={bs(false)} disabled={page >= pages} onClick={() => onChange(page + 1)}>›</button>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, wide, extraWide }) {
  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  if (!open) return null;
  const mob = window.innerWidth <= 768;
  return (
    <div
      className="modal-wrap"
      onClick={e => {
        if (e.target === e.currentTarget && !mob) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "rgba(0,0,0,.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: mob ? "flex-end" : "center",
        justifyContent: "center",
        padding: mob ? 0 : 20,
      }}
    >
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          border: "1px solid var(--bdr2)",
          borderRadius: mob ? "16px 16px 0 0" : 14,
          width: mob ? "100%" : extraWide ? 1120 : wide ? 820 : 600,
          maxWidth: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: mob ? "20px 16px" : 28,
          animation: mob ? "slideIn .25s ease" : "modalIn .2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontSize: mob ? 18 : 20, fontWeight: 800, color: "var(--wh)" }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 3 }}>{sub}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--gr2)", cursor: "pointer", padding: 4, borderRadius: 4, fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const FS = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--sur)",
  border: "1px solid var(--bdr2)",
  borderRadius: 6,
  color: "var(--wh)",
  fontFamily: "var(--fb)",
  fontSize: 13,
  outline: "none",
};

export const FG = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--gr3)", marginBottom: 6, letterSpacing: 0.3 }}>{label}</label>
    {children}
  </div>
);

export const FI = ({ onClick, onMouseDown, onPointerDown, ...props }) => (
  <input
    style={FS}
    onPointerDown={e => {
      e.stopPropagation();
      onPointerDown?.(e);
    }}
    onMouseDown={e => {
      e.stopPropagation();
      onMouseDown?.(e);
    }}
    onClick={e => {
      e.stopPropagation();
      onClick?.(e);
    }}
    {...props}
  />
);
export const FSl = ({ children, onClick, onMouseDown, onPointerDown, ...props }) => (
  <select
    style={{ ...FS, cursor: "pointer" }}
    onPointerDown={e => {
      e.stopPropagation();
      onPointerDown?.(e);
    }}
    onMouseDown={e => {
      e.stopPropagation();
      onMouseDown?.(e);
    }}
    onClick={e => {
      e.stopPropagation();
      onClick?.(e);
    }}
    {...props}
  >
    {children}
  </select>
);
export const FTA = forwardRef((props, ref) => (
  <textarea
    ref={ref}
    style={{ ...FS, resize: "vertical", minHeight: 80 }}
    {...props}
  />
));
export const R2 = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12 }}>{children}</div>;
export const R3 = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 12 }}>{children}</div>;

export const MFoot = ({ onClose, onSave, label = "Guardar", disabled = false }) => (
  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--bdr)" }}>
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClose?.();
      }}
      style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
    >
      Cancelar
    </button>
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        if (disabled) return;
        onSave?.();
      }}
      disabled={disabled}
      style={{ padding: "8px 18px", borderRadius: 6, border: "none", background: disabled ? "var(--bdr2)" : "var(--cy)", color: disabled ? "var(--gr2)" : "var(--bg)", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, opacity: disabled ? 0.7 : 1 }}
    >
      {label}
    </button>
  </div>
);

export const Btn = ({ onClick, children, sm, s = {} }) => <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: sm ? "6px 12px" : "9px 18px", borderRadius: 6, border: "none", background: "var(--cy)", color: "var(--bg)", cursor: "pointer", fontSize: sm ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap", ...s }}>{children}</button>;
export const GBtn = ({ onClick, children, sm, s = {} }) => <button onClick={onClick} style={{ padding: sm ? "5px 11px" : "7px 14px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: sm ? 11 : 12, fontWeight: 600, ...s }}>{children}</button>;
export const DBtn = ({ onClick, children, sm }) => <button onClick={onClick} style={{ padding: sm ? "4px 9px" : "7px 12px", borderRadius: 6, border: "1px solid #ff556625", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: sm ? 10 : 12, fontWeight: 600 }}>{children}</button>;
export const XBtn = ({ onClick }) => <button onClick={onClick} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #ff556625", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>✕</button>;

export function Stat({ label, value, sub, accent = "var(--cy)", vc }) {
  return (
    <div style={{ background: "linear-gradient(180deg,var(--card),var(--card2))", border: "1px solid var(--bdr)", borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gr2)", marginBottom: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 500, color: vc || "var(--wh)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export const TH = ({ children, onClick, active = false, dir = "", style, title }) => (
  <th onClick={onClick} title={title} style={{ textAlign: "left", padding: "12px 14px", fontSize: 10, letterSpacing: 1.7, textTransform: "uppercase", color: active ? "var(--cy)" : "var(--gr2)", borderBottom: "1px solid var(--bdr)", fontWeight: 700, whiteSpace: "nowrap", background: "linear-gradient(180deg,var(--card2),transparent)", cursor: onClick ? "pointer" : "default", userSelect: "none", ...style }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span>{children}</span>
      {active && <span style={{ fontSize: 10, lineHeight: 1 }}>{dir === "desc" ? "↓" : "↑"}</span>}
    </span>
  </th>
);

export const TD = ({ children, bold, mono, style = {} }) => <td style={{ padding: "12px 14px", fontSize: 12.5, color: bold ? "var(--wh)" : "var(--gr3)", borderBottom: "1px solid var(--bdr)", fontFamily: mono ? "var(--fm)" : "inherit", fontWeight: bold ? 600 : 400, verticalAlign: "middle", ...style }}>{children}</td>;

export function Card({ title, sub, action, children, style = {} }) {
  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, display: "block", background: "linear-gradient(180deg,var(--card),var(--card2))", border: "1px solid var(--bdr)", borderRadius: 16, padding: 20, boxShadow: "0 12px 32px rgba(0,0,0,.08)", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, paddingBottom: 12, borderBottom: "1px solid var(--bdr)" }}>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 800 }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 3 }}>{sub}</div>}
          </div>
          {action && <button onClick={action.fn} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{action.label}</button>}
        </div>
      )}
      {children}
    </div>
  );
}

export function ModuleHeader({ module, title, description, actions, style = {} }) {
  return (
    <div style={{ width: "100%", minWidth: 0, marginBottom: 22, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 22, fontWeight: 800, color: "var(--wh)", lineHeight: 1.05 }}>
            {title}
          </div>
          {description ? <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 8, lineHeight: 1.6, maxWidth: 760 }}>{description}</div> : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
      <div style={{ width: "100%", height: 1, background: "linear-gradient(90deg,var(--bdr2),transparent 70%)", marginTop: 18 }} />
    </div>
  );
}

export const Empty = ({ text, sub }) => (
  <div style={{ textAlign: "center", padding: "44px 24px", color: "var(--gr2)", background: "linear-gradient(180deg,transparent,var(--card2))", border: "1px dashed var(--bdr2)", borderRadius: 14 }}>
    <div style={{ fontSize: 34, marginBottom: 12, opacity: 0.35 }}>◻</div>
    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--gr3)" }}>{text}</p>
    {sub && <small style={{ fontSize: 11, color: "var(--gr)", marginTop: 6, display: "block" }}>{sub}</small>}
  </div>
);

export const Sep = () => <hr style={{ border: "none", borderTop: "1px solid var(--bdr)", margin: "16px 0" }} />;
export const Tabs = ({ tabs, active, onChange }) => <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>{tabs.map((t, i) => <div key={t} onClick={() => onChange(i)} style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${active === i ? "var(--cm)" : "var(--bdr)"}`, borderRadius: 999, background: active === i ? "linear-gradient(180deg,var(--cg),transparent)" : "var(--card)", color: active === i ? "var(--cy)" : "var(--gr2)", whiteSpace: "nowrap", boxShadow: active === i ? "inset 0 0 0 1px var(--cg)" : "none" }}>{t}</div>)}</div>;
export const KV = ({ label, value }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}><span style={{ fontSize: 12, color: "var(--gr2)" }}>{label}</span><span style={{ fontSize: 13, textAlign: "right", maxWidth: "60%" }}>{value}</span></div>;

export function SearchBar({ value, onChange, placeholder }) {
  return <div className="search-wrap" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(180deg,var(--sur),var(--card2))", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "10px 13px", flex: "1 1 320px", minWidth: 260, width: "100%", boxShadow: "0 6px 18px rgba(0,0,0,.04)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ background: "none", border: "none", color: "var(--wh)", fontFamily: "var(--fb)", fontSize: 13, flex: 1, outline: "none", minWidth: 0 }} />{value && <span onClick={() => onChange("")} style={{ cursor: "pointer", color: "var(--gr2)", fontSize: 14 }}>×</span>}</div>;
}

export function FilterSel({ value, onChange, options, placeholder, onPointerDown, ...props }) {
  return <select
    value={value}
    onPointerDown={e => {
      e.stopPropagation();
      onPointerDown?.(e);
    }}
    onMouseDown={e => e.stopPropagation()}
    onClick={e => e.stopPropagation()}
    onChange={e => onChange(e.target.value)}
    style={{ padding: "10px 12px", minHeight: 44, background: "linear-gradient(180deg,var(--sur),var(--card2))", border: "1px solid var(--bdr2)", borderRadius: 10, color: "var(--gr3)", fontFamily: "var(--fb)", fontSize: 12, cursor: "pointer", outline: "none", boxShadow: "0 6px 18px rgba(0,0,0,.04)" }}
    {...props}
  ><option value="">{placeholder}</option>{options.map(o => typeof o === "object" ? <option key={o.value} value={o.value}>{o.label}</option> : <option key={o}>{o}</option>)}</select>;
}

export function ViewModeToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: 3, boxShadow: "0 6px 18px rgba(0,0,0,.04)" }}>
      {[["cards", "⊟", "Cards"], ["list", "☰", "Lista"]].map(([v, icon, label]) => <button key={v} onClick={() => onChange(v)} title={label} style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: value === v ? "var(--cy)" : "transparent", color: value === v ? "var(--bg)" : "var(--gr2)", cursor: "pointer", fontSize: 13, fontWeight: 700, minWidth: 36 }}>{icon}</button>)}
    </div>
  );
}

export function MultiSelect({ options, value = [], onChange, placeholder = "Seleccionar..." }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = v => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return <div ref={ref} style={{ position: "relative" }}><div onClick={() => setOpen(!open)} style={{ minHeight: 40, padding: "7px 12px", background: "var(--sur)", border: `1px solid ${open ? "var(--cy)" : "var(--bdr2)"}`, borderRadius: 6, cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>{!value.length ? <span style={{ color: "var(--gr)", fontSize: 12 }}>{placeholder}</span> : value.map(v => { const l = options.find(o => o.value === v)?.label || v; return <span key={v} style={{ background: "var(--cm)", color: "var(--cy)", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{l}<span onClick={e => { e.stopPropagation(); toggle(v); }} style={{ cursor: "pointer", opacity: 0.7 }}>×</span></span>; })}</div>{open && <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--card2)", border: "1px solid var(--bdr2)", borderRadius: 6, zIndex: 600, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px #0007" }}>{options.map(o => <div key={o.value} onClick={() => toggle(o.value)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", fontSize: 12.5, color: value.includes(o.value) ? "var(--cy)" : "var(--gr3)", background: value.includes(o.value) ? "var(--cg)" : "transparent" }}><div style={{ width: 14, height: 14, border: `1px solid ${value.includes(o.value) ? "var(--cy)" : "var(--bdr2)"}`, borderRadius: 3, background: value.includes(o.value) ? "var(--cy)" : "var(--sur)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, fontWeight: 700, color: "var(--bg)" }}>{value.includes(o.value) ? "✓" : ""}</div>{o.label}</div>)}{!options.length && <div style={{ padding: 12, color: "var(--gr)", fontSize: 12, textAlign: "center" }}>Sin opciones</div>}</div>}</div>;
}

export const DetHeader = ({ title, tag, badges = [], meta = [], actions, des }) => <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}><div>{tag && <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--cy)", fontWeight: 700, marginBottom: 6 }}>{tag}</div>}<div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>{badges.map((b, i) => <span key={i}>{b}</span>)}{meta.filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}</div>{des && <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 8, maxWidth: 580 }}>{des}</div>}</div>{actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}</div>;

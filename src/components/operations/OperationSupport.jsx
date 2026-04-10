import { useState } from "react";
import { Badge, Card, Empty, GBtn, Paginator, TD, TH, XBtn } from "../../lib/ui/components";

export function MovBlock({ movimientos, tipo, eid, etype, onAdd, onDel, canEdit, fmtM, fmtD }) {
  const lbl = { ingreso: "Ingresos", gasto: "Gastos / Egresos", caja: "Movimientos de Caja" }[tipo];
  const items = (movimientos || []).filter(m => m.tipo === tipo && m.eid === eid);
  const total = items.reduce((s, m) => s + Number(m.mon), 0);
  const mc = tipo === "ingreso" ? "#00e08a" : tipo === "gasto" ? "#ff5566" : "var(--wh)";
  const [pg, setPg] = useState(1);
  const [sortMode, setSortMode] = useState("date-desc");
  const PP = 8;
  const sorted = [...items].sort((a, b) => {
    if (sortMode === "desc-asc") return String(a.des || "").localeCompare(String(b.des || ""));
    if (sortMode === "desc-desc") return String(b.des || "").localeCompare(String(a.des || ""));
    if (sortMode === "amount-asc") return Number(a.mon || 0) - Number(b.mon || 0);
    if (sortMode === "amount-desc") return Number(b.mon || 0) - Number(a.mon || 0);
    if (sortMode === "date-asc") return String(a.fec || "").localeCompare(String(b.fec || ""));
    return String(b.fec || "").localeCompare(String(a.fec || ""));
  });
  const handleAdd = () => onAdd && onAdd(eid, etype, tipo);

  return <Card title={lbl} sub="Total: ">
    {canEdit && (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <GBtn onClick={handleAdd}>+ Agregar</GBtn>
      </div>
    )}
    <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: -10, marginBottom: 12 }}>
      Total: <span style={{ color: mc, fontFamily: "var(--fm)" }}>{fmtM(total)}</span>
    </div>
    {items.length > 0
      ? <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH onClick={() => setSortMode(sortMode === "desc-asc" ? "desc-desc" : "desc-asc")} active={sortMode === "desc-asc" || sortMode === "desc-desc"} dir={sortMode === "desc-desc" ? "desc" : "asc"}>Descripción</TH>
                  <TH>Categoría</TH>
                  <TH onClick={() => setSortMode(sortMode === "date-asc" ? "date-desc" : "date-asc")} active={sortMode === "date-asc" || sortMode === "date-desc"} dir={sortMode === "date-desc" ? "desc" : "asc"}>Fecha</TH>
                  <TH onClick={() => setSortMode(sortMode === "amount-asc" ? "amount-desc" : "amount-asc")} active={sortMode === "amount-asc" || sortMode === "amount-desc"} dir={sortMode === "amount-desc" ? "desc" : "asc"}>Monto</TH>
                  {canEdit && <TH></TH>}
                </tr>
              </thead>
              <tbody>
                {sorted.slice((pg - 1) * PP, pg * PP).map(m => <tr key={m.id}>
                  <TD bold>{m.des}</TD>
                  <TD><Badge label={m.cat || "General"} color="gray" sm /></TD>
                  <TD mono style={{ fontSize: 11 }}>{m.fec ? fmtD(m.fec) : "—"}</TD>
                  <TD style={{ color: mc, fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(m.mon)}</TD>
                  {canEdit && <TD><XBtn onClick={() => onDel(m.id)} /></TD>}
                </tr>)}
              </tbody>
            </table>
          </div>
          <Paginator page={pg} total={sorted.length} perPage={PP} onChange={setPg} />
        </>
      : <Empty text={`Sin ${lbl.toLowerCase()}`} sub={canEdit ? 'Clic en "+ Agregar" para comenzar' : ""} />}
  </Card>;
}

export function MiniCal({ refId, eventos, onAdd, onDel, onEdit, canEdit, titulo, fmtD }) {
  const propios = (eventos || []).filter(e => e.ref === refId);
  const [pg, setPg] = useState(1);
  const [sortMode, setSortMode] = useState("date-asc");
  const PP = 8;
  const TIPOS = [
    { v: "grabacion", ico: "🎬", lbl: "Grabación", c: "var(--cy)" },
    { v: "emision", ico: "📡", lbl: "Emisión", c: "#00e08a" },
    { v: "reunion", ico: "💬", lbl: "Reunión", c: "#ffcc44" },
    { v: "entrega", ico: "✓", lbl: "Entrega", c: "#ff8844" },
    { v: "otro", ico: "📌", lbl: "Otro", c: "#7c7c8a" },
  ];
  const tc = v => TIPOS.find(t => t.v === v)?.c || "#7c7c8a";
  const ti = v => TIPOS.find(t => t.v === v)?.ico || "📌";
  const tl = v => TIPOS.find(t => t.v === v)?.lbl || v;
  const sorted = [...propios].sort((a, b) => {
    if (sortMode === "type-asc") return String(tl(a.tipo) || "").localeCompare(String(tl(b.tipo) || ""));
    if (sortMode === "type-desc") return String(tl(b.tipo) || "").localeCompare(String(tl(a.tipo) || ""));
    if (sortMode === "title-asc") return String(a.titulo || "").localeCompare(String(b.titulo || ""));
    if (sortMode === "title-desc") return String(b.titulo || "").localeCompare(String(a.titulo || ""));
    if (sortMode === "date-desc") return String(b.fecha || "").localeCompare(String(a.fecha || ""));
    return String(a.fecha || "").localeCompare(String(b.fecha || ""));
  });

  return <Card title={`📅 Fechas — ${titulo || ""}`} action={canEdit ? { label: "+ Evento", fn: onAdd } : null}>
    {sorted.length > 0
      ? <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH onClick={() => setSortMode(sortMode === "type-asc" ? "type-desc" : "type-asc")} active={sortMode === "type-asc" || sortMode === "type-desc"} dir={sortMode === "type-desc" ? "desc" : "asc"}>Tipo</TH>
                  <TH onClick={() => setSortMode(sortMode === "title-asc" ? "title-desc" : "title-asc")} active={sortMode === "title-asc" || sortMode === "title-desc"} dir={sortMode === "title-desc" ? "desc" : "asc"}>Título</TH>
                  <TH onClick={() => setSortMode(sortMode === "date-asc" ? "date-desc" : "date-asc")} active={sortMode === "date-asc" || sortMode === "date-desc"} dir={sortMode === "date-desc" ? "desc" : "asc"}>Fecha</TH>
                  <TH>Hora</TH>
                  <TH>Descripción</TH>
                  {canEdit && <TH></TH>}
                </tr>
              </thead>
              <tbody>
                {sorted.slice((pg - 1) * PP, pg * PP).map(ev => <tr key={ev.id}>
                  <TD><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: tc(ev.tipo) + "22", color: tc(ev.tipo), border: `1px solid ${tc(ev.tipo)}40` }}>{ti(ev.tipo)} {tl(ev.tipo)}</span></TD>
                  <TD bold>{ev.titulo}</TD>
                  <TD mono style={{ fontSize: 11 }}>{ev.fecha ? fmtD(ev.fecha) : "—"}</TD>
                  <TD style={{ fontSize: 12, color: "var(--gr2)" }}>{ev.hora || "—"}</TD>
                  <TD style={{ fontSize: 12, color: "var(--gr3)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.desc || "—"}</TD>
                  {canEdit && <TD><div style={{ display: "flex", gap: 4 }}>{onEdit && <GBtn sm onClick={() => onEdit(ev)}>✏</GBtn>}<XBtn onClick={() => onDel(ev.id)} /></div></TD>}
                </tr>)}
              </tbody>
            </table>
          </div>
          <Paginator page={pg} total={sorted.length} perPage={PP} onChange={setPg} />
        </>
      : <Empty text="Sin fechas registradas" sub={canEdit ? "Agrega el primer evento con el botón arriba" : ""} />}
  </Card>;
}

export function AusCard({ a, pgs, onEdit, onDel, ini, fmtM, fmtD }) {
  return <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 16 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: "var(--bdr)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fh)", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{ini(a.nom)}</div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{a.nom}</div><div style={{ marginTop: 4 }}><Badge label={a.tip} sm /></div></div>
      {onEdit && <GBtn sm onClick={e => { e.stopPropagation(); onEdit(); }}>✏</GBtn>}
      {onDel && <XBtn onClick={e => { e.stopPropagation(); onDel(); }} />}
    </div>
    {(pgs || []).length > 0 && <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>{pgs.map(p => <Badge key={p.id} label={p.nom} color="cyan" sm />)}</div>}
    {a.con && <div style={{ fontSize: 11, color: "var(--gr3)" }}>{a.con}{a.ema ? " · " + a.ema : ""}</div>}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
      {a.mon && Number(a.mon) > 0 ? <span style={{ color: "var(--cy)", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(a.mon)}</span> : <span />}
      <div style={{ display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
        {a.vig && <span style={{ fontSize: 10, color: "var(--gr2)" }}>hasta {fmtD(a.vig)}</span>}
        {a.frecPago && <span style={{ fontSize: 10, color: "var(--gr2)" }}>{a.frecPago}</span>}
      </div>
    </div>
  </div>;
}

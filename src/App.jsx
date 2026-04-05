// ============================================================
//  PRODU — Gestión de Productoras
//  src/App.jsx  |  Parte 1 de 4: Core + Auth + Layout
// ============================================================
import { Component, useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ── SUPABASE ─────────────────────────────────────────────────
const SB_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8";
const sb = createClient(SB_URL, SB_KEY);

async function dbGet(key) {
  try {
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return JSON.parse(data.value);
  } catch { return null; }
}
async function dbSet(key, val) {
  try { await sb.from("storage").upsert({ key, value: JSON.stringify(val) }, { onConflict:"key" }); } catch {}
}

// ── UTILS ────────────────────────────────────────────────────
const uid   = () => "_" + Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split("T")[0];
const addMonths = (dateStr = today(), months = 0) => {
  const [year, month, day] = String(dateStr || today()).split("-").map(Number);
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  if (Number.isNaN(base.getTime())) return dateStr || today();
  base.setMonth(base.getMonth() + Number(months || 0));
  return base.toISOString().split("T")[0];
};
const ini   = (s="") => s.split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmtM  = n => "$" + Number(n||0).toLocaleString("es-CL");
const fmtMoney = (n, currency="CLP") => {
  const value = Number(n || 0);
  if (currency === "UF") return `UF ${value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if (currency === "USD") return "US$" + value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (currency === "EUR") return "€" + value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});
  return fmtM(value);
};
const fmtD  = d => { try { return new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d||"—"; } };
const fmtMonthPeriod = d => {
  try { return new Date(`${d || today()}T12:00:00`).toLocaleDateString("es-CL",{month:"long",year:"numeric"}); }
  catch { return d || "—"; }
};
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PRINT_COLORS = [
  { value:"#545454", label:"Gris ejecutivo" },
  { value:"#000000", label:"Negro" },
  { value:"#172554", label:"Azul institucional" },
];
const COBRANZA_STATES = ["Pendiente de pago","Pagado","No pagado","Retrasado de pago"];
const CAMPANA_ESTADOS = ["Planificada","Activa","Pausada","Cerrada"];
const PIEZA_ESTADOS = ["Planificado","Creado","En Edición","Entregado Cliente","Programado","Correcciones","Publicado","Cancelado"];
const PIEZA_FORMATOS = ["Reel","Carrusel","Historia","TikTok","Post","Video","Story","Otro"];
const PIEZA_PLATAFORMAS = ["Instagram","TikTok","Facebook","LinkedIn","YouTube","X","Multi-plataforma"];
const HASH_RE = /^[a-f0-9]{64}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

async function sha256Hex(text="") {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function isPasswordHash(v="") {
  return HASH_RE.test(String(v||""));
}

async function normalizeUserAuth(user={}) {
  const { password, ...rest } = user||{};
  const passwordHash = user.passwordHash
    ? user.passwordHash
    : user.password
      ? await sha256Hex(user.password)
      : "";
  return {
    ...rest,
    passwordHash,
  };
}

async function normalizeUsersAuth(users=[]) {
  return Promise.all((Array.isArray(users)?users:[]).filter(Boolean).map(normalizeUserAuth));
}

function crewUserId(userId="") {
  return userId || uid();
}

function buildInternalCrewFromUser(user = {}, existing = {}) {
  return {
    id: existing.id || crewUserId(user.id),
    sourceUserId: user.id,
    managedByUser: true,
    empId: user.empId || existing.empId || "",
    nom: user.name || existing.nom || "",
    rol: user.crewRole || existing.rol || "Crew interno",
    area: existing.area || "Producción",
    tipo: "interno",
    tel: existing.tel || "",
    ema: user.email || existing.ema || "",
    dis: existing.dis || "",
    tarifa: "",
    not: existing.not || "",
    active: user.active !== false,
  };
}

function syncCrewWithUsers(allUsers = [], existingCrew = []) {
  const users = Array.isArray(allUsers) ? allUsers : [];
  const crew = Array.isArray(existingCrew) ? existingCrew : [];
  const userMap = Object.fromEntries(users.filter(Boolean).map(u => [u.id, u]));
  const next = [];
  const seen = new Set();

  crew.forEach(item => {
    if (!item?.managedByUser || !item?.sourceUserId) {
      next.push(item);
      return;
    }
    const user = userMap[item.sourceUserId];
    if (!user || !user.empId || user.isCrew !== true) return;
    next.push(buildInternalCrewFromUser(user, item));
    seen.add(user.id);
  });

  users.forEach(user => {
    if (!user?.id || !user?.empId || user.isCrew !== true || seen.has(user.id)) return;
    next.push(buildInternalCrewFromUser(user));
  });

  return next;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

async function commentAttachmentFromFile(file) {
  if (!file) return null;
  const fileType = String(file.type || "");
  if (fileType === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf")) {
    const dataUrl = await fileToDataUrl(file);
    return {
      id: uid(),
      type: "pdf",
      src: dataUrl,
      name: file.name || "documento.pdf",
    };
  }
  if (!fileType.startsWith("image/")) return null;
  const dataUrl = await fileToDataUrl(file);
  const img = await new Promise((resolve, reject) => {
    const node = new Image();
    node.onload = () => resolve(node);
    node.onerror = reject;
    node.src = dataUrl;
  });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(img.width || maxSide, img.height || maxSide));
  if (scale === 1 && file.size <= 900000) {
    return { id: uid(), type: "image", src: dataUrl, name: file.name || "imagen" };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((img.width || maxSide) * scale));
  canvas.height = Math.max(1, Math.round((img.height || maxSide) * scale));
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return {
    id: uid(),
    type: "image",
    src: canvas.toDataURL("image/jpeg", 0.84),
    name: file.name || "imagen",
  };
}

function normalizeCommentAttachments(item = {}) {
  const base = Array.isArray(item.attachments) ? item.attachments : [];
  const legacyPhotos = Array.isArray(item.photos) ? item.photos : [];
  const normalizedBase = base
    .filter(Boolean)
    .map(att => ({
      id: att.id || uid(),
      type: att.type || (String(att.src || "").startsWith("data:application/pdf") ? "pdf" : "image"),
      src: att.src || "",
      name: att.name || (att.type === "pdf" ? "documento.pdf" : "imagen"),
    }))
    .filter(att => att.src);
  const normalizedLegacy = legacyPhotos
    .filter(Boolean)
    .map(att => ({
      id: att.id || uid(),
      type: "image",
      src: att.src || "",
      name: att.name || "imagen",
    }))
    .filter(att => att.src);
  return [...normalizedBase, ...normalizedLegacy].slice(0, 6);
}

function sessionPayload(user, emp) {
  return JSON.stringify({ userId:user?.id||"", empId:emp?.id||null });
}

function hasAddon(empresa, addon) {
  return Array.isArray(empresa?.addons) && empresa.addons.includes(addon);
}

function budgetDraftKey(empresaId="", userId="") {
  return `produ:budgetDraft:${empresaId || "global"}:${userId || "anon"}`;
}

function loadBudgetDraft(empresaId="", userId="") {
  try {
    const raw = localStorage.getItem(budgetDraftKey(empresaId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBudgetDraft(empresaId="", userId="", draft=null) {
  try {
    if (!draft) {
      localStorage.removeItem(budgetDraftKey(empresaId, userId));
      return;
    }
    localStorage.setItem(budgetDraftKey(empresaId, userId), JSON.stringify(draft));
  } catch {}
}

function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date + "T12:00:00");
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - new Date().getTime()) / DAY_MS);
}

function contractVisualState(contract = {}) {
  const days = daysUntil(contract.vig);
  if (days === null) return contract.est || "Borrador";
  if (days < 0) return "Vencido";
  if (days <= Number(contract.alertaDias || 30)) return "Por vencer";
  return contract.est || "Borrador";
}

function budgetRefLabel(item = {}, producciones = [], programas = [], piezas = []) {
  if (!item?.refId) return "Sin referencia";
  if (item.tipo === "programa") {
    const found = (programas || []).find(pg => pg.id === item.refId);
    return found ? `📺 ${found.nom}` : "Producción eliminada";
  }
  if (item.tipo === "contenido") {
    const found = (piezas || []).find(pz => pz.id === item.refId);
    return found ? `📱 ${found.nom}` : "Campaña eliminada";
  }
  const found = (producciones || []).find(pro => pro.id === item.refId);
  return found ? `📽 ${found.nom}` : "Proyecto eliminado";
}

function invoiceEntityName(fact = {}, clientes = [], auspiciadores = []) {
  if (fact.tipo === "auspiciador") return (auspiciadores || []).find(x => x.id === fact.entidadId)?.nom || "—";
  return (clientes || []).find(x => x.id === fact.entidadId)?.nom || "—";
}

function companyPrintColor(empresa = {}) {
  return PRINT_COLORS.find(opt => opt.value === empresa?.printColor)?.value || "#172554";
}

function companyPrintColorLabel(empresa = {}) {
  return PRINT_COLORS.find(opt => opt.value === companyPrintColor(empresa))?.label || "Azul institucional";
}

function companyBillingDiscountPct(empresa = {}) {
  const pct = Number(empresa?.billingDiscountPct || 0);
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

function companyBillingNet(empresa = {}) {
  const gross = Number(empresa?.billingMonthly || 0);
  return Math.max(0, Math.round(gross * (1 - companyBillingDiscountPct(empresa) / 100)));
}

function companyBillingStatus(empresa = {}) {
  return empresa?.billingStatus || "Pendiente";
}

function companyPaymentDayLabel(empresa = {}) {
  const day = Number(empresa?.billingDueDay || 0);
  return day > 0 ? `Cada día ${day}` : "Sin definir";
}

function companyIsUpToDate(empresa = {}) {
  return ["Al día","Pagado"].includes(companyBillingStatus(empresa));
}

function tenantOrdinal(tenantCode = "") {
  const match = String(tenantCode || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function nextTenantCode(empresas = []) {
  const max = (Array.isArray(empresas) ? empresas : []).reduce((acc, emp) => Math.max(acc, tenantOrdinal(emp?.tenantCode)), 0);
  return `T-${String(max + 1).padStart(4, "0")}`;
}

function buildReferralCode(emp = {}) {
  const normalizedName = String(emp?.nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();
  if (normalizedName) return normalizedName;
  return String(emp?.tenantCode || emp?.id || uid())
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function normalizeEmpresasTenantCodes(empresas = []) {
  let current = (Array.isArray(empresas) ? empresas : []).reduce((acc, emp) => Math.max(acc, tenantOrdinal(emp?.tenantCode)), 0);
  return (Array.isArray(empresas) ? empresas : []).map(emp => {
    if (emp?.tenantCode) return emp;
    current += 1;
    return {
      ...emp,
      tenantCode: `T-${String(current).padStart(4, "0")}`,
    };
  });
}

function normalizeEmpresasAddons(empresas = []) {
  return (Array.isArray(empresas) ? empresas : []).map(emp => {
    if (emp?.migratedTasksAddon) return emp;
    const addons = Array.isArray(emp?.addons) ? emp.addons : [];
    return {
      ...emp,
      addons: addons.includes("tareas") ? addons : [...addons, "tareas"],
      migratedTasksAddon: true,
    };
  });
}

function normalizeEmpresasModel(empresas = []) {
  return normalizeEmpresasAddons(normalizeEmpresasTenantCodes(empresas)).map(emp=>({
    ...emp,
    referralCode: buildReferralCode(emp),
    referralCredits: Number(emp?.referralCredits || 0),
  }));
}

function contractRefPrefix(refType = "") {
  return { produccion:"p", programa:"pg", contenido:"pz" }[refType] || "";
}

function contractMatchesReference(contract = {}, refType = "", refId = "") {
  if (!refType || !refId) return true;
  const prefix = contractRefPrefix(refType);
  const links = Array.isArray(contract?.pids) ? contract.pids.filter(Boolean) : [];
  if (!links.length || !prefix) return false;
  return links.includes(`${prefix}:${refId}`) || links.includes(refId);
}

function contractsForReference(contratos = [], cliId = "", refType = "", refId = "") {
  const base = (contratos || []).filter(ct => !cliId || ct.cliId === cliId);
  if (!refType || !refId) return base;
  return base.filter(ct => contractMatchesReference(ct, refType, refId));
}

function recurringSummary(item = {}, fallbackDate = today()) {
  if (!item?.recurring) return "Único";
  const count = Math.max(1, Number(item.recMonths || 1));
  const start = item.recStart || item.fechaEmision || fallbackDate;
  return `Mensual · ${count} mes${count === 1 ? "" : "es"} · desde ${fmtMonthPeriod(start)}`;
}

function cobranzaState(doc = {}) {
  if (doc.cobranzaEstado) return doc.cobranzaEstado;
  if (doc.estado === "Pagada") return "Pagado";
  if (doc.fechaVencimiento && String(doc.fechaVencimiento) < today()) return "Retrasado de pago";
  return "Pendiente de pago";
}

function billingContact(entity = {}, type = "cliente") {
  if (type === "auspiciador") {
    return {
      nombre: entity?.con || entity?.nom || "",
      email: entity?.ema || "",
      tel: entity?.tel || "",
      entidad: entity?.nom || "",
    };
  }
  const primary = Array.isArray(entity?.contactos) ? entity.contactos[0] : null;
  return {
    nombre: primary?.nom || entity?.nom || "",
    email: primary?.ema || "",
    tel: primary?.tel || "",
    entidad: entity?.nom || "",
  };
}

function openMailto(to = "", subject = "", body = "") {
  window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
}

function openWhatsApp(tel = "", body = "") {
  const num = String(tel || "").replace(/[^0-9]/g, "");
  if (!num) return;
  const waNum = num.startsWith("56") ? num : `56${num}`;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(body)}`, "_blank");
}

function companyGoogleCalendarEnabled(empresa = {}) {
  return !!empresa?.googleCalendarEnabled;
}

function userGoogleCalendar(user = {}) {
  return {
    connected: false,
    email: "",
    calendarId: "primary",
    calendarName: "Calendario principal",
    autoSync: false,
    lastSyncAt: "",
    ...user?.googleCalendar,
  };
}

const normalizeSocialPiece = (piece = {}, campaign = {}) => ({
  id: piece.id || uid(),
  nom: piece.nom || piece.titulo || "Nueva pieza",
  formato: piece.formato || "Reel",
  plataforma: piece.plataforma || campaign.plataforma || "Instagram",
  est: piece.est || "Planificado",
  ini: piece.ini || campaign.ini || "",
  fin: piece.fin || "",
  des: piece.des || piece.descripcion || "",
  objetivo: piece.objetivo || "",
  brief: piece.brief || "",
  cta: piece.cta || "",
  copy: piece.copy || "",
  hashtags: piece.hashtags || "",
  responsableId: piece.responsableId || "",
  approval: piece.approval || "Pendiente",
  publishDate: piece.publishDate || piece.fin || campaign.fin || "",
  publishedAt: piece.publishedAt || "",
  link: piece.link || piece.url || "",
  finalLink: piece.finalLink || "",
  comentarios: Array.isArray(piece.comentarios) ? piece.comentarios : [],
});

const normalizeSocialCampaign = (item = {}) => {
  const looksLikeLegacyPiece = !Array.isArray(item.piezas) && (item.formato || item.plataforma || PIEZA_ESTADOS.includes(item.est));
  const piezas = looksLikeLegacyPiece
    ? [normalizeSocialPiece(item, item)]
    : (Array.isArray(item.piezas) ? item.piezas : []).map(p => normalizeSocialPiece(p, item));
  const plannedPiecesRaw = item.plannedPieces ?? item.totalPiezas;
  const plannedPieces = plannedPiecesRaw === "" || plannedPiecesRaw === null || plannedPiecesRaw === undefined
    ? piezas.length
    : Number(plannedPiecesRaw);
  return {
    ...item,
    id: item.id || uid(),
    nom: item.nom || item.titulo || "Nueva campaña",
    cliId: item.cliId || "",
    mes: item.mes || MESES[new Date().getMonth()],
    ano: Number(item.ano || new Date().getFullYear()),
    est: CAMPANA_ESTADOS.includes(item.est) ? item.est : "Planificada",
    plataforma: item.plataforma || (piezas[0]?.plataforma || "Instagram"),
    ini: item.ini || "",
    fin: item.fin || "",
    des: item.des || item.descripcion || "",
    crewIds: Array.isArray(item.crewIds) ? item.crewIds : [],
    comentarios: Array.isArray(item.comentarios) ? item.comentarios : [],
    plannedPieces: Number.isFinite(plannedPieces) ? Math.max(0, plannedPieces) : piezas.length,
    piezas,
  };
};

const normalizeSocialCampaigns = items => (Array.isArray(items) ? items.filter(Boolean).map(normalizeSocialCampaign) : []);
const countCampaignPieces = campaign => (Array.isArray(campaign?.piezas) ? campaign.piezas.length : 0);

function exportComentariosCSV(items, nombre="comentarios") {
  const headers = ["Fecha","Autor","Comentario","Fotos"];
  const rows = (items||[]).map(it => [
    it?.upd || it?.cr || "",
    String(it?.authorName || "—").replace(/,/g, " "),
    String(it?.text || "").replace(/\n/g, " ").replace(/,/g, " "),
    String((it?.photos||[]).length || 0),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/\s+/g,"_").toLowerCase()}_comentarios.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportComentariosPDF(items, nombre="comentarios", empresa=null) {
  const safeItems = Array.isArray(items) ? items : [];
  const ac = companyPrintColor(empresa);
  const htmlRows = safeItems.map(it => `
    <tr>
      <td>${it?.upd || it?.cr || "—"}</td>
      <td>${String(it?.authorName || "—").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td>
      <td>${String(it?.text || "—").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>")}</td>
    </tr>
  `).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Comentarios - ${nombre}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111827;padding:32px}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${ac};padding-bottom:14px;margin-bottom:20px}
    .brand{font-size:28px;font-weight:800;color:${ac};letter-spacing:-1px}
    .title{font-size:20px;font-weight:700;margin-bottom:4px}
    .meta{font-size:11px;color:#6b7280}
    table{width:100%;border-collapse:collapse}
    thead tr{background:${ac}}
    thead th{padding:10px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.6px}
    tbody td{padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top}
    tbody tr:nth-child(even){background:#f8fafc}
    .empty{padding:20px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#6b7280}
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">produ</div>
        <div class="title">${nombre}</div>
        <div class="meta">Comentarios exportados</div>
      </div>
      <div class="meta">Generado: ${new Date().toLocaleDateString("es-CL")}</div>
    </div>
    ${safeItems.length ? `<table><thead><tr><th style="width:140px">Fecha</th><th style="width:180px">Autor</th><th>Comentario</th></tr></thead><tbody>${htmlRows}</tbody></table>` : `<div class="empty">No hay comentarios para exportar.</div>`}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=980,height=720");
  if(!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ── ROLES ────────────────────────────────────────────────────
const ROLES = {
  superadmin:{ label:"Super Admin",   color:"#ff5566" },
  admin:     { label:"Administrador", color:"#00d4e8" },
  productor: { label:"Productor",     color:"#00e08a" },
  comercial: { label:"Comercial",     color:"#ffcc44" },
  viewer:    { label:"Visualizador",  color:"#7c7c8a" },
};
const ROLE_COLOR_MAP={superadmin:"red",admin:"cyan",productor:"green",comercial:"yellow",viewer:"gray"};
const PERMS = {
  productor:["clientes","producciones","programas","piezas","contenidos","crew","calendario","movimientos","eventos"],
  comercial:["clientes","auspiciadores","contratos"],
};
const ROLE_PERMISSION_GROUPS=[
  { label:"General", items:[["calendario","Calendario"],["tareas","Tareas"]] },
  { label:"Operación", items:[["clientes","Clientes"],["producciones","Proyectos"],["programas","Producciones"],["contenidos","Contenidos"],["crew","Crew"],["movimientos","Movimientos"]] },
  { label:"Comercial", items:[["auspiciadores","Auspiciadores"],["contratos","Contratos"],["presupuestos","Presupuestos"],["facturacion","Facturación"]] },
  { label:"Recursos", items:[["activos","Activos"]] },
];
function getCustomRoles(empresa={}) {
  return Array.isArray(empresa?.customRoles) ? empresa.customRoles : [];
}
function getRoleConfig(role, empresa) {
  if (ROLES[role]) return { key:role, label:ROLES[role].label, color:ROLES[role].color, badge:ROLE_COLOR_MAP[role]||"gray", permissions:PERMS[role]||[] };
  const custom=getCustomRoles(empresa).find(r=>r.key===role);
  if (custom) return { key:custom.key, label:custom.label, color:custom.color||"#7c7c8a", badge:custom.badge||"gray", permissions:Array.isArray(custom.permissions)?custom.permissions:[] };
  return { key:role, label:role, color:"#7c7c8a", badge:"gray", permissions:[] };
}
function roleOptions(empresa, includeSuperadmin=false) {
  const base=Object.entries(ROLES)
    .filter(([k])=>includeSuperadmin || k!=="superadmin")
    .map(([k,v])=>({value:k,label:v.label}));
  const custom=getCustomRoles(empresa).map(r=>({value:r.key,label:r.label}));
  return [...base,...custom];
}
function canDo(user, action, empresa) {
  if (!user) return false;
  if (user.role==="superadmin"||user.role==="admin") return true;
  if (user.role==="viewer") return false;
  const custom=getCustomRoles(empresa).find(r=>r.key===user.role);
  if (custom) return (custom.permissions||[]).includes(action);
  return PERMS[user.role]?.includes(action)??false;
}

function canAccessModule(user, view, empresa) {
  const gated = {
    tareas: "tareas",
    presupuestos: "presupuestos",
    "pres-det": "presupuestos",
    facturacion: "facturacion",
  };
  const action = gated[view];
  if (!action) return true;
  if (action==="tareas") return hasAddon(empresa,"tareas") && user?.role!=="viewer";
  if (action==="presupuestos" && !hasAddon(empresa,"presupuestos")) return false;
  if (action==="facturacion" && !hasAddon(empresa,"facturacion")) return false;
  return canDo(user, action, empresa);
}

const ADDONS = {
  tareas:      { label:"Tareas",         icon:"✅" },
  television:  { label:"Televisión",     icon:"📺" },
  social:      { label:"Contenidos RRSS",icon:"📱" },
  presupuestos:{ label:"Presupuestos",   icon:"📋" },
  facturacion: { label:"Facturación",    icon:"🧾" },
  activos:     { label:"Gestión Activos",icon:"📦" },
  contratos:   { label:"Contratos",      icon:"📄" },
  crew:        { label:"Equipo / Crew",  icon:"🎬" },
};

// ── LISTAS ADMINISTRABLES — valores por defecto ─────────────
const DEFAULT_LISTAS = {
  tiposPro:    ["Producción","Podcast","Contenido Audiovisual","Spot Publicitario","Documental","Web Series","Videoclip","Evento","Otro"],
  estadosPro:  ["Pre-Producción","En Curso","Post-Producción","Finalizado","Pausado"],
  tiposPg:     ["Producción","Podcast","Web Series","Talk Show","Documental","Otro"],
  estadosPg:   ["Activo","En Desarrollo","Pausado","Finalizado"],
  freqsPg:     ["Diario","Semanal","Quincenal","Mensual","Irregular"],
  estadosEp:   ["Planificado","Grabado","En Edición","Programado","Publicado","Cancelado"],
  tiposAus:    ["Auspiciador Principal","Auspiciador Secundario","Colaborador","Canje","Media Partner"],
  frecPagoAus: ["Mensual","Semestral","Anual","Único"],
  estadosAus:  ["Activo","Negociación","Vencido","Cancelado"],
  tiposCt:     ["Producción","Auspicio","Servicio","Licencia","Confidencialidad","Otro"],
  estadosCt:   ["Borrador","En Revisión","Firmado","Vigente","Vencido"],
  catMov:      ["General","Honorarios","Equipamiento","Locación","Post-Producción","Transporte","Alimentación","Marketing","Producción","Impuestos","Otros"],
  industriasCli:["Retail","Tecnología","Salud","Educación","Entretenimiento","Gastronomía","Inmobiliaria","Servicios","Media","Gobierno","Banca","Energía","Otro"],
  estadosCamp: ["Planificada","Activa","Pausada","Cerrada"],
  plataformasContenido:["Instagram","TikTok","Facebook","LinkedIn","YouTube","X","Multi-plataforma"],
  formatosPieza:["Reel","Carrusel","Historia","TikTok","Post","Video","Story","Otro"],
  estadosPieza:["Planificado","Guion / Idea","Producción","Edición","En revisión cliente","Correcciones","Aprobado","Programado","Publicado","Cancelado"],
  areasCrew:   ["Producción","Técnica","Postprod.","Dirección","Arte","Sonido","Fotografía","Otro"],
  rolesCrew:   ["Conductor","Conductora","Director","Productora General","Productor Ejecutivo","Director de Cámara","Camarógrafo","Sonidista","Iluminador","Editor","Colorista","Diseñador Gráfico","Asistente de Producción","Community Manager","Maquillaje","Vestuario","Otro"],
  estadosPres: ["Pendiente","Borrador","Enviado","En Revisión","Aceptado","Rechazado"],
  monedas:     ["CLP","UF","USD","EUR"],
  impuestos:   ["Sin impuesto","IVA 19%","Boleta Honorarios 15,25%"],
  tiposPres:   ["Proyecto","Producción","Contenidos","Servicio"],
  estadosFact: ["Borrador","Emitida","Anulada"],
  tiposEntidadFact:["Cliente","Auspiciador"],
  tiposDocFact:["Orden de Factura","Invoice"],
  catActivos:  ["Cámara","Lente","Iluminación","Sonido","Estabilizador","Monitor","Storage","Computación","Transporte","Set Dressing","Drone","Accesorio","Otro"],
  estadosActivos:["Disponible","Asignado","En Mantención","Baja"],
  prioridadesTarea:["Alta","Media","Baja"],
  estadosTarea:["Pendiente","En Progreso","En Revisión","Completada"],
};

// ── SEED ─────────────────────────────────────────────────────
const SEED_EMPRESAS = [
  { id:"emp1", tenantCode:"T-0001", nombre:"Play Media SpA",        rut:"78.118.348-2", dir:"Av. Providencia 1234, Santiago", tel:"+56 2 2345 6789", ema:"contacto@playmedia.cl",  logo:"", color:"#00d4e8", addons:["television","social","presupuestos","facturacion","activos","contratos","crew"], active:true, plan:"pro",     googleCalendarEnabled:false, billingCurrency:"UF", billingMonthly:12.9, billingDiscountPct:10, billingDiscountNote:"Partner estratégico", billingStatus:"Al día", billingDueDay:5, billingLastPaidAt:"2026-04-01", contractOwner:"Matías González", clientPortalUrl:"https://portal.produ.cl/playmedia", cr:today() },
  { id:"emp2", tenantCode:"T-0002", nombre:"González & Asociados",  rut:"78.171.372-4", dir:"Las Condes 456, Santiago",       tel:"+56 9 8765 4321", ema:"info@gonzalez.cl",       logo:"", color:"#00e08a", addons:["presupuestos"],                        active:true, plan:"starter", googleCalendarEnabled:false, billingCurrency:"UF", billingMonthly:3.2, billingDiscountPct:0, billingDiscountNote:"", billingStatus:"Pendiente", billingDueDay:10, billingLastPaidAt:"2026-03-10", contractOwner:"Carla González", clientPortalUrl:"https://portal.produ.cl/gonzalez", cr:today() },
];
const SEED_USERS = [
  { id:"u0", name:"Super Admin Produ", email:"super@produ.cl",      passwordHash:"4e4c56e4a15f89f05c2f4c72613da2a18c9665d4f0d6acce16415eb06f9be776", role:"superadmin", empId:null,   active:true },
  { id:"u1", name:"Admin Play Media",  email:"admin@playmedia.cl",  passwordHash:"240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", role:"admin",      empId:"emp1", active:true },
  { id:"u2", name:"María Productora",  email:"maria@playmedia.cl",  passwordHash:"97f08b12c985e818cb86cd3d6f7c4dec65a586d95874ce54db426d20d383ab2a", role:"productor",  empId:"emp1", active:true },
  { id:"u3", name:"Carlos Comercial",  email:"carlos@playmedia.cl", passwordHash:"6144f27586e33c13fd0a75787389fb03e046b2fef1f22a2af0f4cf6e803172a7", role:"comercial",  empId:"emp1", active:true },
  { id:"u4", name:"Admin González",    email:"admin@gonzalez.cl",   passwordHash:"f5a78f31ce940dbaa4ae5aebe2a6e500e3f2d1ef26d9e1963d2d0db50ae4522c", role:"admin",      empId:"emp2", active:true },
];
const SEED_DATA = (empId) => ({
  clientes: empId==="emp1"?[
    { id:"c1",empId,nom:"BancoSeguro S.A.", rut:"96.543.210-0",ind:"Servicios", dir:"Huérfanos 1234",not:"Cliente desde 2023",contactos:[{id:"cc1",nom:"Andrea Morales",car:"Gerente Mktg",ema:"amorales@bancoseguro.cl",tel:"+56 9 8765 4321",not:""}]},
    { id:"c2",empId,nom:"FoodTech Chile",   rut:"77.123.456-7",ind:"Gastronomía",dir:"Providencia 456",not:"",contactos:[{id:"cc2",nom:"Carlos Ibáñez",car:"CEO",ema:"carlos@foodtech.cl",tel:"+56 9 9876 5432",not:""}]},
    { id:"c3",empId,nom:"EduFutura S.A.",   rut:"65.432.100-1",ind:"Educación", dir:"Las Condes 789", not:"Contrato anual",contactos:[{id:"cc3",nom:"Valentina Ríos",car:"Dir. Comunicaciones",ema:"v.rios@edufutura.cl",tel:"+56 9 1234 5678",not:"Contacto principal"}]},
  ]:[
    { id:"c10",empId,nom:"Cliente González 1",rut:"11.111.111-1",ind:"Tecnología",dir:"",not:"",contactos:[{id:"cc10",nom:"Juan Pérez",car:"Gerente",ema:"juan@cliente.cl",tel:"+56 9 0000 0001",not:""}]},
  ],
  producciones: empId==="emp1"?[
    { id:"p1",empId,nom:"Podcast BancoSeguro",cliId:"c1",tip:"Podcast",            est:"En Curso",       ini:"2025-03-01",fin:"2025-06-30",des:"8 episodios sobre finanzas.",crewIds:[]},
    { id:"p2",empId,nom:"Spots FoodTech Q2",  cliId:"c2",tip:"Spot Publicitario",  est:"Post-Producción",ini:"2025-04-01",fin:"2025-05-15",des:"3 spots 30 seg.",crewIds:[]},
    { id:"p3",empId,nom:"Pack EduFutura",      cliId:"c3",tip:"Contenido Audiovisual",est:"En Curso",    ini:"2025-01-01",fin:"2025-12-31",des:"4 videos + reels/mes.",crewIds:[]},
  ]:[],
  programas: empId==="emp1"?[
    { id:"pg1",empId,nom:"Chile Emprende",tip:"Producción",can:"Canal 24H", est:"Activo",totalEp:24,fre:"Semanal",temporada:"T1 2025",conductor:"Roberto Gómez",prodEjec:"María González",des:"Emprendimiento e innovación.",cliId:"",crewIds:[]},
    { id:"pg2",empId,nom:"El Ágora",      tip:"Podcast",       can:"Spotify",   est:"Activo",totalEp:52,fre:"Semanal",temporada:"T1 2025",conductor:"Ana Ruiz",       prodEjec:"Carlos Pérez",   des:"Cultura y sociedad.",        cliId:"",crewIds:[]},
  ]:[],
  piezas: empId==="emp1"?[
    {id:"pz1",empId,nom:"Campaña BancoSeguro Abril",cliId:"c1",plataforma:"Instagram",mes:"Abril",ano:2026,est:"Activa",ini:"2026-04-01",fin:"2026-04-30",des:"Campaña mensual para awareness y educación financiera.",crewIds:[],comentarios:[],piezas:[
      {id:"pc1",nom:"Reel Lanzamiento BancoSeguro",formato:"Reel",plataforma:"Instagram",est:"Planificado",ini:"2026-04-03",fin:"2026-04-08",des:"Pieza de awareness para el lanzamiento de campaña."},
      {id:"pc2",nom:"Carrusel Beneficios Cuenta",formato:"Carrusel",plataforma:"Instagram",est:"Creado",ini:"2026-04-05",fin:"2026-04-10",des:"Resumen visual de beneficios y CTA."},
    ]},
    {id:"pz2",empId,nom:"Campaña FoodTech Abril",cliId:"c2",plataforma:"Instagram",mes:"Abril",ano:2026,est:"Activa",ini:"2026-04-01",fin:"2026-04-30",des:"Parrilla de contenidos de producto y recetas para redes.",crewIds:[],comentarios:[],piezas:[
      {id:"pc3",nom:"Carrusel Tips FoodTech",formato:"Carrusel",plataforma:"Instagram",est:"En Edición",ini:"2026-04-01",fin:"2026-04-05",des:"Serie mensual de tips de cocina y tecnologia."},
      {id:"pc4",nom:"Historia Promo Semanal",formato:"Historia",plataforma:"Instagram",est:"Programado",ini:"2026-04-07",fin:"2026-04-07",des:"Recordatorio de promo para historias."},
    ]},
    {id:"pz3",empId,nom:"Campaña EduFutura Abril",cliId:"c3",plataforma:"TikTok",mes:"Abril",ano:2026,est:"Planificada",ini:"2026-04-01",fin:"2026-04-30",des:"Contenidos mensuales para admisión y engagement.",crewIds:[],comentarios:[],piezas:[
      {id:"pc5",nom:"TikTok EduFutura Abril",formato:"TikTok",plataforma:"TikTok",est:"Correcciones",ini:"2026-04-02",fin:"2026-04-06",des:"Contenido para admision y engagement de estudiantes."},
    ]},
  ]:[],
  episodios: empId==="emp1"?[
    {id:"ep1",empId,pgId:"pg1",num:1,titulo:"Los nuevos emprendedores",  estado:"Publicado",  fechaGrab:"2025-01-10",fechaEmision:"2025-01-15",invitado:"Pedro Vargas",  locacion:"Estudio A",duracion:"45",notas:"",crewIds:[],comentarios:[]},
    {id:"ep2",empId,pgId:"pg1",num:2,titulo:"Financiamiento pymes",       estado:"Publicado",  fechaGrab:"2025-01-17",fechaEmision:"2025-01-22",invitado:"Laura Méndez",  locacion:"Estudio A",duracion:"42",notas:"",crewIds:[],comentarios:[]},
    {id:"ep3",empId,pgId:"pg1",num:3,titulo:"Marketing digital",          estado:"Grabado",    fechaGrab:"2025-01-24",fechaEmision:"2025-01-29",invitado:"Andrés Solís",   locacion:"Estudio B",duracion:"38",notas:"Pendiente color.",crewIds:[],comentarios:[]},
    {id:"ep4",empId,pgId:"pg1",num:4,titulo:"E-commerce LATAM",           estado:"En Edición", fechaGrab:"2025-01-31",fechaEmision:"2025-02-05",invitado:"Carmen Torres",  locacion:"Estudio A",duracion:"50",notas:"",crewIds:[],comentarios:[]},
    {id:"ep5",empId,pgId:"pg1",num:5,titulo:"Startups sociales",          estado:"Planificado", fechaGrab:"2025-02-07",fechaEmision:"2025-02-12",invitado:"Por confirmar",  locacion:"Estudio A",duracion:"45",notas:"",crewIds:[],comentarios:[]},
    {id:"ep6",empId,pgId:"pg2",num:1,titulo:"¿Qué es ciudadanía?",        estado:"Publicado",  fechaGrab:"2025-02-03",fechaEmision:"2025-02-07",invitado:"Prof. I. Matta", locacion:"Estudio P",duracion:"62",notas:"",crewIds:[],comentarios:[]},
    {id:"ep7",empId,pgId:"pg2",num:2,titulo:"Humanidades s.XXI",          estado:"Planificado", fechaGrab:"2025-02-17",fechaEmision:"2025-02-21",invitado:"Por confirmar",  locacion:"Estudio P",duracion:"60",notas:"",crewIds:[],comentarios:[]},
  ]:[],
  auspiciadores: empId==="emp1"?[
    {id:"a1",empId,nom:"Banco Estado",tip:"Auspiciador Principal",  con:"Pablo Muñoz",  ema:"pmunoz@bce.cl",   tel:"",pids:["pg1"],       mon:"2500000",vig:"2025-12-31",est:"Activo",frecPago:"Mensual",   not:"Logo + menciones"},
    {id:"a2",empId,nom:"Entel",       tip:"Auspiciador Secundario", con:"Lucía Torres", ema:"ltorres@entel.cl",tel:"",pids:["pg1","pg2"],mon:"1200000",vig:"2025-06-30",est:"Activo",frecPago:"Semestral", not:"Banner + mención"},
  ]:[],
  contratos: empId==="emp1"?[
    {id:"ct1",empId,nom:"Podcast BancoSeguro 2025",cliId:"c1",tip:"Producción",est:"Firmado",mon:"9000000", vig:"2025-06-30",arc:"",not:"8 episodios, 2 cuotas"},
    {id:"ct2",empId,nom:"EduFutura Anual 2025",     cliId:"c3",tip:"Servicio",  est:"Vigente",mon:"14400000",vig:"2025-12-31",arc:"",not:"12 meses"},
  ]:[],
  movimientos: empId==="emp1"?[
    {id:"m1",empId,eid:"p1",et:"pro",tipo:"ingreso",mon:4500000,des:"Cuota 1 BancoSeguro",cat:"General",   fec:"2025-03-15"},
    {id:"m2",empId,eid:"p1",et:"pro",tipo:"ingreso",mon:4500000,des:"Cuota 2 BancoSeguro",cat:"General",   fec:"2025-04-15"},
    {id:"m3",empId,eid:"p1",et:"pro",tipo:"gasto",  mon:800000, des:"Arriendo estudio",   cat:"Locación",  fec:"2025-03-20"},
    {id:"m4",empId,eid:"p2",et:"pro",tipo:"ingreso",mon:6000000,des:"Anticipo 50%",        cat:"General",   fec:"2025-04-05"},
    {id:"m5",empId,eid:"p2",et:"pro",tipo:"gasto",  mon:1200000,des:"Equipo cámara 4K",   cat:"Equip.",    fec:"2025-04-08"},
    {id:"m6",empId,eid:"p3",et:"pro",tipo:"ingreso",mon:1200000,des:"Mensualidad Enero",   cat:"General",   fec:"2025-01-31"},
    {id:"m7",empId,eid:"p3",et:"pro",tipo:"ingreso",mon:1200000,des:"Mensualidad Febrero", cat:"General",   fec:"2025-02-28"},
    {id:"m8",empId,eid:"pg1",et:"pg",tipo:"ingreso",mon:2500000,des:"Auspicio BCE Q1",    cat:"General",   fec:"2025-01-15"},
    {id:"m9",empId,eid:"pg1",et:"pg",tipo:"ingreso",mon:1200000,des:"Auspicio Entel Q1",  cat:"General",   fec:"2025-01-20"},
    {id:"m10",empId,eid:"pg1",et:"pg",tipo:"gasto", mon:600000, des:"Prod. eps 1-4",       cat:"Honorarios",fec:"2025-01-30"},
    {id:"m11",empId,eid:"ep1",et:"ep",tipo:"gasto", mon:180000, des:"Maquillaje ep.1",     cat:"Producción",fec:"2025-01-10"},
    {id:"m12",empId,eid:"ep1",et:"ep",tipo:"gasto", mon:120000, des:"Catering ep.1",       cat:"Alimentación",fec:"2025-01-10"},
  ]:[],
  crew: empId==="emp1"?[
    {id:"cr1",empId,nom:"Roberto Gómez",rol:"Conductor",         area:"Producción",tel:"+56 9 1111 2222",ema:"roberto@playmedia.cl",dis:"Lun-Vie",tarifa:"$200.000/día",not:"Host Chile Emprende",active:true},
    {id:"cr2",empId,nom:"Felipe Mora",  rol:"Director de Cámara",area:"Técnica",   tel:"+56 9 3333 4444",ema:"felipe@playmedia.cl", dis:"Lun-Sáb",tarifa:"$150.000/día",not:"",active:true},
    {id:"cr3",empId,nom:"Carla Vega",   rol:"Editora",            area:"Postprod.", tel:"+56 9 4444 5555",ema:"carla@playmedia.cl",  dis:"Mar-Vie",tarifa:"$120.000/día",not:"DaVinci Resolve",active:true},
    {id:"cr4",empId,nom:"Martín Díaz",  rol:"Sonidista",          area:"Técnica",   tel:"+56 9 5555 6666",ema:"martin@playmedia.cl", dis:"Lun-Vie",tarifa:"$100.000/día",not:"",active:true},
  ]:[],
  eventos:[],presupuestos:[],facturas:[],activos:[],
});

// ── DB HOOK ──────────────────────────────────────────────────
function useDB(key, initial=null) {
  const [data,setData]=useState(initial);
  const [loading,setLoading]=useState(true);
  const saving=useRef(false);
  const loaded=useRef(false);
  useEffect(()=>{
    if(!key) return;
    if(loaded.current) return;
    loaded.current=true;
    setLoading(true);
    dbGet(key).then(v=>{ if(v!==null) setData(v); setLoading(false); });
  },[key]);
  const save=useCallback(async d=>{
    saving.current=true; setData(d);
    await dbSet(key,d);
    await new Promise(r=>setTimeout(r,1500));
    saving.current=false;
  },[key]);
  return [data,save,saving,loading];
}
function usePoll(key,setter,savingRef,ms=20000){
  useEffect(()=>{
    if(!key) return;
    const t=setInterval(async()=>{ if(savingRef?.current) return; const v=await dbGet(key); if(v!==null) setter(v); },ms);
    return()=>clearInterval(t);
  },[key]);
}

// ── CSS ──────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#080809;--sur:#0f0f11;--card:#141416;--card2:#1a1a1e;
  --bdr:#1e1e24;--bdr2:#28282f;--cy:#00d4e8;--cy2:#00b8c8;
  --cg:#00d4e820;--cm:#00d4e840;--wh:#f4f4f6;
  --gr:#52525e;--gr2:#7c7c8a;--gr3:#a8a8b8;
  --red:#ff5566;--grn:#00e08a;--yel:#ffcc44;--org:#ff8844;--pur:#a855f7;
  --fh:'Syne',sans-serif;--fb:'Manrope',sans-serif;--fm:'JetBrains Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--wh);font-family:var(--fb);min-height:100vh}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:var(--cy)!important;box-shadow:0 0 0 3px var(--cg)!important}
tbody tr{cursor:pointer;transition:.1s}tbody tr:hover td{background:var(--card2)!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
/* Modern light theme enhancements */
body.light .sidebar-inner{background:var(--sidebar-bg)!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important}
body.light aside *{border-color:#ffffff14!important}
body.light aside .nav-label{color:#e2e8f0!important}
body.light .card-wrap,.card{border-radius:12px}
body.light .card-wrap{box-shadow:0 1px 4px rgba(0,0,0,.07),0 2px 12px rgba(0,0,0,.04)!important;border:none!important}
body.light main{background:#eef2f7}
body.light .stat-card{box-shadow:0 2px 8px rgba(0,0,0,.07);border:none}
body.light input,body.light select,body.light textarea{background:#ffffff;border-color:#cbd5e1;color:#0f172a}
body.light input:focus,body.light select:focus,body.light textarea:focus{border-color:#4f46e5;box-shadow:0 0 0 3px #4f46e520}
body.light button[class*="btn"]{transition:all .15s}
.va{animation:fadeUp .2s ease}
body.light{--bg:#eef2f7;--sur:#ffffff;--card:#ffffff;--card2:#f3f6fb;--bdr:#d7dee8;--bdr2:#c2ccd8;--wh:#0f172a;--gr:#64748b;--gr2:#475569;--gr3:#1e293b;--sidebar:#111827;--sidebar-text:#cbd5e1;--sidebar-active:#ffffff;--sidebar-active-bg:#0ea5b7}
body.light .sidebar-wrap{background:var(--sidebar-bg)!important}
body.light .sidebar-wrap *{border-color:#ffffff15!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important;box-shadow:2px 0 24px rgba(15,23,42,.24)}
body.light aside .nav-group-label{color:#94a3b8!important}
body.light aside,body.light aside button,body.light aside div,body.light aside span,body.light aside small{color:#e5edf7!important}
body.light aside [style*="color:var(--gr2)"]{color:#a9b8cb!important}
body.light aside [style*="color:var(--gr3)"]{color:#e5edf7!important}
body.light aside [style*="color:var(--wh)"]{color:#ffffff!important}
body.light aside .active-nav{background:#ffffff18!important;color:#ffffff!important}
body.light .topbar{background:#ffffff;border-bottom:1px solid #dbe2ea;box-shadow:0 1px 3px rgba(15,23,42,.05)}
@media(max-width:1024px){
  html{font-size:13px}
  [style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="repeat(6,1fr)"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  [style*="repeat(3,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="1fr 1fr 1fr"]{grid-template-columns:1fr 1fr!important}
  [style*="1fr 1fr"]{grid-template-columns:1fr!important}
}
@media(max-width:768px){
  aside{transform:translateX(-100%);transition:transform .25s ease!important;width:260px!important;z-index:300!important}
  aside.mob-open{transform:translateX(0)!important}
  main,.app-main{margin-left:0!important;width:100%!important}
  .topbar{padding:0 14px!important;height:auto!important;min-height:60px;flex-wrap:wrap}
  .app-page{padding:14px!important}
  .app-breadcrumbs{min-width:0!important}
  .app-actions{width:100%;justify-content:flex-end;flex-wrap:wrap}
  [style*="repeat(4,1fr)"],[style*="repeat(6,1fr)"],[style*="repeat(3,1fr)"],[style*="1fr 1fr 1fr"],[style*="1fr 1fr"]{grid-template-columns:1fr!important}
  [style*="width:260px"]{width:100%!important;max-width:100%!important}
  [style*="min-width:190"]{min-width:0!important}
  [style*="justify-content:space-between"][style*="width:260px"]{width:100%!important}
  .login-shell,.company-shell{padding:16px!important}
  .login-card,.company-card{width:100%!important;max-width:100%!important;padding:24px 18px!important}
  .search-wrap{max-width:none!important;width:100%!important}
  .toast-box{left:12px!important;right:12px!important;bottom:12px!important;max-width:none!important}
  .pager{flex-direction:column;align-items:flex-start!important;gap:12px}
  .ham-btn{display:flex!important}
  .modal-wrap{align-items:flex-end!important;padding:0!important}
  .modal-box{border-radius:16px 16px 0 0!important;width:100%!important;max-width:100%!important;max-height:92vh!important}
  input,select,textarea{font-size:16px!important}
}
@media(max-width:1024px){
  .login-card{grid-template-columns:1fr!important;gap:14px!important}
  .login-form{order:-1;padding:30px 24px!important}
  .login-promo{min-height:auto!important;padding:26px!important}
  .login-promo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .login-promo-footer{grid-template-columns:1fr!important}
  .login-title{font-size:34px!important;max-width:none!important}
}
@media(max-width:640px){
  .login-shell{padding:12px!important;align-items:flex-start!important}
  .login-card{gap:12px!important}
  .login-form,.login-promo{border-radius:18px!important;box-shadow:0 12px 36px rgba(0,0,0,.24)!important}
  .login-form{padding:22px 16px!important}
  .login-promo{padding:20px 16px!important}
  .login-promo-grid{grid-template-columns:1fr!important}
  .login-title{font-size:28px!important;line-height:1.05!important}
  .login-subcopy{font-size:13px!important}
  .login-promo-copy{font-size:13px!important}
}
@media(min-width:769px){
  .mob-overlay{display:none!important}
  .ham-btn{display:none!important}
}
`;

// ── UI PRIMITIVES ────────────────────────────────────────────
const StyleTag=()=><style dangerouslySetInnerHTML={{__html:CSS}}/>
;

// ── SKELETON LOADER ──────────────────────────────────────────
function Skeleton({w="100%",h=14,r=6,mb=8}){
  return <div style={{width:w,height:h,borderRadius:r,marginBottom:mb,background:"linear-gradient(90deg,var(--bdr) 25%,var(--bdr2) 50%,var(--bdr) 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
}
function SkeletonCard(){
  return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20}}>
    <Skeleton h={18} w="60%" mb={12}/>
    <Skeleton h={12} w="90%" mb={8}/>
    <Skeleton h={12} w="75%" mb={8}/>
    <Skeleton h={12} w="80%"/>
  </div>;
}
function LoadingScreen({ title="Cargando datos...", sub="En los proximos segundos estaremos al aire" }){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:18,textAlign:"center",padding:"24px 16px"}}>
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:48,height:48,borderRadius:12,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px var(--cm)"}}>
        <svg viewBox="0 0 24 24" fill="var(--bg)" width="22" height="22"><polygon points="5,3 20,12 5,21"/></svg>
      </div>
      <div style={{textAlign:"left"}}>
        <div style={{fontFamily:"var(--fh)",fontSize:28,fontWeight:800,color:"var(--cy)",letterSpacing:-1,lineHeight:1}}>produ</div>
        <div style={{fontSize:10,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestion de Productoras</div>
      </div>
    </div>
    <div style={{width:54,height:54,border:"3px solid var(--bdr2)",borderTop:"3px solid var(--cy)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div>
      <div style={{fontFamily:"var(--fh)",fontSize:16,fontWeight:700,color:"var(--wh)",marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:"var(--gr2)"}}>{sub}</div>
    </div>
  </div>;
}

function Toast({msg,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[]);
  const c={ok:"var(--cy)",err:"var(--red)",warn:"var(--yel)"}[type]||"var(--cy)";
  return <div className="toast-box" style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px #0007",animation:"slideIn .2s ease",maxWidth:340,fontSize:13,color:"var(--wh)"}}><div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`,flexShrink:0}}/>{msg}</div>;
}

const BP={cyan:["var(--cg)","var(--cy)","var(--cm)"],green:["#00e08a18","#00e08a","#00e08a35"],red:["#ff556618","#ff5566","#ff556635"],yellow:["#ffcc4418","#ffcc44","#ffcc4435"],orange:["#ff884418","#ff8844","#ff884435"],purple:["#a855f718","#a855f7","#a855f735"],gray:["var(--bdr)","var(--gr2)","var(--bdr2)"]};
const SM={"En Curso":"cyan","Pre-Producción":"yellow","Post-Producción":"orange","Finalizado":"green","Pausado":"gray","Activo":"green","En Desarrollo":"yellow","Vigente":"green","Borrador":"gray","En Revisión":"yellow","Firmado":"cyan","Vencido":"red","Planificado":"yellow","Grabado":"cyan","En Edición":"cyan","Programado":"purple","Publicado":"green","Cancelado":"red","Negociación":"yellow","Aceptado":"green","Rechazado":"red","Pagado":"green","Pendiente":"yellow","Vencida":"red","Auspiciador Principal":"cyan","Auspiciador Secundario":"yellow","Colaborador":"green","Canje":"orange","Media Partner":"gray"};
function Badge({label,color,sm}){const P=BP[color||SM[label]||"gray"];return <span style={{display:"inline-flex",alignItems:"center",padding:sm?"2px 7px":"3px 10px",borderRadius:20,fontSize:sm?9:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",whiteSpace:"nowrap",background:P[0],color:P[1],border:`1px solid ${P[2]}`}}>{label}</span>;}

function Paginator({page,total,perPage,onChange}){
  const pages=Math.ceil(total/perPage)||1; if(total<=perPage) return null;
  const from=(page-1)*perPage+1,to=Math.min(page*perPage,total);
  const nums=[]; for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)nums.push(i);else if(Math.abs(i-page)===2)nums.push("…");}
  const dd=nums.filter((v,i,a)=>v!=="…"||a[i-1]!=="…");
  const bs=on=>({width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${on?"var(--cy)":"var(--bdr2)"}`,background:on?"var(--cy)":"transparent",color:on?"var(--bg)":"var(--gr2)",fontFamily:"var(--fm)"});
  return <div className="pager" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,paddingTop:14,borderTop:"1px solid var(--bdr)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>Mostrando <b style={{color:"var(--wh)"}}>{from}–{to}</b> de <b style={{color:"var(--wh)"}}>{total}</b></span><div style={{display:"flex",gap:4,flexWrap:"wrap"}}><button style={bs(false)} disabled={page<=1} onClick={()=>onChange(page-1)}>‹</button>{dd.map((v,i)=>v==="…"?<span key={i} style={{color:"var(--gr)",padding:"0 4px",fontSize:11,alignSelf:"center"}}>…</span>:<button key={v} style={bs(v===page)} onClick={()=>onChange(v)}>{v}</button>)}<button style={bs(false)} disabled={page>=pages} onClick={()=>onChange(page+1)}>›</button></div></div>;
}

function Modal({open,onClose,title,sub,children,wide,extraWide}){
  useEffect(()=>{const h=e=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[onClose]);
  useEffect(()=>{if(open){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}return()=>{document.body.style.overflow="";};},[open]);
  if(!open) return null;
  const mob = window.innerWidth <= 768;
  return <div className="modal-wrap" onClick={e=>{if(e.target===e.currentTarget&&!mob)onClose();}} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:20}}>
    <div className="modal-box" style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:mob?"16px 16px 0 0":14,width:mob?"100%":extraWide?900:wide?700:600,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:mob?"20px 16px":28,animation:mob?"slideIn .25s ease":"modalIn .2s ease"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div><div style={{fontFamily:"var(--fh)",fontSize:mob?18:20,fontWeight:800,color:"var(--wh)"}}>{title}</div>{sub&&<div style={{fontSize:12,color:"var(--gr2)",marginTop:3}}>{sub}</div>}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",padding:4,borderRadius:4,fontSize:20,lineHeight:1}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

const FS={width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,outline:"none"};
const FG=({label,children})=><div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--gr3)",marginBottom:6,letterSpacing:.3}}>{label}</label>{children}</div>;
const FI=p=><input style={FS} {...p}/>;
const FSl=({children,...p})=><select style={{...FS,cursor:"pointer"}} {...p}>{children}</select>;
const FTA=p=><textarea style={{...FS,resize:"vertical",minHeight:80}} {...p}/>;
const R2=({children})=><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>{children}</div>;
const R3=({children})=><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,180px),1fr))",gap:12}}>{children}</div>;
const MFoot=({onClose,onSave,label="Guardar"})=><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:22,paddingTop:18,borderTop:"1px solid var(--bdr)"}}><button onClick={onClose} style={{padding:"8px 16px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>Cancelar</button><button onClick={onSave} style={{padding:"8px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>{label}</button></div>;
const Btn=({onClick,children,sm,s={}})=><button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:6,padding:sm?"6px 12px":"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:sm?11:12,fontWeight:700,whiteSpace:"nowrap",...s}}>{children}</button>;
const GBtn=({onClick,children,sm,s={}})=><button onClick={onClick} style={{padding:sm?"5px 11px":"7px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:sm?11:12,fontWeight:600,...s}}>{children}</button>;
const DBtn=({onClick,children,sm})=><button onClick={onClick} style={{padding:sm?"4px 9px":"7px 12px",borderRadius:6,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:sm?10:12,fontWeight:600}}>{children}</button>;
const XBtn=({onClick})=><button onClick={onClick} style={{padding:"3px 8px",borderRadius:4,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:10,fontWeight:600}}>✕</button>;

function Stat({label,value,sub,accent="var(--cy)",vc}){return <div style={{background:"linear-gradient(180deg,var(--card),var(--card2))",border:"1px solid var(--bdr)",borderRadius:14,padding:"18px 20px",position:"relative",overflow:"hidden",boxShadow:"0 10px 30px rgba(0,0,0,.08)"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/><div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--gr2)",marginBottom:10,fontWeight:700}}>{label}</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:500,color:vc||"var(--wh)"}}>{value}</div>{sub&&<div style={{fontSize:11,color:"var(--gr2)",marginTop:6}}>{sub}</div>}</div>;}
const TH=({children})=><th style={{textAlign:"left",padding:"12px 14px",fontSize:10,letterSpacing:1.7,textTransform:"uppercase",color:"var(--gr2)",borderBottom:"1px solid var(--bdr)",fontWeight:700,whiteSpace:"nowrap",background:"linear-gradient(180deg,var(--card2),transparent)"}}>{children}</th>;
const TD=({children,bold,mono,style:s={}})=><td style={{padding:"12px 14px",fontSize:12.5,color:bold?"var(--wh)":"var(--gr3)",borderBottom:"1px solid var(--bdr)",fontFamily:mono?"var(--fm)":"inherit",fontWeight:bold?600:400,verticalAlign:"middle",...s}}>{children}</td>;
function Card({title,sub,action,children,style:s={}}){return <div style={{background:"linear-gradient(180deg,var(--card),var(--card2))",border:"1px solid var(--bdr)",borderRadius:16,padding:20,boxShadow:"0 12px 32px rgba(0,0,0,.08)",...s}}>{title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:12,borderBottom:"1px solid var(--bdr)"}}><div><div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:800}}>{title}</div>{sub&&<div style={{fontSize:11,color:"var(--gr2)",marginTop:3}}>{sub}</div>}</div>{action&&<button onClick={action.fn} style={{padding:"7px 12px",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:700}}>{action.label}</button>}</div>}{children}</div>;}
const Empty=({text,sub})=><div style={{textAlign:"center",padding:"44px 24px",color:"var(--gr2)",background:"linear-gradient(180deg,transparent,var(--card2))",border:"1px dashed var(--bdr2)",borderRadius:14}}><div style={{fontSize:34,marginBottom:12,opacity:.35}}>◻</div><p style={{fontSize:13,fontWeight:600,color:"var(--gr3)"}}>{text}</p>{sub&&<small style={{fontSize:11,color:"var(--gr)",marginTop:6,display:"block"}}>{sub}</small>}</div>;
const Sep=()=><hr style={{border:"none",borderTop:"1px solid var(--bdr)",margin:"16px 0"}}/>;
const Tabs=({tabs,active,onChange})=><div style={{display:"flex",gap:8,marginBottom:20,overflowX:"auto",paddingBottom:2}}>{tabs.map((t,i)=><div key={t} onClick={()=>onChange(i)} style={{padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer",border:`1px solid ${active===i?"var(--cm)":"var(--bdr)"}`,borderRadius:999,background:active===i?"linear-gradient(180deg,var(--cg),transparent)":"var(--card)",color:active===i?"var(--cy)":"var(--gr2)",whiteSpace:"nowrap",boxShadow:active===i?"inset 0 0 0 1px var(--cg)":"none"}}>{t}</div>)}</div>;
const KV=({label,value})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>{label}</span><span style={{fontSize:13,textAlign:"right",maxWidth:"60%"}}>{value}</span></div>;
function SearchBar({value,onChange,placeholder}){return <div className="search-wrap" style={{display:"flex",alignItems:"center",gap:8,background:"linear-gradient(180deg,var(--sur),var(--card2))",border:"1px solid var(--bdr2)",borderRadius:10,padding:"10px 13px",maxWidth:320,flex:1,boxShadow:"0 6px 18px rgba(0,0,0,.04)"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:"none",border:"none",color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,flex:1,outline:"none",minWidth:0}}/>{value&&<span onClick={()=>onChange("")} style={{cursor:"pointer",color:"var(--gr2)",fontSize:14}}>×</span>}</div>;}
function FilterSel({value,onChange,options,placeholder}){return <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"10px 12px",background:"linear-gradient(180deg,var(--sur),var(--card2))",border:"1px solid var(--bdr2)",borderRadius:10,color:"var(--gr3)",fontFamily:"var(--fb)",fontSize:12,cursor:"pointer",outline:"none",boxShadow:"0 6px 18px rgba(0,0,0,.04)"}}><option value="">{placeholder}</option>{options.map(o=>typeof o==="object"?<option key={o.value} value={o.value}>{o.label}</option>:<option key={o}>{o}</option>)}</select>;}
function ViewModeToggle({value,onChange}){
  return <div style={{display:"flex",gap:4,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:3,boxShadow:"0 6px 18px rgba(0,0,0,.04)"}}>
    {[["cards","⊟","Cards"],["list","☰","Lista"]].map(([v,icon,label])=><button key={v} onClick={()=>onChange(v)} title={label} style={{padding:"6px 10px",borderRadius:8,border:"none",background:value===v?"var(--cy)":"transparent",color:value===v?"var(--bg)":"var(--gr2)",cursor:"pointer",fontSize:13,fontWeight:700,minWidth:36}}>{icon}</button>)}
  </div>;
}
function MultiSelect({options,value=[],onChange,placeholder="Seleccionar..."}){
  const [open,setOpen]=useState(false);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const toggle=v=>onChange(value.includes(v)?value.filter(x=>x!==v):[...value,v]);
  return <div ref={ref} style={{position:"relative"}}><div onClick={()=>setOpen(!open)} style={{minHeight:40,padding:"7px 12px",background:"var(--sur)",border:`1px solid ${open?"var(--cy)":"var(--bdr2)"}`,borderRadius:6,cursor:"pointer",display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>{!value.length?<span style={{color:"var(--gr)",fontSize:12}}>{placeholder}</span>:value.map(v=>{const l=options.find(o=>o.value===v)?.label||v;return <span key={v} style={{background:"var(--cm)",color:"var(--cy)",borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{l}<span onClick={e=>{e.stopPropagation();toggle(v);}} style={{cursor:"pointer",opacity:.7}}>×</span></span>;})}</div>{open&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:6,zIndex:600,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #0007"}}>{options.map(o=><div key={o.value} onClick={()=>toggle(o.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",fontSize:12.5,color:value.includes(o.value)?"var(--cy)":"var(--gr3)",background:value.includes(o.value)?"var(--cg)":"transparent"}}><div style={{width:14,height:14,border:`1px solid ${value.includes(o.value)?"var(--cy)":"var(--bdr2)"}`,borderRadius:3,background:value.includes(o.value)?"var(--cy)":"var(--sur)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:9,fontWeight:700,color:"var(--bg)"}}>{value.includes(o.value)?"✓":""}</div>{o.label}</div>)}{!options.length&&<div style={{padding:12,color:"var(--gr)",fontSize:12,textAlign:"center"}}>Sin opciones</div>}</div>}</div>;
}
const DetHeader=({title,tag,badges=[],meta=[],actions,des})=><div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}><div>{tag&&<div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"var(--cy)",fontWeight:700,marginBottom:6}}>{tag}</div>}<div style={{fontFamily:"var(--fh)",fontSize:24,fontWeight:800}}>{title}</div><div style={{fontSize:12,color:"var(--gr2)",marginTop:6,display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>{badges.map((b,i)=><span key={i}>{b}</span>)}{meta.filter(Boolean).map((m,i)=><span key={i}>{m}</span>)}</div>{des&&<div style={{fontSize:12,color:"var(--gr2)",marginTop:8,maxWidth:580}}>{des}</div>}</div>{actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}</div>;
function useBal(movimientos,empId){return useCallback(id=>{const mv=(movimientos||[]).filter(m=>m.eid===id&&m.empId===empId);const i=mv.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.mon),0);const g=mv.filter(m=>m.tipo==="gasto").reduce((s,m)=>s+Number(m.mon),0);return{i,g,b:i-g};},[movimientos,empId]);}

class TaskErrorBoundary extends Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }
  static getDerivedStateFromError(){
    return {hasError:true};
  }
  componentDidCatch(){}
  render(){
    if(this.state.hasError){
      return <Card title={this.props.title||"Tareas"}>
        <Empty text="No pudimos cargar este bloque de tareas" sub="Recarga la vista o edita la tarea desde el módulo principal de Tareas."/>
      </Card>;
    }
    return this.props.children;
  }
}

// ── LOGIN ────────────────────────────────────────────────────

// ── SOLICITUD MODAL ───────────────────────────────────────────
function SolicitudModal({onClose,solF,setSolF,solSent,setSolSent,empresas=[]}){
  return <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:14,width:720,maxWidth:"100%",padding:28,animation:"modalIn .2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>Solicita tu demo de Produ</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:20}}>✕</button>
      </div>
      {solSent
        ?<div style={{textAlign:"center",padding:20}}>
          <div style={{fontSize:40,marginBottom:12}}>✅</div>
          <div style={{fontFamily:"var(--fh)",fontSize:16,fontWeight:700,marginBottom:8}}>Demo solicitada</div>
          <div style={{fontSize:13,color:"var(--gr2)",marginBottom:16}}>Tu empresa quedó creada en estado pendiente de activación. El equipo de Produ revisará la solicitud y te contactará.</div>
          <button onClick={onClose} style={{padding:"9px 24px",borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:13,fontWeight:700}}>Cerrar</button>
        </div>
        :<div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Nombre completo *</div>
            <input value={solF.nom||""} onChange={e=>setSolF(p=>({...p,nom:e.target.value}))} placeholder="Juan Pérez" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Email *</div>
            <input type="email" value={solF.ema||""} onChange={e=>setSolF(p=>({...p,ema:e.target.value}))} placeholder="juan@empresa.cl" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Empresa / Productora *</div>
            <input value={solF.emp||""} onChange={e=>setSolF(p=>({...p,emp:e.target.value}))} placeholder="Play Media SpA" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Teléfono *</div>
            <input value={solF.tel||""} onChange={e=>setSolF(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Tipo de cliente</div>
            <select value={solF.customerType||"productora"} onChange={e=>setSolF(p=>({...p,customerType:e.target.value}))} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
              <option value="productora">Productora</option>
              <option value="creador">Creador independiente</option>
              <option value="agencia">Agencia</option>
              <option value="estudio">Estudio</option>
            </select></div>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Tamaño de equipo</div>
            <select value={solF.teamSize||"1-3"} onChange={e=>setSolF(p=>({...p,teamSize:e.target.value}))} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
              <option value="1-3">1-3 personas</option>
              <option value="4-10">4-10 personas</option>
              <option value="11-25">11-25 personas</option>
              <option value="25+">25+ personas</option>
            </select></div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:8}}>Módulos de interés</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {[
                ["producciones","Proyectos"],
                ["programas","Producciones"],
                ["contenidos","Contenidos"],
                ["presupuestos","Presupuestos"],
                ["facturacion","Facturación"],
                ["crew","Crew"],
                ["contratos","Contratos"],
                ["tareas","Tareas"],
              ].map(([key,label])=>{
                const arr=Array.isArray(solF.modules)?solF.modules:[];
                const active=arr.includes(key);
                return <label key={key} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--sur)",border:`1px solid ${active?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={active} onChange={e=>setSolF(p=>({...p,modules:e.target.checked?[...(Array.isArray(p.modules)?p.modules:[]),key]:(Array.isArray(p.modules)?p.modules:[]).filter(x=>x!==key)}))}/>
                  <span style={{fontSize:12,color:"var(--wh)"}}>{label}</span>
                </label>;
              })}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Rol inicial</div>
            <select value={solF.rol||"admin"} onChange={e=>setSolF(p=>({...p,rol:e.target.value}))} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
              <option value="admin">Administrador</option>
              <option value="productor">Productor</option>
              <option value="comercial">Comercial</option>
            </select></div>
            <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Código de referido</div>
            <input value={solF.referralCode||""} onChange={e=>setSolF(p=>({...p,referralCode:e.target.value.toUpperCase()}))} placeholder="PLAYMEDIASPA" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
          </div>
          <div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Mensaje (opcional)</div>
          <textarea value={solF.msg||""} onChange={e=>setSolF(p=>({...p,msg:e.target.value}))} placeholder="Cuéntanos brevemente qué necesitas operar con Produ..." rows={3} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit"}}/></div>
          <button onClick={async()=>{
            if(!solF.nom||!solF.ema||!solF.emp||!solF.tel){alert("Completa nombre, email, teléfono y empresa.");return;}
            const referral=(empresas||[]).find(e=>String(e.referralCode||"").toUpperCase()===String(solF.referralCode||"").toUpperCase()&&e.active!==false);
            const companyId=`emp_${uid().slice(1,7)}`;
            const allEmp=normalizeEmpresasModel((await dbGet("produ:empresas"))||SEED_EMPRESAS);
            const pendingCompany=normalizeEmpresasModel([{
              id:companyId,
              tenantCode:nextTenantCode(allEmp),
              nombre:solF.emp,
              rut:solF.rut||"",
              dir:solF.dir||"",
              tel:solF.tel||"",
              ema:solF.ema||"",
              logo:"",
              color:"#00d4e8",
              addons:[],
              active:false,
              pendingActivation:true,
              requestType:"demo",
              customerType:solF.customerType||"productora",
              teamSize:solF.teamSize||"1-3",
              requestedModules:Array.isArray(solF.modules)?solF.modules:[],
              referredByEmpId:referral?.id||"",
              referredByName:referral?.nombre||"",
              referred:true===!!referral,
              plan:"starter",
              googleCalendarEnabled:false,
              migratedTasksAddon:true,
              systemMessages:[],
              systemBanner:{active:false,tone:"info",text:""},
              billingCurrency:"UF",
              billingMonthly:0,
              billingDiscountPct:0,
              billingDiscountNote:"",
              billingStatus:"Pendiente",
              billingDueDay:0,
              billingLastPaidAt:"",
              contractOwner:solF.nom,
              clientPortalUrl:"",
              cr:today()
            }])[0];
            await dbSet("produ:empresas",[...allEmp,pendingCompany]);
            const sol={id:uid(),tipo:"empresa",nom:solF.nom,ema:solF.ema,tel:solF.tel,emp:solF.emp,rol:solF.rol||"admin",msg:solF.msg||"",fecha:today(),estado:"pendiente",empresaId:companyId,customerType:solF.customerType||"productora",teamSize:solF.teamSize||"1-3",requestedModules:Array.isArray(solF.modules)?solF.modules:[],referred:!!referral,referredByEmpId:referral?.id||"",referredByName:referral?.nombre||"",referralCode:solF.referralCode||""};
            const cur=await dbGet("produ:solicitudes")||[];
            await dbSet("produ:solicitudes",[...cur,sol]);
            setSolSent(true);
          }} style={{width:"100%",padding:"11px",borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:700}}>Enviar solicitud →</button>
        </div>}
    </div>
  </div>;
}


// ── SOLICITUD MODAL — formulario de acceso desde login ───────

function Login({users,onLogin,empresas=[]}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [load,setLoad]=useState(false);
  const [showPass,setShowPass]=useState(false);
  const [solOpen,setSolOpen]=useState(false);const [solF,setSolF]=useState({});const [solSent,setSolSent]=useState(false);
  const login=async()=>{
    setLoad(true);setErr("");
    await new Promise(r=>setTimeout(r,400));
    const hashedPass = await sha256Hex(pass);
    const userByEmail = (users||[]).find(u=>u.email?.toLowerCase()===email.toLowerCase()&&u.active);
    const valid = userByEmail && (
      userByEmail.passwordHash===hashedPass ||
      (!userByEmail.passwordHash && userByEmail.password===pass)
    );
    if(valid) onLogin(userByEmail);
    else setErr("Email o contraseña incorrectos");
    setLoad(false);
  };
  const GRID="linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px)";
  return <><div className="login-shell" style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:GRID,backgroundSize:"44px 44px",opacity:.4}}/>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 50%,var(--cg) 0%,transparent 70%)"}}/>
    <div className="login-card" style={{position:"relative",width:"min(1040px,100%)",display:"grid",gridTemplateColumns:"1.05fr .95fr",gap:18}}>
      <div className="login-promo" style={{background:"linear-gradient(145deg,color-mix(in srgb,var(--cy) 10%, var(--card)),var(--card))",border:"1px solid var(--bdr2)",borderRadius:20,padding:32,boxShadow:"0 24px 80px #0009",display:"flex",flexDirection:"column",justifyContent:"space-between",minHeight:540}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 12px",borderRadius:999,border:"1px solid var(--cm)",background:"var(--cg)",color:"var(--cy)",fontSize:11,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:20}}>Demo gratis</div>
          <div className="login-title" style={{fontFamily:"var(--fh)",fontSize:42,lineHeight:1,fontWeight:800,maxWidth:420,marginBottom:14}}>Opera tu productora con una demo real de Produ</div>
          <div className="login-promo-copy" style={{fontSize:14,color:"var(--gr2)",lineHeight:1.7,maxWidth:460,marginBottom:22}}>Crea una instancia demo, define tus módulos de interés y deja la empresa lista para activación. Ideal para productoras, creadores y equipos de contenido.</div>
          <div className="login-promo-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
            {[["Módulos","Activa solo lo que necesitas"],["Equipo","Invita usuarios y crew"],["Comercial","Presupuestos e invoices"]].map(([title,sub])=><div key={title} style={{padding:"14px 14px",borderRadius:16,background:"rgba(8,8,9,.28)",border:"1px solid var(--bdr2)"}}><div style={{fontSize:12,fontWeight:800,color:"var(--wh)",marginBottom:6}}>{title}</div><div style={{fontSize:11,color:"var(--gr2)",lineHeight:1.5}}>{sub}</div></div>)}
          </div>
        </div>
        <div className="login-promo-footer" style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:12,alignItems:"end"}}>
          <div style={{padding:18,borderRadius:18,background:"rgba(6,10,18,.5)",border:"1px solid var(--bdr2)"}}>
            <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.3,marginBottom:8}}>Qué incluye</div>
            <div style={{display:"grid",gap:8,fontSize:12,color:"var(--gr3)"}}>
              <div>• Calendario, clientes y operación editorial</div>
              <div>• Configuración modular según tu tipo de negocio</div>
              <div>• Activación supervisada por el equipo de Produ</div>
            </div>
          </div>
          <button onClick={()=>setSolOpen(true)} style={{padding:"14px 18px",borderRadius:14,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:800,boxShadow:"0 14px 40px var(--cm)"}}>Crear demo gratis</button>
        </div>
      </div>
      <div className="login-form" style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:20,padding:40,boxShadow:"0 24px 80px #0009"}}>
      <div className="login-logo" style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
          <div style={{width:48,height:48,borderRadius:12,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px var(--cm)"}}>
            <svg viewBox="0 0 24 24" fill="var(--bg)" width="22" height="22"><polygon points="5,3 20,12 5,21"/></svg>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:"var(--fh)",fontSize:32,fontWeight:800,color:"var(--cy)",letterSpacing:-1,lineHeight:1}}>produ</div>
            <div style={{fontSize:10,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
          </div>
        </div>
      </div>
      <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Bienvenido de vuelta</div>
      <div className="login-subcopy" style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:24}}>Ingresa a tu espacio de trabajo</div>
      <FG label="Email"><FI type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.cl" onKeyDown={e=>e.key==="Enter"&&login()}/></FG>
      <FG label="Contraseña">
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center"}}>
          <FI type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()}/>
          <button type="button" onClick={()=>setShowPass(v=>!v)} style={{height:38,padding:"0 12px",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>
            {showPass?"Ocultar":"Ver"}
          </button>
        </div>
      </FG>
      {err&&<div style={{background:"#ff556615",border:"1px solid #ff556635",borderRadius:6,padding:"8px 12px",color:"var(--red)",fontSize:12,marginBottom:12}}>{err}</div>}
      <button onClick={login} disabled={load} style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:700,opacity:load?.7:1,marginBottom:16}}>{load?"Verificando...":"Ingresar →"}</button>
      <div style={{textAlign:"center"}}>
        <span style={{fontSize:12,color:"var(--gr2)"}}>¿No tienes cuenta? </span>
        <button onClick={()=>setSolOpen(true)} style={{background:"none",border:"none",color:"var(--cy)",cursor:"pointer",fontSize:12,fontWeight:600,textDecoration:"underline"}}>Solicitar acceso</button>
      </div>
      </div>
    </div>
  </div>
  {solOpen&&<SolicitudModal onClose={()=>{setSolOpen(false);setSolF({});setSolSent(false);}} solF={solF} setSolF={setSolF} solSent={solSent} setSolSent={setSolSent} empresas={empresas}/>}
  </>;
}

// ── EMPRESA SELECTOR ─────────────────────────────────────────
function EmpresaSelector({empresas,onSelect}){
  const [q,setQ]=useState("");
  const fd=(empresas||[]).filter(e=>e.nombre.toLowerCase().includes(q.toLowerCase()));
  return <div className="company-shell" style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,justifyContent:"center"}}>
      <div style={{width:44,height:44,borderRadius:10,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px var(--cm)"}}>
        <svg viewBox="0 0 24 24" fill="var(--bg)" width="20" height="20"><polygon points="5,3 20,12 5,21"/></svg>
      </div>
      <div>
        <div style={{fontFamily:"var(--fh)",fontSize:32,fontWeight:800,color:"var(--cy)",letterSpacing:-1,lineHeight:1}}>produ</div>
        <div style={{fontSize:10,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
      </div>
    </div>
    <div style={{fontSize:12,color:"var(--gr2)",letterSpacing:1,textTransform:"uppercase",marginBottom:28,textAlign:"center"}}>Super Admin · Seleccionar empresa</div>
    <div className="company-card" style={{width:"min(460px,100%)"}}>
      <SearchBar value={q} onChange={setQ} placeholder="Buscar empresa..."/>
      <div style={{marginTop:12}}>
        {fd.map(emp=>(
          <div key={emp.id} onClick={()=>onSelect(emp)} style={{display:"flex",alignItems:"center",gap:14,background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}>
            <div style={{width:46,height:46,borderRadius:10,background:emp.color+"30",border:`2px solid ${emp.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:17,fontWeight:800,color:emp.color,flexShrink:0,overflow:"hidden"}}>
              {emp.logo ? <img src={emp.logo} style={{width:46,height:46,objectFit:"contain",borderRadius:8}} alt={emp.nombre}/> : ini(emp.nombre)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{emp.nombre}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{emp.rut}</div>
              <div style={{fontSize:10,color:"var(--gr)",marginTop:3}}>Addons: {emp.addons?.join(", ")||"ninguno"}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
              <Badge label={emp.active?"Activa":"Inactiva"} color={emp.active?"green":"red"} sm/>
              <Badge label={emp.plan} color="gray" sm/>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 16px",background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"var(--gr2)"}}>Panel de control global</span>
        <Btn onClick={()=>onSelect("__super__")} sm>⚙ Panel SuperAdmin</Btn>
      </div>
    </div>
  </div>;
}



// ── EXPORT FUNCTIONS ─────────────────────────────────────────
const movFecha = m => m?.fec ?? m?.fecha ?? "";
const movDesc = m => m?.des ?? m?.desc ?? "";
const movMonto = m => Number(m?.mon ?? m?.monto ?? 0);

function exportMovCSV(movs, nombre) {
  const headers = ["Fecha","Tipo","Categoría","Descripción","Monto"];
  const rows = (movs||[]).map(m => [
    movFecha(m),
    m.tipo==="ingreso"?"Ingreso":"Gasto",
    m.cat||"—",
    movDesc(m).replace(/,/g," "),
    movMonto(m)
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/\s+/g,"_")}_movimientos.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMovPDF(movs, nombre, empresa, tipo) {
  const ac = companyPrintColor(empresa);
  const total = (movs||[]).reduce((s,m) => s + movMonto(m), 0);
  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" style="max-height:60px;object-fit:contain;display:block;margin-bottom:6px;">`
    : `<div style="font-size:22px;font-weight:900;color:${ac}">${empresa?.nombre||""}</div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipo} — ${nombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid ${ac}}
.title{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:${ac}}
thead th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;letter-spacing:.5px;text-transform:uppercase}
thead th.r{text-align:right}
tbody tr:nth-child(even){background:#f8f9fc}
tbody td{padding:9px 14px;font-size:12px;border-bottom:1px solid #eee}
tbody td.r{text-align:right;font-family:monospace}
.total-row{display:flex;justify-content:flex-end;margin-top:4px}
.total-box{background:${ac};color:#fff;padding:10px 20px;border-radius:8px;font-size:15px;font-weight:700}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:32px;padding-top:16px;border-top:1px solid #eee}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div>${logoHtml}<div style="font-size:12px;color:#555;margin-top:4px">${empresa?.nombre||""} · ${empresa?.rut||""}</div></div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${tipo}</div>
    <div style="font-size:11px;color:#666">Generado: ${new Date().toLocaleDateString("es-CL")}</div>
  </div>
</div>
<div class="title">${nombre}</div>
<table>
  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="r">Monto</th></tr></thead>
  <tbody>
    ${(movs||[]).map(m=>{
      const fecha = movFecha(m);
      const desc = movDesc(m) || "—";
      const monto = movMonto(m);
      return `<tr>
      <td>${fecha ? new Date(fecha+"T12:00:00").toLocaleDateString("es-CL") : "—"}</td>
      <td>${m.cat||"—"}</td>
      <td>${desc}</td>
      <td class="r">${monto.toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
<div class="total-row">
  <div class="total-box">Total ${tipo}: ${total.toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})}</div>
</div>
<div class="footer">${empresa?.nombre||""} · Generado con Produ</div>
</body></html>`;

  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ── NAV GROUPS — Menú colapsable por grupo ───────────────────
function NavGroups({ NAV, base, collapsed, onNav, user, empresa, flatSidebar }) {
  // Inicializa todos los grupos abiertos
  const initOpen = () => {
    const o = {};
    NAV.forEach(g => { o[g.group] = true; });
    return o;
  };
  const [open, setOpen] = useState(initOpen);
  const toggle = g => setOpen(p => ({ ...p, [g]: !p[g] }));

  if (collapsed) {
    // Modo colapsado — solo iconos centrados
    return <div style={{ padding:"8px 8px 12px" }}>
      {NAV.map(grp => {
        const items = grp.items.filter(n => !n.need || canDo(user, n.need, empresa) || user?.role==="admin" || user?.role==="superadmin");
        if (!items.length) return null;
        return <div key={grp.group} style={{marginBottom:10}}>
          <div style={{width:28,height:1,background:"var(--bdr2)",margin:"0 auto 8px",opacity:.7}}/>
          {items.map(n => {
          const active = base === n.id;
          return <div key={n.id} onClick={() => onNav(n.id)} title={n.label}
            style={{ display:"flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:12,cursor:"pointer",background:active?"linear-gradient(180deg,var(--cg),transparent)":"transparent",border:active?"1px solid var(--cm)":"1px solid transparent",boxShadow:active?"inset 0 0 0 1px var(--cg)":"none",margin:"0 auto 4px",transition:".1s",position:"relative" }}>
            <span style={{ fontSize:18,filter:active?"drop-shadow(0 0 8px var(--cm))":"none" }}>{n.icon}</span>
            {n.cnt>0&&<span style={{position:"absolute",top:3,right:3,minWidth:16,height:16,borderRadius:20,background:active?"var(--cy)":"var(--bdr2)",color:active?"var(--bg)":"var(--gr3)",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",fontFamily:"var(--fm)"}}>{n.cnt>9?"9+":n.cnt}</span>}
          </div>;
        })}
        </div>;
      })}
    </div>;
  }

  return <div style={{ padding:"4px 0" }}>
    {NAV.map(grp => {
      const items = grp.items.filter(n => !n.need || canDo(user, n.need, empresa) || user?.role==="admin" || user?.role==="superadmin");
      if (!items.length) return null;
      const isOpen = open[grp.group] !== false;
      return <div key={grp.group} style={{ margin:"0 8px 10px",background:"transparent",border:"none",borderRadius:12,overflow:"hidden" }}>
        {/* Group header */}
        <div onClick={() => toggle(grp.group)}
          style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px 8px",cursor:"pointer",userSelect:"none",background:flatSidebar?"transparent":"linear-gradient(180deg,var(--card2),transparent)" }}>
          <span style={{ fontSize:10,letterSpacing:1.7,textTransform:"uppercase",fontWeight:800,color:flatSidebar?"#94a3b8":"var(--gr2)" }}>{grp.group}</span>
          <span style={{ fontSize:10,color:flatSidebar?"#94a3b8":"var(--gr2)",transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
        </div>
        {/* Items */}
        {isOpen && <div style={{ padding:"0 6px 8px" }}>
          {items.map(n => {
            const active = base === n.id;
            return <div key={n.id} onClick={() => onNav(n.id)}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",color:active?"var(--cy)":flatSidebar?"#e5edf7":"var(--gr3)",fontSize:13,fontWeight:active?700:500,background:active?"linear-gradient(90deg,var(--cg),transparent)":"transparent",border:`1px solid ${active?"var(--cm)":"transparent"}`,borderRadius:10,transition:".1s",marginBottom:4 }}>
              <span style={{ fontSize:16,flexShrink:0,width:22,textAlign:"center",filter:active?"drop-shadow(0 0 8px var(--cm))":"none" }}>{n.icon}</span>
              <span style={{ flex:1,whiteSpace:"nowrap",textAlign:"left" }}>{n.label}</span>
              {n.cnt !== undefined && <span style={{ background:active?"var(--cm)":flatSidebar?"rgba(255,255,255,.08)":"var(--bdr2)",color:active?"var(--cy)":flatSidebar?"#cbd5e1":"var(--gr2)",fontSize:10,padding:"1px 7px",borderRadius:20,fontFamily:"var(--fm)",fontWeight:600 }}>{n.cnt}</span>}
            </div>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({user,empresa,view,onNav,onAdmin,onLogout,onChangeEmp,counts,collapsed,onToggle,syncPulse,isMobile}){
  const sbBg="var(--sidebar-bg)";
  const sbPanel="var(--sidebar-panel)";
  const sbText="var(--sidebar-text)";
  const sbMuted="var(--sidebar-muted)";
  const base=view==="contenido-det"?"contenidos":view.split("-")[0];
  const rcol={superadmin:"red",admin:"cyan",productor:"green",comercial:"yellow",viewer:"gray"};
  const NAV=[
    {group:"General",items:[{id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"calendario",icon:"📅",label:"Calendario"},...(hasAddon(empresa,"tareas")?[{id:"tareas",icon:"✅",label:"Mis Tareas",cnt:counts.tar}]:[])]},
    {group:"Operación",items:[
      {id:"clientes",icon:"👥",label:"Clientes",need:"clientes",cnt:counts.cli},
      {id:"producciones",icon:"▶",label:"Proyectos",need:"producciones",cnt:counts.pro},
      ...(empresa?.addons?.includes("television")?[{id:"programas",icon:"📺",label:"Producciones",need:"programas",cnt:counts.pg}]:[]),
      ...(empresa?.addons?.includes("social")?[{id:"contenidos",icon:"📱",label:"Contenidos",need:"contenidos",cnt:counts.pz}]:[]),
    ]},
    {group:"Comercial",items:[
      ...(empresa?.addons?.includes("television")?[{id:"auspiciadores",icon:"⭐",label:"Auspiciadores",need:"auspiciadores",cnt:counts.aus}]:[]),
      ...(empresa?.addons?.includes("presupuestos")?[{id:"presupuestos",icon:"📋",label:"Presupuestos",need:"presupuestos",cnt:counts.pres}]:[]),
      ...(empresa?.addons?.includes("facturacion")?[{id:"facturacion",icon:"🧾",label:"Facturación",need:"facturacion",cnt:counts.fact}]:[]),
    ]},
    {group:"Recursos",items:[
      ...(empresa?.addons?.includes("crew")?[{id:"crew",icon:"🎬",label:"Equipo / Crew",need:"crew",cnt:counts.crew}]:[]),
      ...(empresa?.addons?.includes("contratos")?[{id:"contratos",icon:"📄",label:"Contratos",need:"contratos",cnt:counts.ct}]:[]),
      ...(empresa?.addons?.includes("activos")?[{id:"activos",icon:"📦",label:"Activos",need:"activos",cnt:counts.act}]:[]),
    ]},
  ];
  const SW=collapsed?64:240;
  return <aside className="app-sidebar" style={{width:SW,minHeight:"100vh",background:sbBg,display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,transition:"width .2s",overflow:"hidden"}}>
    {/* Logo Produ */}
    <div style={{padding:"14px 14px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:64}}>
      {!collapsed?<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px var(--cm)",flexShrink:0}}>
            <svg viewBox="0 0 24 24" fill="var(--bg)" width="16" height="16"><polygon points="5,3 20,12 5,21"/></svg>
          </div>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:17,fontWeight:800,letterSpacing:-.5,lineHeight:1,color:"var(--cy)"}}>produ</div>
            <div style={{fontSize:8,color:sbMuted,letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
          </div>
        </div>
        <button onClick={onToggle} style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",padding:4,borderRadius:4,fontSize:13}}>{isMobile?"✕":"‹"}</button>
      </>:
        <div onClick={onToggle} style={{width:34,height:34,borderRadius:8,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",cursor:"pointer",boxShadow:"0 0 14px var(--cm)"}}>
          <svg viewBox="0 0 24 24" fill="var(--bg)" width="16" height="16"><polygon points="5,3 20,12 5,21"/></svg>
        </div>}
    </div>
    {/* Empresa chip */}
    {!collapsed&&empresa&&<div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"transparent"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:6,background:sbPanel,border:`1px solid rgba(255,255,255,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
          {empresa.logo
            ? <img src={empresa.logo} style={{width:28,height:28,objectFit:"contain",borderRadius:6}} alt={empresa.nombre}/>
            : <span style={{fontFamily:"var(--fh)",fontSize:10,fontWeight:800,color:empresa.color}}>{ini(empresa.nombre)}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:sbText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{empresa.nombre}</div><div style={{fontSize:9,color:sbMuted}}>{empresa.rut}</div></div>
        {user?.role==="superadmin"&&<button onClick={onChangeEmp} title="Cambiar empresa" style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",fontSize:13,padding:2}}>⇄</button>}
      </div>
    </div>}
    {/* Nav */}
    <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
      <NavGroups NAV={NAV} base={base} collapsed={collapsed} onNav={onNav} user={user} empresa={empresa} flatSidebar={true}/>
    </nav>
    {/* Footer */}
    {!collapsed&&<div style={{padding:"10px 8px 12px",borderTop:"1px solid rgba(255,255,255,.08)",background:"transparent"}}>
      {(user?.role==="admin"||user?.role==="superadmin")&&<div onClick={onAdmin} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,cursor:"pointer",border:"1px solid rgba(255,255,255,.08)",background:sbPanel,color:sbText,fontSize:12,fontWeight:700,marginBottom:8,transition:".1s"}}><span>⚙</span>Panel Admin</div>}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"2px 8px",marginBottom:8}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"var(--cy)",flexShrink:0,animation:syncPulse?"pulse 1s infinite":undefined}}/>
        <span style={{fontSize:9,color:sbMuted}}>Sincronizado · Supabase</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,background:sbPanel,border:"1px solid rgba(255,255,255,.08)"}}>
        <div style={{width:26,height:26,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(user?.name||"")}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:sbText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</div><Badge label={getRoleConfig(user?.role, empresa).label} color={getRoleConfig(user?.role, empresa).badge} sm/></div>
        <button onClick={onLogout} title="Cerrar sesión" style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",fontSize:14,padding:2}}>⏏</button>
      </div>
    </div>}
  </aside>;
}


// ── CONTACT BUTTONS — WhatsApp y Email ───────────────────────
function ContactBtns({ tel, ema, nombre, mensaje }) {
  const waMsg = mensaje || `Hola ${nombre||""}, te contactamos desde Produ.`;
  const waNum = (tel||"").replace(/[^0-9]/g,"");
  const waUrl = `https://wa.me/${waNum.startsWith("56")?waNum:"56"+waNum}?text=${encodeURIComponent(waMsg)}`;
  const mailUrl = `mailto:${ema||""}?subject=Contacto desde Produ&body=${encodeURIComponent(waMsg)}`;
  if (!tel && !ema) return null;
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {tel&&<a href={waUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",fontSize:12,fontWeight:600,textDecoration:"none"}}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        WhatsApp
      </a>}
      {ema&&<a href={mailUrl} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,background:"var(--cg)",border:"1px solid var(--cm)",color:"var(--cy)",fontSize:12,fontWeight:600,textDecoration:"none"}}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cy)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </a>}
    </div>
  );
}

// ── ALERTAS — Bandeja operativa ───────────────────────────────
function calcAlertas(episodios, programas, eventos, tareas, facturas, contratos, empId) {
  const hoy = new Date();
  const alerts = [];
  const pushAlert = alert => alerts.push(alert);

  (episodios||[]).filter(e=>e.empId===empId).forEach(ep => {
    if (!ep.fechaGrab) return;
    const d = new Date(ep.fechaGrab + "T12:00:00");
    const pg = (programas||[]).find(x=>x.id===ep.pgId);
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    if (diff < 0) return;
    if (diff <= 2)  pushAlert({ id:ep.id+"_ep", tipo:"urgente", area:"operacion", icon:"🎬", titulo:`Grabación HOY/MAÑANA: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
    else if (diff <= 7)  pushAlert({ id:ep.id+"_ep", tipo:"pronto", area:"operacion", icon:"🎬", titulo:`Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
    else if (diff <= 30) pushAlert({ id:ep.id+"_ep", tipo:"info", area:"operacion", icon:"🎬", titulo:`Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
  });

  (eventos||[]).filter(e=>e.empId===empId&&e.tipo==="grabacion"&&e.fecha).forEach(ev => {
    const d = new Date(ev.fecha + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    if (diff < 0) return;
    const sub = ev.hora ? `${ev.hora}${ev.desc?" · "+ev.desc:""}` : (ev.desc||"Calendario");
    if (diff <= 2)  pushAlert({ id:ev.id+"_ev", tipo:"urgente", area:"operacion", icon:"📅", titulo:`Grabación HOY/MAÑANA: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
    else if (diff <= 7)  pushAlert({ id:ev.id+"_ev", tipo:"pronto", area:"operacion", icon:"📅", titulo:`Grabación en ${diff} días: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
    else if (diff <= 30) pushAlert({ id:ev.id+"_ev", tipo:"info", area:"operacion", icon:"📅", titulo:`Grabación en ${diff} días: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
  });

  (tareas||[]).filter(t=>t.empId===empId&&t.fechaLimite&&t.estado!=="Completada").forEach(t=>{
    const d = new Date(t.fechaLimite + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    const tipo = diff < 0 ? "urgente" : diff <= 2 ? "urgente" : diff <= 7 ? "pronto" : "info";
    const label = diff < 0 ? `Tarea vencida: ${t.titulo}` : diff === 0 ? `Tarea vence hoy: ${t.titulo}` : diff === 1 ? `Tarea vence mañana: ${t.titulo}` : `Tarea vence en ${diff} días: ${t.titulo}`;
    pushAlert({ id:t.id+"_task", tipo, area:"equipo", icon:"✅", titulo:label, sub:t.estado||"Pendiente", fecha:t.fechaLimite, diff:Math.max(diff,0) });
  });

  (facturas||[]).filter(f=>f.empId===empId&&f.fechaVencimiento&&cobranzaState(f)!=="Pagado").forEach(f=>{
    const d = new Date(f.fechaVencimiento + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    const tipo = diff < 0 ? "urgente" : diff <= 3 ? "urgente" : diff <= 7 ? "pronto" : "info";
    const label = diff < 0 ? `Cobranza vencida: ${f.correlativo || "Invoice"}` : diff === 0 ? `Invoice vence hoy: ${f.correlativo || "Invoice"}` : `Invoice vence en ${Math.max(diff,0)} días: ${f.correlativo || "Invoice"}`;
    pushAlert({ id:f.id+"_bill", tipo, area:"comercial", icon:"💸", titulo:label, sub:fmtM(f.total||0), fecha:f.fechaVencimiento, diff:Math.max(diff,0) });
  });

  (contratos||[]).filter(c=>c.empId===empId&&c.vig).forEach(ct=>{
    const days = daysUntil(ct.vig);
    if (days===null || days > Number(ct.alertaDias || 30)) return;
    const tipo = days < 0 ? "urgente" : days <= 7 ? "urgente" : "pronto";
    const label = days < 0 ? `Contrato vencido: ${ct.nom}` : `Contrato por vencer: ${ct.nom}`;
    pushAlert({ id:ct.id+"_ct", tipo, area:"comercial", icon:"📄", titulo:label, sub:ct.est||"Vigente", fecha:ct.vig, diff:Math.max(days,0) });
  });

  return alerts.sort((a,b)=>{
    const pri = {urgente:0,pronto:1,info:2};
    return (pri[a.tipo]??9) - (pri[b.tipo]??9) || a.diff-b.diff;
  });
}
function useAlertas(episodios, programas, eventos, tareas, facturas, contratos, empId) {
  const [alerts, setAlerts] = useState([]);
  const epLen = (episodios||[]).length;
  const evLen = (eventos||[]).length;
  const tarLen = (tareas||[]).length;
  const factLen = (facturas||[]).length;
  const ctLen = (contratos||[]).length;
  useEffect(() => {
    setAlerts(calcAlertas(episodios, programas, eventos, tareas, facturas, contratos, empId));
  }, [epLen, evLen, tarLen, factLen, ctLen, empId]);
  return alerts;
}

function AlertasPanel({ alertas, leidas=[], onMarcar, onMarcarTodas, onClose }) {
  const noLeidas = alertas.filter(a=>!leidas.includes(a.id));
  const siLeidas = alertas.filter(a=>leidas.includes(a.id));
  const [filtro,setFiltro]=useState("todas");
  const filteredUnread=noLeidas.filter(a=>filtro==="todas"||a.tipo===filtro||a.area===filtro);
  const counters={
    urgentes:noLeidas.filter(a=>a.tipo==="urgente").length,
    equipo:noLeidas.filter(a=>a.area==="equipo").length,
    comercial:noLeidas.filter(a=>a.area==="comercial").length,
  };
  return (
    <div style={{position:"fixed",top:70,right:20,zIndex:888,width:410,maxWidth:"calc(100vw - 24px)",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:14,boxShadow:"0 12px 40px #0009",animation:"slideIn .25s ease",overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🔔</span>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Centro de Alertas</div>
            <div style={{fontSize:10,color:"var(--gr2)"}}>{noLeidas.length} sin leer · {alertas.length} total</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {noLeidas.length>0&&<button onClick={onMarcarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Marcar todas</button>}
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:18,padding:2}}>✕</button>
        </div>
      </div>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",gap:8,flexWrap:"wrap"}}>
        {[["todas","Todas",noLeidas.length],["urgente","Urgentes",counters.urgentes],["equipo","Equipo",counters.equipo],["comercial","Comercial",counters.comercial]].map(([key,label,count])=><button key={key} onClick={()=>setFiltro(key)} style={{padding:"6px 10px",borderRadius:999,border:`1px solid ${filtro===key?"var(--cy)":"var(--bdr2)"}`,background:filtro===key?"var(--cg)":"transparent",color:filtro===key?"var(--cy)":"var(--gr3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label} {count?`(${count})`:""}</button>)}
      </div>
      <div style={{maxHeight:420,overflowY:"auto"}}>
        {alertas.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--gr2)",fontSize:13}}>Sin alertas activas</div>}
        {filteredUnread.map(a=>{
          const colores={urgente:["#ff556615","#ff5566"],pronto:["#ffcc4415","#ffcc44"],info:["var(--cg)","var(--cy)"]};
          const [bg,color]=colores[a.tipo]||["var(--cg)","var(--cy)"];
          return <div key={a.id} style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--bdr)",background:bg,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{a.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--wh)",lineHeight:1.3}}>{a.titulo}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:3}}>{a.sub} · {fmtD(a.fecha)}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                <Badge label={a.area==="comercial"?"Comercial":a.area==="equipo"?"Equipo":"Operación"} color={a.area==="comercial"?"red":a.area==="equipo"?"purple":"cyan"} sm/>
                <Badge label={a.tipo==="urgente"?"Urgente":a.tipo==="pronto"?"Próxima":"Info"} color={a.tipo==="urgente"?"red":a.tipo==="pronto"?"yellow":"gray"} sm/>
              </div>
            </div>
            <button onClick={()=>onMarcar(a.id)} title="Marcar como leída" style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>✓ Leída</button>
          </div>;
        })}
        {filteredUnread.length===0&&noLeidas.length>0&&<div style={{padding:18,textAlign:"center",color:"var(--gr2)",fontSize:12}}>No hay alertas en este filtro.</div>}
        {siLeidas.length>0&&<><div style={{padding:"8px 16px",fontSize:10,color:"var(--gr)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,borderBottom:"1px solid var(--bdr)"}}>Ya leídas</div>
        {siLeidas.map(a=><div key={a.id} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid var(--bdr)",opacity:.5,alignItems:"center"}}>
          <span style={{fontSize:14,flexShrink:0}}>✓</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:"var(--gr3)",textDecoration:"line-through"}}>{a.titulo}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{a.sub} · {fmtD(a.fecha)}</div>
          </div>
        </div>)}</>}
      </div>
      {noLeidas.length===0&&alertas.length>0&&<div style={{padding:"10px 16px",background:"var(--sur)",borderTop:"1px solid var(--bdr)",textAlign:"center",fontSize:12,color:"var(--gr2)"}}>✓ Todas las alertas están leídas</div>}
    </div>
  );
}

function SystemMessagesPanel({ empresa, mensajes=[], leidas=[], onMarcar, onMarcarTodas, onClose }){
  const noLeidas=(mensajes||[]).filter(m=>!leidas.includes(m.id));
  const leidasMsgs=(mensajes||[]).filter(m=>leidas.includes(m.id));
  const sorted=[...noLeidas,...leidasMsgs].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return <div style={{position:"fixed",top:70,right:20,zIndex:887,width:410,maxWidth:"calc(100vw - 24px)",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:14,boxShadow:"0 12px 40px #0009",animation:"slideIn .25s ease",overflow:"hidden"}}>
    <div style={{padding:"14px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>💬</span>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Mensajes del Sistema</div>
          <div style={{fontSize:10,color:"var(--gr2)"}}>{empresa?.nombre||"Empresa"} · {noLeidas.length} sin leer</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {noLeidas.length>0&&<button onClick={onMarcarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Marcar todas</button>}
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:18,padding:2}}>✕</button>
      </div>
    </div>
    <div style={{maxHeight:420,overflowY:"auto"}}>
      {!sorted.length&&<div style={{padding:24,textAlign:"center",color:"var(--gr2)",fontSize:13}}>Sin mensajes de sistema</div>}
      {sorted.map(m=><div key={m.id} style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--bdr)",background:leidas.includes(m.id)?"transparent":"var(--cg)",opacity:leidas.includes(m.id)?.62:1}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:leidas.includes(m.id)?"var(--bdr2)":"var(--cy)",marginTop:5,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{m.title||"Mensaje del sistema"}</div>
            <div style={{fontSize:10,color:"var(--gr2)",whiteSpace:"nowrap"}}>{m.createdAt?fmtD(m.createdAt):"—"}</div>
          </div>
          <div style={{fontSize:11,color:"var(--gr3)",marginTop:6,whiteSpace:"pre-line",lineHeight:1.5}}>{m.body||""}</div>
        </div>
        {!leidas.includes(m.id)&&<button onClick={()=>onMarcar(m.id)} style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>✓ Leído</button>}
      </div>)}
    </div>
  </div>;
}


// ── TAREAS — Pipeline Kanban ──────────────────────────────────
const COLS_TAREAS = ["Pendiente","En Progreso","En Revisión","Completada"];
const PRIO_COLORS = { Alta:"#ff5566", Media:"#fbbf24", Baja:"#60a5fa" };
const PRIO_BG    = { Alta:"#ff556618", Media:"#fbbf2418", Baja:"#60a5fa18" };
const getAssignedIds = item => {
  const ids = Array.isArray(item?.assignedIds)
    ? item.assignedIds.filter(Boolean)
    : item?.asignadoA
      ? [item.asignadoA]
      : [];
  return [...new Set(ids)];
};
const normalizeTaskAssignees = task => {
  const assignedIds = getAssignedIds(task);
  return { ...task, assignedIds, asignadoA: task?.asignadoA || assignedIds[0] || "" };
};
const assignedNameList = (item, crew = [], user = null) => {
  const crewMap = Object.fromEntries((crew||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  return getAssignedIds(item).map(id => {
    if (crewMap[id]?.nom) return crewMap[id].nom;
    if (user?.id===id) return user?.name || "Usuario";
    return "";
  }).filter(Boolean);
};

function MTarea({ open, data, producciones, programas, piezas, crew, listas, onClose, onSave }) {
  const empty = { titulo:"", desc:"", estado:"Pendiente", prioridad:"Media", fechaLimite:"", refTipo:"", refId:"", asignadoA:"", assignedIds:[] };
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? normalizeTaskAssignees({ ...data }) : { ...empty }); }, [data, open]);
  const u = (k,v) => setF(p => ({ ...p, [k]: v }));
  const toggleAssigned = id => setF(prev => {
    const current = getAssignedIds(prev);
    const nextIds = current.includes(id) ? current.filter(x => x!==id) : [...current, id];
    return { ...prev, assignedIds: nextIds, asignadoA: nextIds[0] || "" };
  });
  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar Tarea" : "Nueva Tarea"}>
      <FG label="Título *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Descripción breve de la tarea"/></FG>
      <FG label="Descripción"><FTA value={f.desc||""} onChange={e=>u("desc",e.target.value)} placeholder="Detalle opcional..."/></FG>
      <R2>
        <FG label="Prioridad"><FSl value={f.prioridad||"Media"} onChange={e=>u("prioridad",e.target.value)}>
          {(listas?.prioridadesTarea||DEFAULT_LISTAS.prioridadesTarea).map(o=><option key={o}>{o}</option>)}
        </FSl></FG>
        <FG label="Estado"><FSl value={f.estado||"Pendiente"} onChange={e=>u("estado",e.target.value)}>
          {(listas?.estadosTarea||DEFAULT_LISTAS.estadosTarea).map(c=><option key={c}>{c}</option>)}
        </FSl></FG>
      </R2>
      <R2>
        <FG label="Fecha límite"><FI type="date" value={f.fechaLimite||""} onChange={e=>u("fechaLimite",e.target.value)}/></FG>
        <FG label="Responsable principal"><FSl value={f.asignadoA||""} onChange={e=>{
          const value = e.target.value;
          const rest = getAssignedIds(f).filter(id=>id!==value);
          u("asignadoA", value);
          u("assignedIds", value ? [value, ...rest] : rest);
        }}>
          <option value="">— Sin asignar —</option>
          {(crew||[]).map(c=><option key={c.id} value={c.id}>{c.nom} · {c.rol||"Crew"}</option>)}
        </FSl></FG>
      </R2>
      {!!crew?.length&&<FG label="Asignar a más usuarios">
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {(crew||[]).map(member=>{
            const active = getAssignedIds(f).includes(member.id);
            return <button key={member.id} type="button" onClick={()=>toggleAssigned(member.id)} style={{padding:"8px 10px",borderRadius:999,border:`1px solid ${active?"var(--cy)":"var(--bdr)"}`,background:active?"color-mix(in srgb, var(--cy) 14%, transparent)":"var(--sur)",color:active?"var(--cy)":"var(--gr3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>
              {active?"✓ ":""}{member.nom}
            </button>;
          })}
        </div>
        <div style={{fontSize:10,color:"var(--gr2)",marginTop:6}}>Puedes asignar la tarea a varios usuarios. El responsable principal será el primero de la lista.</div>
      </FG>}
      <R2>
        <FG label="Asociar a"><FSl value={f.refTipo||""} onChange={e=>{u("refTipo",e.target.value);u("refId","");}}>
          <option value="">— Sin asociar —</option>
          <option value="pro">Proyecto</option>
          <option value="pg">Producción</option>
          <option value="pz">Campaña de Contenidos</option>
          <option value="crew">Crew</option>
        </FSl></FG>
        {f.refTipo==="pro"&&<FG label="Proyecto"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(producciones||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </FSl></FG>}
        {f.refTipo==="pg"&&<FG label="Producción"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(programas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </FSl></FG>}
        {f.refTipo==="pz"&&<FG label="Campaña"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(piezas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </FSl></FG>}
        {f.refTipo==="crew"&&<FG label="Miembro Crew"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(crew||[]).map(c=><option key={c.id} value={c.id}>{c.nom} · {c.rol||"Crew"}</option>)}
        </FSl></FG>}
      </R2>
      <MFoot onClose={onClose} onSave={()=>{ if(!f.titulo) return; onSave(normalizeTaskAssignees(f)); }}/>
    </Modal>
  );
}

function TareaCard({ tarea, producciones, programas, piezas, crew, onEdit, onDelete, onChangeEstado, onOpen, canEdit=true, draggable=false, onDragStart, onDragEnd }) {
  const ref = tarea.refTipo==="pro"
    ? (producciones||[]).find(x=>x.id===tarea.refId)
    : tarea.refTipo==="pg"
      ? (programas||[]).find(x=>x.id===tarea.refId)
      : tarea.refTipo==="pz"
        ? (piezas||[]).find(x=>x.id===tarea.refId)
        : tarea.refTipo==="crew"
          ? (crew||[]).find(x=>x.id===tarea.refId)
          : null;
  const asigs = getAssignedIds(tarea).map(id => (crew||[]).find(x=>x.id===id)).filter(Boolean);
  const venc = tarea.fechaLimite ? Math.ceil((new Date(tarea.fechaLimite+"T12:00:00") - new Date()) / (1000*60*60*24)) : null;
  const vencColor = venc===null?"var(--gr2)":venc<0?"#ff5566":venc<=2?"#fbbf24":"var(--gr2)";
  const refLabel = ref?.nom || ref?.name || ref?.titulo || "Referencia";
  return (
    <div
      draggable={draggable}
      onDragStart={e=>onDragStart&&onDragStart(e,tarea)}
      onDragEnd={e=>onDragEnd&&onDragEnd(e,tarea)}
      onClick={()=>onOpen&&onOpen(tarea)}
      style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:14,marginBottom:10,cursor:onOpen?"pointer":"default",transition:".15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}
    >
      {/* Prioridad badge */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:PRIO_BG[tarea.prioridad]||"var(--bdr)",color:PRIO_COLORS[tarea.prioridad]||"var(--gr2)"}}>{tarea.prioridad||"Media"}</span>
        <div style={{display:"flex",gap:4}}>
          {canEdit&&<>
          <GBtn sm onClick={e=>{e.stopPropagation();onEdit(tarea);}}>✏</GBtn>
          <XBtn onClick={e=>{e.stopPropagation();onDelete(tarea.id);}}/>
          </>}
        </div>
      </div>
      {/* Título */}
      <div style={{fontSize:13,fontWeight:600,color:"var(--wh)",marginBottom:6,lineHeight:1.4}}>{tarea.titulo}</div>
      {tarea.desc&&<div style={{fontSize:11,color:"var(--gr2)",marginBottom:8,lineHeight:1.5}}>{tarea.desc}</div>}
      {/* Ref */}
      {ref&&<div style={{fontSize:11,color:"var(--cy)",marginBottom:6}}>
        {tarea.refTipo==="pro"?"📽":tarea.refTipo==="pg"?"📺":tarea.refTipo==="pz"?"📱":"🎬"} {refLabel}
      </div>}
      {/* Footer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--bdr)"}}>
        {asigs.length
          ? <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{display:"flex",alignItems:"center"}}>
                {asigs.slice(0,3).map((asig,idx)=><div key={asig.id} style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--bg)",flexShrink:0,marginLeft:idx? -6:0,border:"2px solid var(--card)"}}>{asig.nom?.charAt(0)||"?"}</div>)}
              </div>
              <span style={{fontSize:11,color:"var(--gr2)"}}>{asigs.map(x=>x.nom).join(", ")}</span>
            </div>
          : <span style={{fontSize:11,color:"var(--gr)",fontStyle:"italic"}}>Sin asignar</span>
        }
        {venc!==null&&<span style={{fontSize:10,fontWeight:600,color:vencColor}}>
          {venc<0?`Vencida hace ${Math.abs(venc)}d`:venc===0?"Vence hoy":venc===1?"Vence mañana":`${venc}d`}
        </span>}
      </div>
      {/* Mover columna */}
      {canEdit&&<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
        {COLS_TAREAS.filter(c=>c!==tarea.estado).map(c=>(
          <button key={c} onClick={e=>{e.stopPropagation();onChangeEstado(tarea.id,c);}}
            style={{fontSize:10,padding:"2px 8px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr2)",cursor:"pointer",transition:".1s"}}
            onMouseEnter={e=>{e.target.style.borderColor="var(--cy)";e.target.style.color="var(--cy)";}}
            onMouseLeave={e=>{e.target.style.borderColor="var(--bdr2)";e.target.style.color="var(--gr2)";}}>
            → {c}
          </button>
        ))}
      </div>}
    </div>
  );
}

function ComentariosBlock({ items = [], onSave, canEdit, title = "Comentarios", onCreateTask, crewOptions = [], empresa, currentUser }) {
  const [txt,setTxt]=useState("");
  const [editingId,setEditingId]=useState(null);
  const [pasarATarea,setPasarATarea]=useState(false);
  const [assignedIds,setAssignedIds]=useState([]);
  const [attachments,setAttachments]=useState([]);
  const crewMap = Object.fromEntries((crewOptions||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const resetForm=()=>{setTxt("");setEditingId(null);setPasarATarea(false);setAssignedIds([]);setAttachments([]);};
  const loadAttachments=async files=>{
    const nextAttachments = await Promise.all(Array.from(files||[]).slice(0,6).map(commentAttachmentFromFile));
    setAttachments(prev=>[...prev,...nextAttachments.filter(Boolean)].slice(0,6));
  };
  const toggleAssigned = id => setAssignedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const submit=async()=>{
    const val=txt.trim();
    if(!val) return;
    const prevItem=editingId?items.find(it=>it.id===editingId):null;
    const normalizedAssigned = [...new Set(assignedIds.filter(Boolean))];
    const normalizedAttachments = normalizeCommentAttachments({ attachments });
    const commentItem=editingId
      ? {...prevItem,text:val,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),upd:today()}
      : {id:uid(),text:val,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),cr:today(),authorId:currentUser?.id||"",authorName:currentUser?.name||"Usuario"};
    const next=editingId
      ? items.map(it=>it.id===editingId?commentItem:it)
      : [commentItem,...items];
    await onSave(next);
    if(pasarATarea && onCreateTask && !prevItem?.pasarATarea) await onCreateTask(commentItem);
    resetForm();
  };
  const editItem=it=>{setTxt(it.text||"");setEditingId(it.id);setPasarATarea(it.pasarATarea===true);setAssignedIds(getAssignedIds(it));setAttachments(normalizeCommentAttachments(it));};
  const delItem=async id=>{
    if(!confirm("¿Eliminar comentario?")) return;
    await onSave(items.filter(it=>it.id!==id));
    if(editingId===id) resetForm();
  };
  return <Card title={title}>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      {!!items.length&&<GBtn sm onClick={()=>exportComentariosCSV(items,title)}>⬇ Exportar CSV</GBtn>}
      {!!items.length&&<GBtn sm onClick={()=>exportComentariosPDF(items,title,empresa)}>⬇ Exportar PDF</GBtn>}
    </div>
    {canEdit&&<div style={{marginBottom:16}}>
      <FTA value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Escribe una nota o comentario relevante..."/>
      <div style={{marginTop:10}}>
        <FG label="Asignar comentario a">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(crewOptions||[]).map(member=>{
              const active = assignedIds.includes(member.id);
              return <button key={member.id} type="button" onClick={()=>toggleAssigned(member.id)} style={{padding:"8px 10px",borderRadius:999,border:`1px solid ${active?"var(--cy)":"var(--bdr)"}`,background:active?"color-mix(in srgb, var(--cy) 14%, transparent)":"var(--sur)",color:active?"var(--cy)":"var(--gr3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {active?"✓ ":""}{member.nom}
              </button>;
            })}
          </div>
        </FG>
      </div>
      <div style={{marginTop:10}}>
        <FG label="Adjuntos del comentario">
          <input type="file" accept="image/*,application/pdf" multiple onChange={async e=>{await loadAttachments(e.target.files);e.target.value="";}}/>
        </FG>
        {!!attachments.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8,marginTop:10}}>
          {attachments.map(att=><div key={att.id} style={{position:"relative",borderRadius:12,overflow:"hidden",border:"1px solid var(--bdr)",background:"var(--sur)"}}>
            {att.type==="pdf"
              ? <div style={{display:"grid",placeItems:"center",height:100,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>📄</div>
                  <div style={{fontSize:10,color:"var(--gr3)",lineHeight:1.4,wordBreak:"break-word"}}>{att.name||"PDF"}</div>
                </div>
              : <img src={att.src} alt={att.name||"Foto comentario"} style={{display:"block",width:"100%",height:100,objectFit:"cover"}}/>}
            <button onClick={()=>setAttachments(prev=>prev.filter(p=>p.id!==att.id))} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(15,23,42,.84)",color:"#fff",cursor:"pointer"}}>×</button>
          </div>)}
        </div>}
        <div style={{fontSize:10,color:"var(--gr2)",marginTop:6}}>Puedes adjuntar hasta 6 archivos entre imágenes y PDF. Al hacer click en un adjunto guardado se abrirá o descargará.</div>
      </div>
      {!!onCreateTask&&<label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11,color:"var(--gr2)",marginTop:10,cursor:"pointer"}}>
        <input type="checkbox" checked={pasarATarea} onChange={e=>setPasarATarea(e.target.checked)}/>
        Marcar para pasar a tarea
      </label>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        {editingId&&<GBtn sm onClick={resetForm}>Cancelar</GBtn>}
        <Btn sm onClick={submit}>{editingId?"Actualizar comentario":"Agregar comentario"}</Btn>
      </div>
    </div>}
    {items.length?items.map(it=><div key={it.id} style={{padding:"12px 0",borderTop:"1px solid var(--bdr)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          {it.pasarATarea&&<div style={{fontSize:10,fontWeight:700,color:"var(--cy)",marginBottom:6,letterSpacing:.6,textTransform:"uppercase"}}>Pasar a tarea</div>}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--wh)"}}>{it.authorName||"Usuario"}</span>
            <span style={{fontSize:10,color:"var(--gr2)"}}>{it.upd?`Editado ${fmtD(it.upd)}`:it.cr?`Creado ${fmtD(it.cr)}`:""}</span>
          </div>
          <div style={{fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line",lineHeight:1.6}}>{it.text}</div>
          {!!normalizeCommentAttachments(it).length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginTop:10}}>
            {normalizeCommentAttachments(it).map(att=><a key={att.id||att.src} href={att.src} target="_blank" rel="noreferrer" download={att.name||true} style={{display:"block",borderRadius:12,overflow:"hidden",border:"1px solid var(--bdr)",textDecoration:"none",background:"var(--sur)"}}>
              {att.type==="pdf"
                ? <div style={{display:"grid",placeItems:"center",height:110,padding:10,textAlign:"center"}}>
                    <div style={{fontSize:30,marginBottom:8}}>📄</div>
                    <div style={{fontSize:10,color:"var(--gr3)",lineHeight:1.4,wordBreak:"break-word"}}>{att.name||"Documento PDF"}</div>
                    <div style={{fontSize:10,color:"var(--cy)",marginTop:6,fontWeight:700}}>Abrir / Descargar</div>
                  </div>
                : <div style={{position:"relative"}}>
                    <img src={att.src} alt={att.name||"Foto comentario"} style={{display:"block",width:"100%",height:110,objectFit:"cover"}}/>
                    <div style={{position:"absolute",left:8,bottom:8,padding:"4px 8px",borderRadius:999,background:"rgba(15,23,42,.72)",color:"#fff",fontSize:10,fontWeight:700}}>Abrir</div>
                  </div>}
            </a>)}
          </div>}
          {!!getAssignedIds(it).length&&<div style={{fontSize:11,color:"var(--cy)",marginTop:8}}>
            Asignado a: {getAssignedIds(it).map(id=>crewMap[id]?.nom).filter(Boolean).join(", ")}
          </div>}
        </div>
        {canEdit&&<div style={{display:"flex",gap:4,flexShrink:0}}><GBtn sm onClick={()=>editItem(it)}>✏</GBtn><XBtn onClick={()=>delItem(it.id)}/></div>}
      </div>
    </div>):<Empty text="Sin comentarios" sub={canEdit?"Agrega la primera nota para este registro":""}/>}
  </Card>;
}

function TareasContexto({ title, refTipo, refId, tareas, producciones, programas, piezas, crew, openM, setTareas, canEdit }) {
  try{
    const safeTareas=Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"):[];
    const items=safeTareas
      .filter(t=>t.refTipo===refTipo&&t.refId===refId)
      .sort((a,b)=>String(b.cr||"").localeCompare(String(a.cr||"")));
    const changeEstado=async(id,nuevoEstado)=>{
      const next=safeTareas.map(t=>t.id===id?{...t,estado:nuevoEstado}:t);
      await setTareas(next);
    };
    const deleteTarea=async(id)=>{
      if(!confirm("¿Eliminar tarea?")) return;
      const next=safeTareas.filter(t=>t.id!==id);
      await setTareas(next);
    };
    return <TaskErrorBoundary title={title}>
      <Card title={title} action={canEdit?{label:"+ Tarea",fn:()=>openM("tarea",{estado:"Pendiente",refTipo,refId})}:null}>
        {items.length?items.map(t=><TareaCard key={t.id||uid()} tarea={t} producciones={producciones||[]} programas={programas||[]} piezas={piezas||[]} crew={crew||[]} onEdit={canEdit?x=>openM("tarea",x):()=>{}} onDelete={canEdit?deleteTarea:()=>{}} onChangeEstado={canEdit?changeEstado:()=>{}} onOpen={canEdit?x=>openM("tarea",x):undefined} canEdit={canEdit}/>):<Empty text="Sin tareas asociadas" sub={canEdit?"Crea una tarea para darle seguimiento a este registro":""}/>}
      </Card>
    </TaskErrorBoundary>;
  }catch{
    return <Card title={title}>
      <Empty text="No pudimos cargar este bloque de tareas" sub="Usa el módulo general de Tareas mientras normalizamos estos datos."/>
    </Card>;
  }
}

function ViewTareas({ empresa, user, tareas, producciones, programas, piezas, crew, openM, canDo, cDel, setTareas, saveTareas }) {
  const empId = empresa?.id;
  const [filtro, setFiltro] = useState("mis"); // "mis" | "todas"
  const [filtroRef, setFiltroRef] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState("");
  const dragIdRef = useRef(null);
  const safeTareas = Array.isArray(tareas) ? tareas.filter(t => t && typeof t==="object") : [];
  const normalizedTareas = safeTareas.map(normalizeTaskAssignees);

  const misTareas = normalizedTareas.filter(t => t.empId===empId);
  const tareasVis = filtro==="mis"
    ? misTareas.filter(t => getAssignedIds(t).includes(user?.id) || !getAssignedIds(t).length)
    : misTareas;
  const tareasFilt = filtroRef
    ? tareasVis.filter(t => `${t.refTipo||""}:${t.refId||""}`===filtroRef)
    : tareasVis;

  const porColumna = col => tareasFilt.filter(t => (t.estado||"Pendiente")===col);

  const changeEstado = async (id, nuevoEstado) => {
    const next = normalizedTareas.map(t => t.id===id ? {...t, estado:nuevoEstado} : t);
    await setTareas(next);
  };

  const handleDrop = async (event, nuevoEstado) => {
    const droppedId = event?.dataTransfer?.getData("text/plain") || dragIdRef.current || dragId;
    if(!droppedId) return;
    await changeEstado(droppedId, nuevoEstado);
    setDragId(null);
    dragIdRef.current = null;
    setDropCol("");
  };

  const deleteTarea = (id) => {
    if(!confirm("¿Eliminar tarea?")) return;
    setTareas(normalizedTareas.filter(t => t.id!==id));
  };

  const colColors = { Pendiente:"var(--bdr2)", "En Progreso":"#60a5fa", "En Revisión":"#fbbf24", Completada:"#4ade80" };

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800}}>Pipeline de Tareas</div>
          <div style={{fontSize:12,color:"var(--gr2)",marginTop:2}}>{tareasFilt.length} tarea{tareasFilt.length!==1?"s":""} · {tareasFilt.filter(t=>t.estado==="Completada").length} completadas</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden"}}>
            {[["mis","Mis Tareas"],["todas","Todas"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltro(v)} style={{padding:"7px 14px",border:"none",background:filtro===v?"var(--cy)":"transparent",color:filtro===v?"var(--bg)":"var(--gr2)",cursor:"pointer",fontSize:12,fontWeight:600,transition:".15s"}}>{l}</button>
            ))}
          </div>
          <select value={filtroRef} onChange={e=>setFiltroRef(e.target.value)} style={{padding:"7px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,color:"var(--gr3)",fontSize:12,cursor:"pointer"}}>
            <option value="">Todos los vínculos</option>
            <optgroup label="Proyectos">{(producciones||[]).filter(p=>p.empId===empId).map(p=><option key={p.id} value={`pro:${p.id}`}>{p.nom}</option>)}</optgroup>
            <optgroup label="Producciones">{(programas||[]).filter(p=>p.empId===empId).map(p=><option key={p.id} value={`pg:${p.id}`}>{p.nom}</option>)}</optgroup>
            <optgroup label="Contenidos">{(piezas||[]).filter(p=>p.empId===empId).map(p=><option key={p.id} value={`pz:${p.id}`}>{p.nom}</option>)}</optgroup>
            <optgroup label="Crew">{(crew||[]).filter(c=>c.empId===empId).map(c=><option key={c.id} value={`crew:${c.id}`}>{c.nom}</option>)}</optgroup>
          </select>
          <Btn onClick={()=>openM("tarea",{})}>+ Nueva Tarea</Btn>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,alignItems:"start"}}>
        {COLS_TAREAS.map(col => {
          const items = porColumna(col);
          return (
            <div
              key={col}
              onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(dropCol!==col) setDropCol(col);}}
              onDragLeave={()=>setDropCol(prev=>prev===col?"":prev)}
              onDrop={async e=>{e.preventDefault();await handleDrop(e,col);}}
            >
              {/* Column header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:dropCol===col?"var(--cg)":"var(--sur)",border:`1px solid ${dropCol===col?"var(--cy)":"var(--bdr2)"}`,borderRadius:10,marginBottom:12,borderTop:`3px solid ${colColors[col]}`,transition:".12s"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{col}</span>
                  <span style={{fontSize:11,background:"var(--bdr2)",color:"var(--gr2)",padding:"1px 7px",borderRadius:10,fontFamily:"var(--fm)",fontWeight:600}}>{items.length}</span>
                </div>
                <GBtn sm onClick={()=>openM("tarea",{estado:col})}>+</GBtn>
              </div>
              {/* Cards */}
              <div
                onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(dropCol!==col) setDropCol(col);}}
                onDrop={async e=>{e.preventDefault();e.stopPropagation();await handleDrop(e,col);}}
                style={{minHeight:80,padding:dropCol===col?6:0,borderRadius:10,background:dropCol===col?"var(--cg)":"transparent",transition:".12s"}}
              >
                {items.length===0
                  ? <div style={{padding:16,textAlign:"center",color:"var(--gr)",fontSize:12,fontStyle:"italic",border:"1px dashed var(--bdr)",borderRadius:10}}>Sin tareas</div>
                  : items.map(t=>(
                    <div key={t.id} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(dropCol!==col) setDropCol(col);}} onDrop={async e=>{e.preventDefault();e.stopPropagation();await handleDrop(e,col);}}>
                      <TareaCard tarea={t} producciones={producciones} programas={programas} piezas={piezas} crew={crew}
                        onEdit={t=>openM("tarea",t)}
                        onDelete={deleteTarea}
                        onChangeEstado={changeEstado}
                        onOpen={t=>openM("tarea",t)}
                        draggable
                        onDragStart={(e,tarea)=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain", String(tarea.id||""));setDragId(tarea.id);dragIdRef.current=tarea.id;}}
                        onDragEnd={()=>{setDragId(null);dragIdRef.current=null;setDropCol("");}}
                      />
                    </div>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function ViewDashboard({empresa,user,clientes,producciones,programas,episodios,auspiciadores,movimientos,presupuestos,facturas,contratos,piezas,activos,alertas,navTo}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const mvs=(movimientos||[]).filter(m=>m.empId===empId);
  const ti=mvs.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.mon),0);
  const tg=mvs.filter(m=>m.tipo==="gasto").reduce((s,m)=>s+Number(m.mon),0);
  const clis=(clientes||[]).filter(x=>x.empId===empId);
  const pros=(producciones||[]).filter(x=>x.empId===empId);
  const pgs=(programas||[]).filter(x=>x.empId===empId);
  const eps=(episodios||[]).filter(x=>x.empId===empId);
  const cts=(contratos||[]).filter(x=>x.empId===empId);
  const campaigns=(piezas||[]).filter(x=>x.empId===empId);
  const pres=(presupuestos||[]).filter(x=>x.empId===empId);
  const facts=(facturas||[]).filter(x=>x.empId===empId);
  const canContracts = hasAddon(empresa, "contratos");
  const canBudgets = hasAddon(empresa, "presupuestos") && canDo(user, "presupuestos", empresa);
  const canInvoices = hasAddon(empresa, "facturacion") && canDo(user, "facturacion", empresa);
  const canSocial = hasAddon(empresa, "social");
  const projectedRecurring = facts.filter(f=>f.recurring).reduce((s,f)=>s+Number(f.total||0),0);
  const overdueFacts = facts.filter(f=>f.estado!=="Pagada" && f.fechaVencimiento && String(f.fechaVencimiento) < today());
  const payableSoon = facts.filter(f=>f.estado!=="Pagada" && f.fechaVencimiento && daysUntil(f.fechaVencimiento)!==null && daysUntil(f.fechaVencimiento)>=0 && daysUntil(f.fechaVencimiento)<=7);
  const contractsExpiring = cts.filter(ct=>daysUntil(ct.vig)!==null && daysUntil(ct.vig)>=0 && daysUntil(ct.vig)<=30);
  const acceptedBudgets = pres.filter(p=>p.estado==="Aceptado");
  const recurringBudgets = pres.filter(p=>p.recurring);
  const activeCampaigns = campaigns.filter(c=>c.est==="Activa" || c.est==="Planificada");
  return <div className="va">
    <div style={{marginBottom:12}}><span style={{fontSize:12,color:"var(--gr2)"}}>Bienvenido, <b style={{color:"var(--wh)"}}>{user?.name}</b> · <span style={{color:"var(--cy)"}}>{empresa?.nombre}</span></span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Clientes"     value={clis.length}  sub="registrados"      accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Proyectos" value={pros.length}   sub={`${pros.filter(p=>p.est==="En Curso").length} en curso`}/>
      <Stat label="Ingresos"     value={fmtM(ti)}      sub="todos proyectos"  accent="#00e08a"   vc="#00e08a"/>
      <Stat label="Balance"      value={fmtM(ti-tg)}   sub={`gastos: ${fmtM(tg)}`} accent={ti-tg>=0?"#00e08a":"#ff5566"} vc={ti-tg>=0?"#00e08a":"#ff5566"}/>
    </div>
    {(canBudgets || canInvoices || canContracts || canSocial) && <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      {canBudgets
        ? <Stat label="Presupuestos Aceptados" value={acceptedBudgets.length} sub={acceptedBudgets.length?fmtM(acceptedBudgets.reduce((s,p)=>s+Number(p.total||0),0)):"Sin aprobados"} accent="var(--cy)" vc="var(--cy)"/>
        : <Stat label="Producciones" value={pgs.length} sub={`${eps.filter(e=>e.estado==="Publicado").length} episodios publicados`}/>}
      {canInvoices
        ? <Stat label="Proyección Recurrente" value={fmtM(projectedRecurring)} sub={`${facts.filter(f=>f.recurring).length} documentos recurrentes`} accent="#7c5cff" vc="#7c5cff"/>
        : <Stat label="Auspiciadores" value={(auspiciadores||[]).filter(a=>a.empId===empId).length} sub="registros activos" accent="#ffcc44" vc="#ffcc44"/>}
      {canContracts
        ? <Stat label="Contratos por Vencer" value={contractsExpiring.length} sub={contractsExpiring[0]?fmtD(contractsExpiring[0].vig):"sin alertas"} accent="#ffcc44" vc="#ffcc44"/>
        : <Stat label="Activos" value={(activos||[]).filter(a=>a.empId===empId).length} sub="inventario" accent="#00e08a" vc="#00e08a"/>}
      {canSocial
        ? <Stat label="Campañas Activas" value={activeCampaigns.length} sub={activeCampaigns[0]?`${activeCampaigns[0].mes || ""} ${activeCampaigns[0].ano || ""}`:"sin campañas"} accent="#00e08a" vc="#00e08a"/>
        : <Stat label="Facturas Vencidas" value={overdueFacts.length} sub={overdueFacts.length?fmtM(overdueFacts.reduce((s,f)=>s+Number(f.total||0),0)):"sin deuda"} accent="#ff5566" vc="#ff5566"/>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Proyectos Recientes" action={{label:"Ver todos →",fn:()=>navTo("producciones")}}>
        {pros.length>0?<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Nombre</TH><TH>Estado</TH><TH>Balance</TH></tr></thead><tbody>
          {[...pros].reverse().slice(0,5).map(p=>{const b=bal(p.id);return<tr key={p.id} onClick={()=>navTo("pro-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.est}/></TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD></tr>;})}
        </tbody></table>:<Empty text="Sin proyectos"/>}
      </Card>
      <Card title="Episodios Pendientes" action={{label:"Ver producciones →",fn:()=>navTo("programas")}}>
        {eps.filter(e=>["Planificado","En Edición","Programado"].includes(e.estado)).slice(0,5).map(ep=>{const pg=pgs.find(x=>x.id===ep.pgId);return<div key={ep.id} onClick={()=>navTo("ep-det",ep.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--bdr)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600}}>Ep.{ep.num}: {ep.titulo}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{pg?.nom}{ep.fechaGrab?` · ${fmtD(ep.fechaGrab)}`:""}</div></div><Badge label={ep.estado}/></div>;})}
        {!eps.filter(e=>["Planificado","En Edición","Programado"].includes(e.estado)).length&&<Empty text="Sin episodios pendientes"/>}
      </Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Producciones Activas" action={{label:"Ver todas →",fn:()=>navTo("programas")}}>
        {pgs.filter(p=>p.est==="Activo").map(pg=>{const pe=eps.filter(e=>e.pgId===pg.id);const pub=pe.filter(e=>e.estado==="Publicado").length;return<div key={pg.id} onClick={()=>navTo("pg-det",pg.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600}}>{pg.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{pg.tip} · {pub}/{pe.length} ep.</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10,color:"var(--gr2)"}}>Balance</div><div style={{color:bal(pg.id).b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(bal(pg.id).b)}</div></div></div>;})}
        {!pgs.filter(p=>p.est==="Activo").length&&<Empty text="Sin producciones activas"/>}
      </Card>
      <Card title="Auspiciadores Activos">
        {(auspiciadores||[]).filter(a=>a.empId===empId&&a.est==="Activo").slice(0,4).map(a=>{const progs=(a.pids||[]).map(pid=>pgs.find(x=>x.id===pid)).filter(Boolean);return<div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}><div><div style={{fontSize:13,fontWeight:600}}>{a.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{progs.map(p=>p.nom).join(", ")||"Sin programa"}</div></div><div style={{textAlign:"right"}}><Badge label={a.tip} sm/>{a.mon&&<div style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:11,marginTop:3}}>{fmtM(a.mon)}</div>}</div></div>;})}
        {!(auspiciadores||[]).filter(a=>a.empId===empId&&a.est==="Activo").length&&<Empty text="Sin auspiciadores activos"/>}
      </Card>
    </div>
    {(canInvoices || canContracts || canBudgets) && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      {canInvoices && <Card title="Cobranza y Vencimientos" action={{label:"Ver facturación →",fn:()=>navTo("facturacion")}}>
        {overdueFacts.length || payableSoon.length ? [...overdueFacts.slice(0,3), ...payableSoon.filter(f=>!overdueFacts.some(o=>o.id===f.id)).slice(0,3)].map(f=>{
          const ent = invoiceEntityName(f, clientes, auspiciadores);
          const late = f.fechaVencimiento && String(f.fechaVencimiento) < today();
          return <div key={f.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{f.correlativo || f.tipoDoc || "Documento"}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{ent} · {f.fechaVencimiento ? `vence ${fmtD(f.fechaVencimiento)}` : "sin vencimiento"}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"var(--fm)",fontSize:12,color:late?"#ff5566":"#ffcc44"}}>{fmtM(f.total||0)}</div>
              <Badge label={late?"Vencida":"Próxima"} color={late?"red":"yellow"} sm/>
            </div>
          </div>;
        }) : <Empty text="Sin alertas de cobranza"/>}
      </Card>}
      {canContracts && <Card title="Contratos por Vencer" action={{label:"Ver contratos →",fn:()=>navTo("contratos")}}>
        {contractsExpiring.length ? contractsExpiring.slice(0,5).map(ct=>{
          const cli=(clientes||[]).find(x=>x.id===ct.cliId);
          return <div key={ct.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{ct.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{cli?.nom || "Sin cliente"} · {fmtD(ct.vig)}</div>
            </div>
            <Badge label={`${daysUntil(ct.vig)} día${daysUntil(ct.vig)===1?"":"s"}`} color="yellow" sm/>
          </div>;
        }) : <Empty text="Sin contratos por vencer"/>}
      </Card>}
      {canBudgets && <Card title="Pipeline Comercial" action={{label:"Ver presupuestos →",fn:()=>navTo("presupuestos")}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:12}}>
          {[["Aceptados",acceptedBudgets.length,"#00e08a"],["Recurrentes",recurringBudgets.length,"#7c5cff"],["Listos para facturar",pres.filter(p=>p.autoFactura).length,"var(--cy)"]].map(([label,val,color])=><div key={label} style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color}}>{val}</div>
            <div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{label}</div>
          </div>)}
        </div>
        <div style={{fontSize:12,color:"var(--gr2)"}}>Monto aceptado actual: <span style={{fontFamily:"var(--fm)",color:"var(--wh)"}}>{fmtM(acceptedBudgets.reduce((s,p)=>s+Number(p.total||0),0))}</span></div>
      </Card>}
    </div>}
    {/* Alertas en dashboard */}
    {alertas&&alertas.length>0&&<div style={{marginBottom:16}}>
      <Card title="🔔 Próximas Grabaciones" sub={`${alertas.length} fecha${alertas.length!==1?"s":""} próxima${alertas.length!==1?"s":""}`}>
        {alertas.slice(0,5).map(a=>{
          const colores={urgente:"#ff5566",pronto:"#ffcc44",info:"var(--cy)"};
          return <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:colores[a.tipo],flexShrink:0,boxShadow:`0 0 6px ${colores[a.tipo]}`}}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{a.titulo.replace(/^[^:]+:\s/,"")}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{a.sub} · {fmtD(a.fecha)}</div></div>
            <Badge label={a.diff===0?"Hoy":a.diff===1?"Mañana":`${a.diff} días`} color={a.tipo==="urgente"?"red":a.tipo==="pronto"?"yellow":"cyan"} sm/>
          </div>;
        })}
        {alertas.length>5&&<div style={{fontSize:11,color:"var(--gr2)",paddingTop:8,textAlign:"center"}}>+{alertas.length-5} más</div>}
      </Card>
    </div>}
    {/* Addons summary */}
    {empresa?.addons?.length>0&&<div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(empresa.addons.length,3)},1fr)`,gap:16}}>
      {canBudgets&&<Card title="📋 Presupuestos" action={{label:"Ver →",fn:()=>navTo("presupuestos")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["Borrador",(presupuestos||[]).filter(p=>p.empId===empId&&p.estado==="Borrador").length,"gray"],["Aceptado",(presupuestos||[]).filter(p=>p.empId===empId&&p.estado==="Aceptado").length,"green"],["Total",(presupuestos||[]).filter(p=>p.empId===empId).length,"cyan"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="green"?"#00e08a":c==="cyan"?"var(--cy)":"var(--gr2)"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
      {canInvoices&&<Card title="🧾 Facturación" action={{label:"Ver →",fn:()=>navTo("facturacion")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Pendiente",(facturas||[]).filter(p=>p.empId===empId&&p.estado==="Pendiente").length,"yellow"],["Pagada",(facturas||[]).filter(p=>p.empId===empId&&p.estado==="Pagada").length,"green"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="green"?"#00e08a":"#ffcc44"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
      {empresa.addons?.includes("activos")&&<Card title="📦 Activos" action={{label:"Ver →",fn:()=>navTo("activos")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Total",(activos||[]).filter(a=>a.empId===empId).length,"cyan"],["Asignados",(activos||[]).filter(a=>a.empId===empId&&a.asignadoA).length,"green"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="cyan"?"var(--cy)":"#00e08a"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
    </div>}
  </div>;
}

// ── SUPER ADMIN PANEL ─────────────────────────────────────────

// ── SOLICITUDES PANEL ────────────────────────────────────────
function SolicitudesPanel({onAceptar, onRechazar, empresas}){
  const [sols, setSols] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{
    dbGet("produ:solicitudes").then(v=>{ setSols(v||[]); setLoading(false); });
  },[]);
  const pendientes = sols.filter(s=>s.estado==="pendiente");
  if(loading) return <div style={{padding:20,color:"var(--gr2)"}}>Cargando...</div>;
  if(!pendientes.length) return <div style={{padding:20,textAlign:"center",color:"var(--gr2)"}}>
    <div style={{fontSize:32,marginBottom:8}}>✅</div>
    <div style={{fontSize:14}}>Sin solicitudes pendientes</div>
  </div>;
  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>{pendientes.length} solicitud{pendientes.length!==1?"es":""} pendiente{pendientes.length!==1?"s":""}</div>
    {pendientes.map(sol=>(
      <div key={sol.id} style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{sol.nom}</div>
            <div style={{fontSize:12,color:"var(--gr2)"}}>{sol.ema} · {sol.emp}</div>
            <div style={{fontSize:11,color:"var(--gr)",marginTop:4}}>
              {sol.tipo==="empresa"
                ? `Empresa demo · ${sol.customerType||"productora"} · ${fmtD(sol.fecha)}`
                : `Rol: ${sol.rol} · ${fmtD(sol.fecha)}`}
            </div>
            {sol.tel && <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Teléfono: {sol.tel}</div>}
            {sol.teamSize && <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Equipo: {sol.teamSize}</div>}
            {!!(sol.requestedModules||[]).length&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
              {(sol.requestedModules||[]).map(mod=><Badge key={mod} label={ADDONS[mod]?.label||mod} color="gray" sm/>)}
            </div>}
            {sol.msg&&<div style={{fontSize:12,color:"var(--gr3)",marginTop:6,fontStyle:"italic"}}>"{sol.msg}"</div>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <Badge label="Pendiente" color="yellow" sm/>
            {sol.tipo==="empresa"&&<Badge label="Empresa demo" color="cyan" sm/>}
            {sol.referred&&<Badge label="Referido" color="purple" sm/>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {sol.tipo!=="empresa" && <div style={{flex:1,minWidth:120}}>
            <select defaultValue="" style={{width:"100%",padding:"7px 10px",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:12}} id={"emp-"+sol.id}>
              <option value="">Asignar a empresa...</option>
              {(empresas||[]).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>}
          <button onClick={()=>{
            const empId=document.getElementById("emp-"+sol.id)?.value||"";
            onAceptar(sol,empId);
            setSols(p=>p.map(s=>s.id===sol.id?{...s,estado:"aprobada"}:s));
          }} style={{padding:"7px 16px",borderRadius:6,border:"none",background:"#4ade80",color:"#ffffff",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Aceptar</button>
          <button onClick={()=>{onRechazar(sol);setSols(p=>p.map(s=>s.id===sol.id?{...s,estado:"rechazada"}:s));}} style={{padding:"7px 16px",borderRadius:6,border:"1px solid #ff556640",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:700}}>✕ Rechazar</button>
        </div>
      </div>
    ))}
  </div>;
}

const THEME_PRESETS={
  clasico:{
    label:"Produ Clásico",
    description:"La identidad original de Produ, limpia y reconocible.",
    dark:{mode:"dark",bg:"#080809",surface:"#0f0f11",card:"#141416",border:"#1e1e24",accent:"#00d4e8",accent2:"#00b8c8",white:"#f4f4f6",gray:"#7c7c8a",sidebarBg:"#0f172a",sidebarPanel:"#132033",sidebarText:"#e5f5ff",sidebarMuted:"#9fb3c8"},
    light:{mode:"light",bg:"#eef2f7",surface:"#ffffff",card:"#ffffff",border:"#d7dee8",accent:"#00b4cc",accent2:"#0097ad",white:"#0f172a",gray:"#475569",sidebarBg:"#0f172a",sidebarPanel:"#132033",sidebarText:"#e5f5ff",sidebarMuted:"#9fb3c8"},
  },
  editorial:{
    label:"Editorial",
    description:"Más contraste y tono de sala de edición.",
    dark:{mode:"dark",bg:"#0a0a0e",surface:"#101119",card:"#171924",border:"#252838",accent:"#4ade80",accent2:"#16a34a",white:"#f5f7fb",gray:"#94a3b8",sidebarBg:"#1b1020",sidebarPanel:"#28172f",sidebarText:"#f8eefb",sidebarMuted:"#c8b0d1"},
    light:{mode:"light",bg:"#f4f6f8",surface:"#ffffff",card:"#ffffff",border:"#d8dee8",accent:"#15803d",accent2:"#166534",white:"#111827",gray:"#526072",sidebarBg:"#1b1020",sidebarPanel:"#28172f",sidebarText:"#f8eefb",sidebarMuted:"#c8b0d1"},
  },
  corporativo:{
    label:"Corporativo",
    description:"Más sobrio y ejecutivo para clientes e instancias formales.",
    dark:{mode:"dark",bg:"#081018",surface:"#0d1722",card:"#13202f",border:"#213348",accent:"#38bdf8",accent2:"#0284c7",white:"#f3f7fb",gray:"#8ca0b7",sidebarBg:"#10233f",sidebarPanel:"#173155",sidebarText:"#edf5ff",sidebarMuted:"#abc1d9"},
    light:{mode:"light",bg:"#eef4f8",surface:"#ffffff",card:"#ffffff",border:"#d3dfe8",accent:"#0369a1",accent2:"#075985",white:"#0f172a",gray:"#4b5563",sidebarBg:"#10233f",sidebarPanel:"#173155",sidebarText:"#edf5ff",sidebarMuted:"#abc1d9"},
  },
  minimal:{
    label:"Minimal",
    description:"Más neutral, ordenado y con menor ruido visual.",
    dark:{mode:"dark",bg:"#0b0b0c",surface:"#121214",card:"#19191c",border:"#2a2a2f",accent:"#e5e7eb",accent2:"#9ca3af",white:"#fafafa",gray:"#9ca3af",sidebarBg:"#151515",sidebarPanel:"#1d1d1f",sidebarText:"#f5f5f5",sidebarMuted:"#b0b0b4"},
    light:{mode:"light",bg:"#f7f7f8",surface:"#ffffff",card:"#ffffff",border:"#dddddf",accent:"#374151",accent2:"#111827",white:"#111111",gray:"#5b6472",sidebarBg:"#151515",sidebarPanel:"#1d1d1f",sidebarText:"#f5f5f5",sidebarMuted:"#b0b0b4"},
  },
};

function SuperAdminPanel({empresas,users,onSave}){
  const [tab,setTab]=useState(0);
  const [ef,setEf]=useState({});const [eid,setEid]=useState(null);
  const [integrationEmpId,setIntegrationEmpId]=useState("");
  const [commEmpId,setCommEmpId]=useState("");
  const [sysMsg,setSysMsg]=useState({title:"",body:""});
  const [bannerForm,setBannerForm]=useState({active:false,tone:"info",text:""});
  const [q,setQ]=useState("");
  const [planF,setPlanF]=useState("");
  const [stateF,setStateF]=useState("");
  const [portfolioQ,setPortfolioQ]=useState("");
  const [portfolioPlan,setPortfolioPlan]=useState("");
  const [portfolioStatus,setPortfolioStatus]=useState("");
  const [portfolioEmpId,setPortfolioEmpId]=useState("");
  const [uq,setUQ]=useState("");
  const [uRole,setURole]=useState("");
  const [uState,setUState]=useState("");
  const [uEmp,setUEmp]=useState("");
  const totalEmp=(empresas||[]).length;
  const activeEmp=(empresas||[]).filter(e=>e.active!==false).length;
  const proEmp=(empresas||[]).filter(e=>e.plan==="pro"||e.plan==="enterprise").length;
  const totalUsers=(users||[]).filter(u=>u.role!=="superadmin").length;
  const carteraEmp=(empresas||[]).map(emp=>({
    ...emp,
    userCount:(users||[]).filter(u=>u.role!=="superadmin"&&u.empId===emp.id).length,
    grossMonthly:Number(emp.billingMonthly||0),
    discountPct:companyBillingDiscountPct(emp),
    netMonthly:companyBillingNet(emp),
    payStatus:companyBillingStatus(emp),
  }));
  const grossMRR=carteraEmp.reduce((s,emp)=>s+emp.grossMonthly,0);
  const netMRR=carteraEmp.reduce((s,emp)=>s+emp.netMonthly,0);
  const totalDiscountMRR=Math.max(0,grossMRR-netMRR);
  const overdueEmp=carteraEmp.filter(emp=>["Vencido","Mora","Suspendido"].includes(emp.payStatus)).length;
  const filteredEmp=(empresas||[]).filter(emp=>(!q||emp.nombre?.toLowerCase().includes(q.toLowerCase())||emp.rut?.toLowerCase().includes(q.toLowerCase()))&&(!planF||emp.plan===planF)&&(!stateF||(stateF==="Activa"?emp.active!==false:emp.active===false)));
  const filteredPortfolio=carteraEmp.filter(emp=>
    (!portfolioQ || emp.nombre?.toLowerCase().includes(portfolioQ.toLowerCase()) || emp.contractOwner?.toLowerCase().includes(portfolioQ.toLowerCase()) || emp.rut?.toLowerCase().includes(portfolioQ.toLowerCase())) &&
    (!portfolioPlan || emp.plan===portfolioPlan) &&
    (!portfolioStatus || emp.payStatus===portfolioStatus)
  );
  const selectedPortfolioEmp = filteredPortfolio.find(emp=>emp.id===portfolioEmpId) || filteredPortfolio[0] || null;
  const sysUsers=(users||[]).filter(u=>u.role!=="superadmin");
  const filteredUsers=sysUsers.filter(u=>
    (!uq||u.name?.toLowerCase().includes(uq.toLowerCase())||u.email?.toLowerCase().includes(uq.toLowerCase())) &&
    (!uRole||u.role===uRole) &&
    (!uState||(uState==="active"?u.active:u.active===false)) &&
    (!uEmp||u.empId===uEmp)
  );
  const selectedIntegrationEmp = (empresas||[]).find(e=>e.id===integrationEmpId) || (empresas||[])[0] || null;
  const selectedCommEmp = (empresas||[]).find(e=>e.id===commEmpId) || (empresas||[])[0] || null;
  const empLabelById=id=>(empresas||[]).find(e=>e.id===id)?.nombre||"Sin empresa";
  const saveEmp=()=>{
    if(!ef.nombre?.trim()) return;
    const id=eid||`emp_${uid().slice(1,7)}`;
    const prev=empresas.find(e=>e.id===eid)||{};
    const obj={id,tenantCode:prev.tenantCode||nextTenantCode(empresas),nombre:ef.nombre,rut:ef.rut||"",dir:ef.dir||"",tel:ef.tel||"",ema:ef.ema||"",logo:ef.logo||prev.logo||"",color:ef.color||"#00d4e8",addons:ef.addons||[],active:ef.active!==false,plan:ef.plan||"starter",theme:ef.theme||prev.theme||null,googleCalendarEnabled:prev.googleCalendarEnabled===true,migratedTasksAddon:prev.migratedTasksAddon??true,systemMessages:prev.systemMessages||[],systemBanner:prev.systemBanner||{active:false,tone:"info",text:""},billingCurrency:prev.billingCurrency||"UF",billingMonthly:Number(prev.billingMonthly||0),billingDiscountPct:companyBillingDiscountPct(prev),billingDiscountNote:prev.billingDiscountNote||"",billingStatus:prev.billingStatus||"Pendiente",billingDueDay:Number(prev.billingDueDay||0),billingLastPaidAt:prev.billingLastPaidAt||"",contractOwner:prev.contractOwner||"",clientPortalUrl:prev.clientPortalUrl||"",cr:eid?(empresas.find(e=>e.id===eid)?.cr||today()):today()};
    onSave("empresas",eid?empresas.map(e=>e.id===eid?obj:e):[...empresas,obj]);
    setEf({});setEid(null);
  };
  const savePortfolio=(empId, patch={})=>{
    onSave("empresas",(empresas||[]).map(e=>e.id===empId?{
      ...e,
      ...patch,
      billingCurrency:patch.billingCurrency ?? e.billingCurrency ?? "UF",
      billingMonthly:Number(patch.billingMonthly ?? e.billingMonthly ?? 0),
      billingDiscountPct:companyBillingDiscountPct({billingDiscountPct:patch.billingDiscountPct ?? e.billingDiscountPct ?? 0}),
      billingDueDay:Number(patch.billingDueDay ?? e.billingDueDay ?? 0),
    }:e));
  };
  const publishSystemMessage=()=>{
    if(!selectedCommEmp || !sysMsg.title?.trim() || !sysMsg.body?.trim()) return;
    const next=(empresas||[]).map(e=>e.id===selectedCommEmp.id?{...e,systemMessages:[{id:uid(),title:sysMsg.title.trim(),body:sysMsg.body.trim(),createdAt:today()},...(e.systemMessages||[])]}:e);
    onSave("empresas",next);
    setSysMsg({title:"",body:""});
  };
  const saveBanner=()=>{
    if(!selectedCommEmp) return;
    const payload={active:!!bannerForm.active,tone:bannerForm.tone||"info",text:bannerForm.text||"",updatedAt:today()};
    const next=(empresas||[]).map(e=>e.id===selectedCommEmp.id?{...e,systemBanner:payload}:e);
    onSave("empresas",next);
  };
  const removeSystemMessage=(msgId)=>{
    if(!selectedCommEmp) return;
    const next=(empresas||[]).map(e=>e.id===selectedCommEmp.id?{...e,systemMessages:(e.systemMessages||[]).filter(m=>m.id!==msgId)}:e);
    onSave("empresas",next);
  };
  return <div>
    <Tabs tabs={["Empresas","Cartera","Usuarios del sistema","Integraciones","Comunicaciones","Solicitudes"]} active={tab} onChange={setTab}/>
    {tab===0&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Empresas</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"var(--cy)"}}>{totalEmp}</div></div>
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Activas</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"#00e08a"}}>{activeEmp}</div></div>
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Planes Pro+</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"#ffcc44"}}>{proEmp}</div></div>
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Usuarios</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"var(--wh)"}}>{totalUsers}</div></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={q} onChange={setQ} placeholder="Buscar empresa por nombre o RUT..."/>
        <FilterSel value={planF} onChange={setPlanF} options={["starter","pro","enterprise"]} placeholder="Todos los planes"/>
        <FilterSel value={stateF} onChange={setStateF} options={["Activa","Inactiva"]} placeholder="Todos los estados"/>
      </div>
      <div style={{marginBottom:14}}>
        {filteredEmp.map(emp=><div key={emp.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:8}}>
          <div style={{width:34,height:34,borderRadius:8,background:emp.color+"30",border:`2px solid ${emp.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:13,fontWeight:800,color:emp.color,flexShrink:0,overflow:"hidden"}}>
            {emp.logo ? <img src={emp.logo} style={{width:34,height:34,objectFit:"contain",borderRadius:6}} alt={emp.nombre}/> : ini(emp.nombre)}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700}}>{emp.nombre}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{emp.rut||"Sin RUT"} · {emp.ema||"Sin email"} · Tenant ID: {emp.tenantCode||"—"} · ID técnico: {emp.id}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
              {(emp.addons||[]).length?(emp.addons||[]).map(a=><Badge key={a} label={ADDONS[a]?.label||a} color="gray" sm/>):<span style={{fontSize:10,color:"var(--gr2)"}}>Sin addons</span>}
            </div>
          </div>
          <Badge label={emp.active?"Activa":"Inactiva"} color={emp.active?"green":"red"} sm/>
          <Badge label={emp.plan} color="gray" sm/>
          <GBtn sm onClick={()=>{setEid(emp.id);setEf({...emp});}}>✏</GBtn>
          <GBtn sm onClick={()=>onSave("empresas",empresas.map(e=>e.id===emp.id?{...e,active:!e.active}:e))}>{emp.active?"Desactivar":"Activar"}</GBtn>
        </div>)}
        {!filteredEmp.length&&<Empty text="Sin empresas para este filtro"/>}
      </div>
      <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>{eid?"Editar Empresa":"Nueva Empresa"}</div>
          {eid&&<span style={{fontSize:11,color:"var(--gr2)"}}>Tenant ID: {(empresas.find(e=>e.id===eid)?.tenantCode)||"—"} · ID instancia: {eid}</span>}
        </div>
        <R2><FG label="Nombre *"><FI value={ef.nombre||""} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Play Media SpA"/></FG><FG label="RUT"><FI value={ef.rut||""} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG></R2>
        <R2><FG label="Email"><FI value={ef.ema||""} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG><FG label="Plan"><FSl value={ef.plan||"starter"} onChange={e=>setEf(p=>({...p,plan:e.target.value}))}><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></FSl></FG></R2>
        <R2><FG label="Teléfono"><FI value={ef.tel||""} onChange={e=>setEf(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678"/></FG><FG label="Dirección"><FI value={ef.dir||""} onChange={e=>setEf(p=>({...p,dir:e.target.value}))} placeholder="Av. Principal 123, Santiago"/></FG></R2>
        <FG label="Addons activados"><MultiSelect options={Object.entries(ADDONS).map(([v,a])=>({value:v,label:a.icon+" "+a.label}))} value={ef.addons||[]} onChange={v=>setEf(p=>({...p,addons:v}))} placeholder="Seleccionar addons..."/></FG>
        <R2><FG label="Color acento"><FI type="color" value={ef.color||"#00d4e8"} onChange={e=>setEf(p=>({...p,color:e.target.value}))}/></FG><FG label="Estado"><FSl value={ef.active===false?"false":"true"} onChange={e=>setEf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG></R2>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>La creación de empresa genera la instancia principal. Luego los datos operativos se poblarán al primer acceso.</div>
        <div style={{display:"flex",gap:8}}><Btn onClick={saveEmp}>{eid?"Actualizar":"Crear Empresa"}</Btn>{eid&&<GBtn onClick={()=>{setEid(null);setEf({});}}>Cancelar</GBtn>}</div>
      </div>
    </div>}
    {tab===1&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10,marginBottom:16}}>
        <Stat label="Empresas activas" value={activeEmp} sub="Tenants operativos" accent="var(--cy)"/>
        <Stat label="MRR bruto" value={fmtMoney(grossMRR,"UF")} sub="Suma mensual pactada" accent="#00e08a"/>
        <Stat label="Descuentos" value={fmtMoney(totalDiscountMRR,"UF")} sub="Rebajas activas" accent="#ffcc44" vc="#ffcc44"/>
        <Stat label="MRR neto" value={fmtMoney(netMRR,"UF")} sub="Valor mensual Produ" accent="#a855f7" vc="#a855f7"/>
        <Stat label="Con mora" value={overdueEmp} sub="Vencidas o suspendidas" accent="#ff5566" vc="#ff5566"/>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={portfolioQ} onChange={setPortfolioQ} placeholder="Buscar por empresa, RUT o contratado por..."/>
        <FilterSel value={portfolioPlan} onChange={setPortfolioPlan} options={["starter","pro","enterprise"]} placeholder="Todos los planes"/>
        <FilterSel value={portfolioStatus} onChange={setPortfolioStatus} options={["Al día","Pendiente","Vencido","Mora","Suspendido"]} placeholder="Todos los pagos"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:16,alignItems:"start"}}>
        <Card title="Empresas en cartera" sub={`${filteredPortfolio.length} tenant${filteredPortfolio.length===1?"":"s"} visibles`} style={{padding:14}}>
          <div style={{display:"grid",gap:8}}>
            {filteredPortfolio.map(emp=>{
              const isActive = selectedPortfolioEmp?.id===emp.id;
              const status=companyBillingStatus(emp);
              const payColor=status==="Al día"?"green":status==="Pendiente"?"yellow":status==="Suspendido"?"red":"orange";
              return <button key={emp.id} onClick={()=>setPortfolioEmpId(emp.id)} style={{textAlign:"left",padding:"12px 12px",borderRadius:14,border:`1px solid ${isActive?"var(--cy)":"var(--bdr2)"}`,background:isActive?"var(--cg)":"var(--sur)",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:6}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:800,color:isActive?"var(--cy)":"var(--wh)"}}>{emp.nombre}</div>
                    <div style={{fontSize:10,color:"var(--gr2)",marginTop:3}}>{emp.tenantCode||"—"} · {String(emp.plan||"starter").toUpperCase()}</div>
                  </div>
                  <Badge label={status} color={payColor} sm/>
                </div>
                <div style={{fontSize:11,color:"var(--gr2)"}}>{emp.userCount} usuario{emp.userCount===1?"":"s"} · {fmtMoney(companyBillingNet(emp), emp.billingCurrency||"UF")}/mes</div>
              </button>;
            })}
            {!filteredPortfolio.length&&<Empty text="Sin empresas en cartera para este filtro" sub="Ajusta plan, estado de pago o búsqueda."/>}
          </div>
        </Card>
        {selectedPortfolioEmp ? (()=>{const emp=selectedPortfolioEmp;
          const net=companyBillingNet(emp);
          const status=companyBillingStatus(emp);
          const payColor=status==="Al día"?"green":status==="Pendiente"?"yellow":status==="Suspendido"?"red":"orange";
          return <Card key={emp.id} title={emp.nombre} sub={`${emp.tenantCode||"Sin Tenant ID"} · Plan ${emp.plan} · ${emp.userCount} usuario${emp.userCount===1?"":"s"} · ${emp.active!==false?"Tenant activo":"Tenant inactivo"}`} style={{padding:18}}>
            <div style={{display:"grid",gridTemplateColumns:"1.2fr .9fr",gap:16}}>
              <div style={{display:"grid",gap:14}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
                  <div style={{padding:12,border:"1px solid var(--bdr2)",borderRadius:14,background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Plan</div><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>{String(emp.plan||"starter").toUpperCase()}</div></div>
                  <div style={{padding:12,border:"1px solid var(--bdr2)",borderRadius:14,background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Usuarios</div><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>{emp.userCount}</div></div>
                  <div style={{padding:12,border:"1px solid var(--bdr2)",borderRadius:14,background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Valor Produ</div><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,color:"var(--cy)"}}>{fmtMoney(net, emp.billingCurrency||"UF")}</div></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
                  <FG label="Moneda cartera"><FSl value={emp.billingCurrency||"UF"} onChange={e=>savePortfolio(emp.id,{billingCurrency:e.target.value})}><option value="UF">UF</option><option value="CLP">CLP</option><option value="USD">USD</option></FSl></FG>
                  <FG label="Valor mensual pactado"><FI type="number" min="0" step="0.01" value={emp.billingMonthly||0} onChange={e=>savePortfolio(emp.id,{billingMonthly:e.target.value})} placeholder="0"/></FG>
                </div>
                <FG label="Descuento (%)"><FI type="number" min="0" max="100" value={emp.billingDiscountPct||0} onChange={e=>savePortfolio(emp.id,{billingDiscountPct:e.target.value})} placeholder="0"/></FG>
                <R2>
                  <FG label="Contratado por"><FI value={emp.contractOwner||""} onChange={e=>savePortfolio(emp.id,{contractOwner:e.target.value})} placeholder="Nombre del responsable comercial"/></FG>
                  <FG label="Portal cliente"><FI value={emp.clientPortalUrl||""} onChange={e=>savePortfolio(emp.id,{clientPortalUrl:e.target.value})} placeholder="https://cliente.produ.cl/empresa"/></FG>
                </R2>
                <FG label="Descuento / nota comercial"><FI value={emp.billingDiscountNote||""} onChange={e=>savePortfolio(emp.id,{billingDiscountNote:e.target.value})} placeholder="Motivo del descuento, upgrade o acuerdo especial"/></FG>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {(emp.addons||[]).length?(emp.addons||[]).map(a=><Badge key={a} label={ADDONS[a]?.label||a} color="gray" sm/>):<span style={{fontSize:11,color:"var(--gr2)"}}>Sin módulos adicionales</span>}
                </div>
              </div>
              <div style={{display:"grid",gap:14}}>
                <div style={{padding:14,border:"1px solid var(--bdr2)",borderRadius:16,background:"var(--sur)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Estado de pagos</div>
                    <Badge label={status} color={payColor} sm/>
                  </div>
                  <KV label="Tenant ID" value={emp.tenantCode||"—"}/>
                  <KV label="RUT" value={emp.rut||"—"}/>
                  <KV label="Contacto" value={emp.ema||"—"}/>
                  <KV label="Último pago" value={emp.billingLastPaidAt?fmtD(emp.billingLastPaidAt):"Sin registro"}/>
                  <KV label="Frecuencia" value={companyPaymentDayLabel(emp)}/>
                  <KV label="Descuento activo" value={`${companyBillingDiscountPct(emp)}%`}/>
                  <KV label="Moneda cartera" value={emp.billingCurrency||"UF"}/>
                  <KV label="Valor mensual Produ" value={fmtMoney(net, emp.billingCurrency||"UF")}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
                  <FG label="Estado de pago">
                    <FSl value={status} onChange={e=>savePortfolio(emp.id,{billingStatus:e.target.value})}>
                      <option value="Al día">Al día</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="Vencido">Vencido</option>
                      <option value="Mora">Mora</option>
                      <option value="Suspendido">Suspendido</option>
                    </FSl>
                  </FG>
                  <FG label="Día de cobro">
                    <FI type="number" min="1" max="31" value={emp.billingDueDay||""} onChange={e=>savePortfolio(emp.id,{billingDueDay:e.target.value})} placeholder="5"/>
                  </FG>
                </div>
                <R2>
                  <FG label="Último pago"><FI type="date" value={emp.billingLastPaidAt||""} onChange={e=>savePortfolio(emp.id,{billingLastPaidAt:e.target.value})}/></FG>
                  <FG label="Estado tenant"><FSl value={emp.active===false?"false":"true"} onChange={e=>savePortfolio(emp.id,{active:e.target.value==="true"})}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG>
                </R2>
                <div style={{padding:12,borderRadius:14,border:"1px solid var(--bdr2)",background:companyIsUpToDate(emp)?"#00e08a14":"#ffcc4412",color:companyIsUpToDate(emp)?"#00e08a":"#ffcc44",fontSize:12,fontWeight:700}}>
                  {companyIsUpToDate(emp) ? "Tenant al día con Produ." : "Este tenant requiere seguimiento comercial o cobranza."}
                </div>
              </div>
            </div>
          </Card>;
        })() : <Empty text="Selecciona una empresa para revisar su cartera" sub="Haz clic en una empresa de la lista izquierda."/>}
      </div>
    </div>}
    {tab===2&&<div>
      <div style={{fontSize:12,color:"var(--gr3)",marginBottom:12}}>Usuarios del sistema. Cada empresa gestiona sus propios usuarios desde el Panel Admin.</div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={uq} onChange={setUQ} placeholder="Buscar usuario por nombre o email..."/>
        <FilterSel value={uRole} onChange={setURole} options={roleOptions(null, false)} placeholder="Todos los roles"/>
        <FilterSel value={uState} onChange={setUState} options={[{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}]} placeholder="Todos los estados"/>
        <FilterSel value={uEmp} onChange={setUEmp} options={(empresas||[]).map(e=>({value:e.id,label:e.nombre}))} placeholder="Todas las empresas"/>
      </div>
      {filteredUsers.map(u=>{
        const empresa=(empresas||[]).find(e=>e.id===u.empId);
        return <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
        <div style={{width:30,height:30,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600}}>{u.name}</div>
          <div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div>
          <div style={{fontSize:11,color:"var(--gr3)"}}>Empresa: {empresa?.nombre||"Sin empresa"}</div>
        </div>
        <Badge label={getRoleConfig(u.role, (empresas||[]).find(e=>e.id===u.empId)).label} color={getRoleConfig(u.role, (empresas||[]).find(e=>e.id===u.empId)).badge} sm/>
        <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
        <Badge label={userGoogleCalendar(u).connected?"Google conectado":"Sin Google"} color={userGoogleCalendar(u).connected?"cyan":"gray"} sm/>
      </div>;
      })}
      {!filteredUsers.length&&<Empty text="Sin usuarios para este filtro"/>}
    </div>}
    {tab===3&&<div>
      <div style={{fontSize:12,color:"var(--gr3)",marginBottom:14}}>Aquí quedan las bases de integraciones por empresa. Se habilitan o deshabilitan a nivel de instancia, y luego cada integración futura podrá conectarse por usuario cuando exista backend real.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
        <FilterSel value={integrationEmpId} onChange={setIntegrationEmpId} options={(empresas||[]).map(e=>({value:e.id,label:e.nombre}))} placeholder="Selecciona una empresa"/>
      </div>
      {selectedIntegrationEmp ? <div style={{display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:16}}>
        <Card title="Google Calendar" sub={selectedIntegrationEmp.nombre}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            <Badge label={companyGoogleCalendarEnabled(selectedIntegrationEmp)?"Activa":"Desactivada"} color={companyGoogleCalendarEnabled(selectedIntegrationEmp)?"green":"gray"} sm/>
            <Badge label="Base preparada" color="cyan" sm/>
            <Badge label="Conexión futura por usuario" color="purple" sm/>
          </div>
          <div style={{fontSize:12,color:"var(--gr2)",lineHeight:1.6,marginBottom:14}}>
            La integración está modelada para multiempresa y conexión individual por usuario. Mientras no exista OAuth/backend real, mantenerla desactivada evita mostrar opciones incompletas dentro del calendario.
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn onClick={()=>onSave("empresas",(empresas||[]).map(e=>e.id===selectedIntegrationEmp.id?{...e,googleCalendarEnabled:true}:e))} sm>Activar base</Btn>
            <GBtn onClick={()=>onSave("empresas",(empresas||[]).map(e=>e.id===selectedIntegrationEmp.id?{...e,googleCalendarEnabled:false}:e))} sm>Desactivar</GBtn>
          </div>
        </Card>
        <Card title="Estado operativo" sub="Lo que ya queda resuelto en el producto">
          <KV label="Visibilidad en Calendario" value={companyGoogleCalendarEnabled(selectedIntegrationEmp)?"Oculta hasta tener sync real":"Oculta"}/>
          <KV label="Gobierno" value="Super Admin por empresa"/>
          <KV label="Conexión futura" value="Usuario individual"/>
          <KV label="Modelo" value="Multiempresa / multiusuario"/>
        </Card>
      </div> : <Empty text="Selecciona una empresa para administrar integraciones"/>}
    </div>}
    {tab===4&&<div>
      <div style={{fontSize:12,color:"var(--gr3)",marginBottom:14}}>Mensajes visibles para todos los usuarios del tenant y banner global de avisos importantes.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
        <FilterSel value={commEmpId} onChange={v=>{setCommEmpId(v);const emp=(empresas||[]).find(e=>e.id===v)||(empresas||[])[0]||null;setBannerForm(emp?.systemBanner||{active:false,tone:"info",text:""});}} options={(empresas||[]).map(e=>({value:e.id,label:e.nombre}))} placeholder="Selecciona una empresa"/>
      </div>
      {selectedCommEmp ? <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card title="Mensajes del sistema" sub={selectedCommEmp.nombre}>
          <FG label="Título"><FI value={sysMsg.title||""} onChange={e=>setSysMsg(p=>({...p,title:e.target.value}))} placeholder="Mantenimiento programado"/></FG>
          <FG label="Mensaje"><FTA value={sysMsg.body||""} onChange={e=>setSysMsg(p=>({...p,body:e.target.value}))} placeholder="Este es un mensaje visible para todos los usuarios de la empresa."/></FG>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <Btn onClick={publishSystemMessage}>Enviar mensaje</Btn>
          </div>
          <div style={{display:"grid",gap:8}}>
            {(selectedCommEmp.systemMessages||[]).map(msg=><div key={msg.id} style={{padding:12,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700}}>{msg.title}</div>
                  <div style={{fontSize:11,color:"var(--gr3)",marginTop:4,whiteSpace:"pre-line"}}>{msg.body}</div>
                  <div style={{fontSize:10,color:"var(--gr2)",marginTop:6}}>{msg.createdAt?fmtD(msg.createdAt):"—"}</div>
                </div>
                <XBtn onClick={()=>removeSystemMessage(msg.id)}/>
              </div>
            </div>)}
            {!(selectedCommEmp.systemMessages||[]).length&&<Empty text="Sin mensajes del sistema"/>}
          </div>
        </Card>
        <Card title="Banner global" sub="Visible en el portal del tenant">
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)",marginBottom:14}}>
            <input type="checkbox" checked={!!bannerForm.active} onChange={e=>setBannerForm(p=>({...p,active:e.target.checked}))}/>
            Banner activo
          </label>
          <FG label="Tono">
            <FSl value={bannerForm.tone||"info"} onChange={e=>setBannerForm(p=>({...p,tone:e.target.value}))}>
              <option value="info">Info</option>
              <option value="warn">Advertencia</option>
              <option value="critical">Crítico</option>
            </FSl>
          </FG>
          <FG label="Texto del banner"><FTA value={bannerForm.text||""} onChange={e=>setBannerForm(p=>({...p,text:e.target.value}))} placeholder="Información importante para todos los usuarios de esta empresa."/></FG>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <Btn onClick={saveBanner}>Guardar banner</Btn>
            <GBtn onClick={()=>{setBannerForm({active:false,tone:"info",text:""});const next=(empresas||[]).map(e=>e.id===selectedCommEmp.id?{...e,systemBanner:{active:false,tone:"info",text:""}}:e);onSave("empresas",next);}}>Desactivar</GBtn>
          </div>
          <div style={{padding:12,borderRadius:12,border:"1px solid var(--bdr2)",background:bannerForm.tone==="critical"?"#ff556615":bannerForm.tone==="warn"?"#ffcc4415":"var(--cg)",color:bannerForm.tone==="critical"?"#ff5566":bannerForm.tone==="warn"?"#ffcc44":"var(--cy)",fontSize:12,fontWeight:700}}>
            {bannerForm.text||"Vista previa del banner"}
          </div>
        </Card>
      </div> : <Empty text="Selecciona una empresa para comunicarte con ese tenant"/>}
    </div>}
    {tab===5&&<div>
      <SolicitudesPanel empresas={empresas} onAceptar={async(sol,empId)=>{
        const cur=await dbGet("produ:solicitudes")||[];
        if(sol.tipo==="empresa"){
          const liveEmpresas = normalizeEmpresasModel((await dbGet("produ:empresas")) || empresas || []);
          const liveUsers = (await dbGet("produ:users")) || users || [];
          const targetEmpId=sol.empresaId||empId||"";
          if(!targetEmpId){ alert("No se encontró la empresa pendiente para activar."); return; }
          const tempPassword=uid().slice(1,9);
          const alreadyExists=(liveUsers||[]).find(u=>u.email?.toLowerCase()===sol.ema?.toLowerCase()&&u.empId===targetEmpId);
          const nextUsers=alreadyExists
            ? (liveUsers||[]).map(u=>u.id===alreadyExists.id?{...u,name:sol.nom,role:sol.rol||u.role||"admin",active:true,empId:targetEmpId}:u)
            : [...(liveUsers||[]),{id:uid(),name:sol.nom,email:sol.ema,passwordHash:await sha256Hex(tempPassword),role:sol.rol||"admin",empId:targetEmpId,active:true,isCrew:false,crewRole:""}];
          onSave("users",nextUsers);
          const nextEmpresas=liveEmpresas.map(e=>{
            if(e.id===targetEmpId) return {...e,active:true,pendingActivation:false,requestType:"demo"};
            if(sol.referred && e.id===sol.referredByEmpId) return {...e,referralCredits:Number(e.referralCredits||0)+1};
            return e;
          });
          onSave("empresas",nextEmpresas);
          const nextSols=cur.map(s=>s.id===sol.id?{...s,estado:"aprobada",approvedAt:today()}:s);
          await dbSet("produ:solicitudes",nextSols);
          alert("Empresa activada. Email: "+sol.ema+(alreadyExists?"":" / Contrasena temporal: "+tempPassword)+(sol.referred?" / Se acreditó 1 mes de descuento al referido.":""));
          return;
        }
        const tempPassword=uid().slice(1,9);
        const newUser={id:uid(),name:sol.nom,email:sol.ema,passwordHash:await sha256Hex(tempPassword),role:sol.rol||"productor",empId:empId||"",active:true};
        onSave("users",[...(users||[]),newUser]);
        await dbSet("produ:solicitudes",cur.filter(s=>s.id!==sol.id));
        alert("Usuario creado. Email: "+sol.ema+" / Contrasena temporal: "+tempPassword);
      }} onRechazar={async(sol)=>{
        const cur=await dbGet("produ:solicitudes")||[];
        if(sol.tipo==="empresa"){
          onSave("empresas",(empresas||[]).filter(e=>e.id!==sol.empresaId));
          await dbSet("produ:solicitudes",cur.map(s=>s.id===sol.id?{...s,estado:"rechazada",rejectedAt:today()}:s));
          return;
        }
        await dbSet("produ:solicitudes",cur.filter(s=>s.id!==sol.id));
      }}/>
    </div>}
  </div>;
}

// ── SOLICITUDES ADMIN ─────────────────────────────────────────
function SolicitudesAdmin({ users, onSaveUsers }) {
  const [sols, setSols] = useState([]);
  useEffect(()=>{ dbGet("produ:solicitudes").then(v=>setSols(v||[])); },[]);

  const aprobar = async (s) => {
    const pw = prompt("Contraseña temporal para "+s.nombre+":", "produ2024");
    if(!pw) return;
    const newUser = {id:uid(),name:s.nombre,email:s.email,passwordHash:await sha256Hex(pw),role:"productor",empId:"",active:true};
    onSaveUsers([...(users||[]),newUser]);
    const upd = sols.map(x=>x.id===s.id?{...x,estado:"aprobada"}:x);
    setSols(upd);
    await dbSet("produ:solicitudes",upd);
    alert("✓ Usuario creado. Contraseña: "+pw+". Recuerda asignarle una empresa.");
  };

  const rechazar = async (s) => {
    if(!confirm("¿Rechazar solicitud de "+s.nombre+"?")) return;
    const upd = sols.map(x=>x.id===s.id?{...x,estado:"rechazada"}:x);
    setSols(upd);
    await dbSet("produ:solicitudes",upd);
  };

  const pendientes = sols.filter(s=>s.estado==="pendiente");
  const procesadas = sols.filter(s=>s.estado!=="pendiente");

  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>
      {pendientes.length>0?<span style={{color:"#fbbf24",fontWeight:600}}>{pendientes.length} solicitud{pendientes.length!==1?"es":""} pendiente{pendientes.length!==1?"s":""}</span>:"Sin solicitudes pendientes"}
    </div>
    {sols.length===0&&<Empty text="Aún no hay solicitudes de acceso"/>}
    {sols.map(s=>(
      <div key={s.id} style={{background:"var(--sur)",border:`1px solid ${s.estado==="pendiente"?"#fbbf2440":s.estado==="aprobada"?"#4ade8030":"#ff556630"}`,borderRadius:10,padding:16,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700}}>{s.nombre}</div>
            <div style={{fontSize:12,color:"var(--gr2)",marginTop:2}}>✉ {s.email}</div>
            <div style={{fontSize:12,color:"var(--gr2)"}}>🏢 {s.productora}</div>
            {s.mensaje&&<div style={{fontSize:12,color:"var(--gr3)",marginTop:4,fontStyle:"italic"}}>"{s.mensaje}"</div>}
            <div style={{fontSize:11,color:"var(--gr)",marginTop:4}}>Enviada: {s.fecha}</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            <Badge label={s.estado==="pendiente"?"Pendiente":s.estado==="aprobada"?"Aprobada":"Rechazada"} color={s.estado==="aprobada"?"green":s.estado==="rechazada"?"red":"yellow"} sm/>
            {s.estado==="pendiente"&&<>
              <GBtn sm onClick={()=>aprobar(s)}>✓ Aprobar</GBtn>
              <GBtn sm onClick={()=>rechazar(s)}>✕ Rechazar</GBtn>
            </>}
          </div>
        </div>
      </div>
    ))}
  </div>;
}

// ── ADMIN PANEL ───────────────────────────────────────────────

// ── LISTAS EDITOR — administración de desplegables ───────────
function ListasEditor({ listas, saveListas }) {
  const mergeListValues = (base = {}, overrides = {}) => {
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(overrides || {})]);
    const next = {};
    keys.forEach(key => {
      const baseArr = Array.isArray(base?.[key]) ? base[key] : [];
      const overrideArr = Array.isArray(overrides?.[key]) ? overrides[key] : [];
      next[key] = [...new Set([...baseArr, ...overrideArr].filter(v => String(v || "").trim()))];
    });
    return next;
  };
  const L = mergeListValues(DEFAULT_LISTAS, listas || {});
  const [active, setActive] = useState("tiposPro");
  const [newVal, setNewVal] = useState("");

  const GROUPS = [
    { key:"tiposPro",      label:"Tipos de Proyecto" },
    { key:"estadosPro",    label:"Estados de Proyecto" },
    { key:"tiposPg",       label:"Tipos de Producción" },
    { key:"estadosPg",     label:"Estados de Producción" },
    { key:"freqsPg",       label:"Frecuencias de Producción" },
    { key:"estadosEp",     label:"Estados de Episodio" },
    { key:"tiposAus",      label:"Tipos de Auspiciador" },
    { key:"frecPagoAus",   label:"Frecuencias de Pago" },
    { key:"estadosAus",    label:"Estados de Auspiciador" },
    { key:"tiposCt",       label:"Tipos de Contrato" },
    { key:"estadosCt",     label:"Estados de Contrato" },
    { key:"catMov",        label:"Categorías de Movimientos" },
    { key:"industriasCli", label:"Industrias de Clientes" },
    { key:"estadosCamp",   label:"Estados de Campaña" },
    { key:"plataformasContenido", label:"Plataformas de Contenido" },
    { key:"formatosPieza", label:"Formatos de Pieza" },
    { key:"estadosPieza",  label:"Estados de Pieza" },
    { key:"areasCrew",     label:"Áreas de Crew" },
    { key:"rolesCrew",     label:"Roles de Crew" },
    { key:"tiposPres",     label:"Tipos de Presupuesto" },
    { key:"estadosPres",   label:"Estados de Presupuesto" },
    { key:"monedas",       label:"Monedas" },
    { key:"impuestos",     label:"Impuestos" },
    { key:"estadosFact",   label:"Estados de Facturación" },
    { key:"tiposEntidadFact", label:"Tipos de Entidad Factura" },
    { key:"catActivos",    label:"Categorías de Activos" },
    { key:"estadosActivos",label:"Estados de Activos" },
    { key:"prioridadesTarea", label:"Prioridades de Tarea" },
    { key:"estadosTarea",  label:"Estados de Tarea" },
  ];

  const items = L[active] || [];
  const persistLists = next => saveListas(mergeListValues(DEFAULT_LISTAS, next || {}));

  const addItem = () => {
    if (!newVal.trim() || items.includes(newVal.trim())) return;
    persistLists({ ...L, [active]: [...items, newVal.trim()] });
    setNewVal("");
  };

  const delItem = val => {
    persistLists({ ...L, [active]: items.filter(x => x !== val) });
  };

  const moveItem = (val, dir) => {
    const arr = [...items];
    const i = arr.indexOf(val);
    if (dir === -1 && i === 0) return;
    if (dir === 1 && i === arr.length - 1) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    persistLists({ ...L, [active]: arr });
  };

  const resetGroup = () => {
    if (!confirm("¿Restaurar valores por defecto para esta lista?")) return;
    persistLists({ ...L, [active]: DEFAULT_LISTAS[active] });
  };

  return (
    <div>
      <div style={{ fontSize:12,color:"var(--gr2)",marginBottom:16 }}>
        Administra las opciones que aparecen en los formularios. Los cambios se aplican de inmediato.
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"200px 1fr",gap:16,alignItems:"start" }}>
        {/* Selector de lista */}
        <div style={{ background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden" }}>
          {GROUPS.map(g => (
            <div key={g.key} onClick={() => { setActive(g.key); setNewVal(""); }}
              style={{ padding:"11px 14px",cursor:"pointer",fontSize:12,fontWeight:active===g.key?700:400,color:active===g.key?"var(--cy)":"var(--gr3)",background:active===g.key?"var(--cg)":"transparent",borderLeft:active===g.key?"3px solid var(--cy)":"3px solid transparent",borderBottom:"1px solid var(--bdr)" }}>
              {g.label}
              <span style={{ float:"right",background:"var(--bdr2)",borderRadius:20,padding:"1px 7px",fontSize:10,color:"var(--gr2)",fontFamily:"var(--fm)" }}>{(L[g.key]||[]).length}</span>
            </div>
          ))}
        </div>
        {/* Editor de ítems */}
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontFamily:"var(--fh)",fontSize:13,fontWeight:700 }}>{GROUPS.find(g=>g.key===active)?.label}</div>
            <button onClick={resetGroup} style={{ fontSize:11,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"4px 10px",cursor:"pointer" }}>↺ Restaurar defaults</button>
          </div>
          {/* Add new */}
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Agregar nueva opción..." style={{...{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,outline:"none"},flex:1}}/>
            <button onClick={addItem} style={{ padding:"9px 16px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>+ Agregar</button>
          </div>
          {/* Lista de ítems */}
          <div style={{ background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden" }}>
            {items.length > 0 ? items.map((val, i) => (
              <div key={val} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:i<items.length-1?"1px solid var(--bdr)":"none",background:"transparent" }}>
                <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                  <button onClick={()=>moveItem(val,-1)} disabled={i===0} style={{ background:"none",border:"none",color:i===0?"var(--bdr2)":"var(--gr2)",cursor:i===0?"default":"pointer",fontSize:10,padding:0,lineHeight:1 }}>▲</button>
                  <button onClick={()=>moveItem(val,1)} disabled={i===items.length-1} style={{ background:"none",border:"none",color:i===items.length-1?"var(--bdr2)":"var(--gr2)",cursor:i===items.length-1?"default":"pointer",fontSize:10,padding:0,lineHeight:1 }}>▼</button>
                </div>
                <span style={{ flex:1,fontSize:13,color:"var(--wh)" }}>{val}</span>
                <button onClick={()=>delItem(val)} style={{ background:"none",border:"1px solid #ff556625",borderRadius:4,color:"var(--red)",cursor:"pointer",fontSize:10,fontWeight:600,padding:"2px 8px" }}>✕</button>
              </div>
            )) : (
              <div style={{ padding:20,textAlign:"center",color:"var(--gr2)",fontSize:12 }}>Sin opciones. Agrega la primera arriba.</div>
            )}
          </div>
          <div style={{ fontSize:11,color:"var(--gr)",marginTop:8 }}>{items.length} opciones · Los cambios se guardan automáticamente</div>
        </div>
      </div>
    </div>
  );
}


// ── EMPRESA EDIT — editar datos de empresa desde Admin ───────
function EmpresaEdit({ empresa, empresas, saveEmpresas, ntf }) {
  const [ef, setEf] = useState({});
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEf({ nombre: empresa.nombre||"", rut: empresa.rut||"", ema: empresa.ema||"", tel: empresa.tel||"", dir: empresa.dir||"", bankInfo:empresa.bankInfo||"", printColor:companyPrintColor(empresa), plan:empresa.plan||"starter", active:empresa.active!==false, addons:Array.isArray(empresa.addons)?empresa.addons:[], googleCalendarEnabled:companyGoogleCalendarEnabled(empresa) }); }, [empresa.id]);
  const save = () => {
    const updated = { ...empresa, ...ef };
    saveEmpresas((empresas||[]).map(em => em.id === empresa.id ? updated : em));
    ntf("Datos guardados ✓");
    setEditing(false);
  };
  if (!editing) return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--bdr2)", borderRadius:10, padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700 }}>Datos de la Empresa</div>
        <GBtn sm onClick={() => setEditing(true)}>✏ Editar</GBtn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["Nombre", empresa.nombre],["RUT", empresa.rut],["Email", empresa.ema||"—"],["Teléfono", empresa.tel||"—"],["Dirección", empresa.dir||"—"],["Plan", empresa.plan],["Estado", empresa.active!==false?"Activa":"Inactiva"],["Color de impresos", companyPrintColorLabel(empresa)],["Google Calendar", companyGoogleCalendarEnabled(empresa)?"Habilitado por Super Admin":"No habilitado"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </div>
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Información bancaria</div>
        <div style={{background:"var(--card2)",border:"1px solid var(--bdr)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{empresa.bankInfo||"Sin información bancaria configurada"}</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>{(empresa.addons||[]).length?(empresa.addons||[]).map(a=><Badge key={a} label={ADDONS[a]?.label||a} color="gray" sm/>):<span style={{fontSize:11,color:"var(--gr2)"}}>Sin addons activos</span>}</div>
    </div>
  );
  return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--cy)", borderRadius:10, padding:16 }}>
      <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700, marginBottom:14 }}>Editar Datos de la Empresa</div>
      <R2>
        <FG label="Nombre empresa"><FI value={ef.nombre} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Mi Productora SpA"/></FG>
        <FG label="RUT"><FI value={ef.rut} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG>
      </R2>
      <R2>
        <FG label="Email"><FI value={ef.ema} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG>
        <FG label="Teléfono"><FI value={ef.tel} onChange={e=>setEf(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678"/></FG>
      </R2>
      <R2>
        <FG label="Plan"><FSl value={ef.plan||"starter"} onChange={e=>setEf(p=>({...p,plan:e.target.value}))}><option value="starter">starter</option><option value="pro">pro</option><option value="enterprise">enterprise</option></FSl></FG>
        <FG label="Estado"><FSl value={ef.active!==false?"true":"false"} onChange={e=>setEf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG>
      </R2>
      <FG label="Dirección"><FI value={ef.dir} onChange={e=>setEf(p=>({...p,dir:e.target.value}))} placeholder="Av. Principal 123, Santiago"/></FG>
      <FG label="Color de impresos">
        <FSl value={ef.printColor||"#172554"} onChange={e=>setEf(p=>({...p,printColor:e.target.value}))}>
          {PRINT_COLORS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </FSl>
      </FG>
      <FG label="Información bancaria"><FTA value={ef.bankInfo||""} onChange={e=>setEf(p=>({...p,bankInfo:e.target.value}))} placeholder="Banco: BancoEstado&#10;Tipo de cuenta: Cuenta Corriente&#10;N° cuenta: 123456789&#10;RUT: 78.118.348-2&#10;Email pagos: pagos@empresa.cl"/></FG>
      <div style={{marginTop:12}}>
        <div style={{fontSize:11,fontWeight:600,color:"var(--gr3)",marginBottom:8}}>Addons activos</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {Object.entries(ADDONS).map(([key,val])=>{
            const checked=(ef.addons||[]).includes(key);
            return <label key={key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"var(--card)",border:`1px solid ${checked?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,cursor:"pointer"}}>
              <input type="checkbox" checked={checked} onChange={e=>setEf(p=>({...p,addons:e.target.checked?[...(p.addons||[]),key]:(p.addons||[]).filter(x=>x!==key)}))}/>
              <span style={{fontSize:16}}>{val.icon}</span>
              <span style={{fontSize:12,color:"var(--wh)"}}>{val.label}</span>
            </label>;
          })}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <Btn onClick={save}>✓ Guardar</Btn>
        <GBtn onClick={() => setEditing(false)}>Cancelar</GBtn>
      </div>
    </div>
  );
}

function RolesEditor({ empresa, empresas, saveEmpresas, ntf }){
  const [activeKey,setActiveKey]=useState("");
  const [draft,setDraft]=useState({label:"",color:"#7c7c8a",badge:"gray",permissions:[]});
  const customRoles=getCustomRoles(empresa);
  const roleList=[...Object.entries(ROLES).filter(([k])=>k!=="superadmin").map(([key,val])=>({key,base:true,label:val.label,color:val.color,badge:ROLE_COLOR_MAP[key]||"gray",permissions:PERMS[key]||[]})),...customRoles.map(r=>({...r,base:false}))];
  useEffect(()=>{
    const first=roleList[0]?.key||"";
    if(!activeKey && first) setActiveKey(first);
  },[roleList.length]);
  useEffect(()=>{
    const selected=roleList.find(r=>r.key===activeKey);
    if(selected) setDraft({label:selected.label||"",color:selected.color||"#7c7c8a",badge:selected.badge||"gray",permissions:[...(selected.permissions||[])]});
  },[activeKey]);
  const selected=roleList.find(r=>r.key===activeKey);
  const persistRoles=nextCustomRoles=>saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?{...em,customRoles:nextCustomRoles}:em));
  const createRole=()=>{
    const nextRole={key:`custom_${uid().slice(1,7)}`,label:"Nuevo rol",color:"#7c7c8a",badge:"gray",permissions:[]};
    persistRoles([...(customRoles||[]),nextRole]);
    setActiveKey(nextRole.key);
    ntf("Rol creado ✓");
  };
  const saveRole=()=>{
    if(!selected || selected.base || !draft.label?.trim()) return;
    const nextCustomRoles=(customRoles||[]).map(r=>r.key===selected.key?{...r,label:draft.label.trim(),color:draft.color,badge:draft.badge,permissions:[...(draft.permissions||[])]}:r);
    persistRoles(nextCustomRoles);
    ntf("Rol actualizado ✓");
  };
  const deleteRole=()=>{
    if(!selected || selected.base) return;
    if(!confirm("¿Eliminar este rol personalizado?")) return;
    persistRoles((customRoles||[]).filter(r=>r.key!==selected.key));
    setActiveKey(roleList.find(r=>r.key!==selected.key)?.key||"");
    ntf("Rol eliminado","warn");
  };
  const togglePerm=perm=>setDraft(p=>({...p,permissions:p.permissions.includes(perm)?p.permissions.filter(x=>x!==perm):[...p.permissions,perm]}));
  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Crea roles personalizados por empresa y define qué módulos puede usar cada perfil. Los roles base se pueden revisar, pero no eliminar.</div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,alignItems:"start"}}>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,overflow:"hidden"}}>
        {roleList.map(role=><div key={role.key} onClick={()=>setActiveKey(role.key)} style={{padding:"11px 14px",cursor:"pointer",borderBottom:"1px solid var(--bdr)",background:activeKey===role.key?"var(--cg)":"transparent",borderLeft:activeKey===role.key?"3px solid var(--cy)":"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:activeKey===role.key?"var(--cy)":"var(--gr3)"}}>{role.label}</span>
            {role.base?<Badge label="Base" color="gray" sm/>:<Badge label="Custom" color="cyan" sm/>}
          </div>
          <div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{(role.permissions||[]).length} permisos</div>
        </div>)}
        <div style={{padding:12}}><Btn onClick={createRole} sm>+ Nuevo rol</Btn></div>
      </div>
      {selected?<div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:10,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Rol: {selected.label}</div>
          {!selected.base&&<DBtn onClick={deleteRole} sm>Eliminar</DBtn>}
        </div>
        <R3>
          <FG label="Nombre del rol"><FI value={draft.label||""} onChange={e=>setDraft(p=>({...p,label:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Color label"><FI type="color" value={draft.color||"#7c7c8a"} onChange={e=>setDraft(p=>({...p,color:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Badge"><FSl value={draft.badge||"gray"} onChange={e=>setDraft(p=>({...p,badge:e.target.value}))} disabled={selected.base}>{["gray","cyan","green","yellow","red","purple"].map(c=><option key={c} value={c}>{c}</option>)}</FSl></FG>
        </R3>
        <div style={{display:"grid",gap:12,marginTop:8}}>
          {ROLE_PERMISSION_GROUPS.map(group=><div key={group.label} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:10,padding:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.4,marginBottom:10}}>{group.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {group.items.map(([perm,label])=><label key={perm} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--card)",border:`1px solid ${draft.permissions.includes(perm)?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,cursor:selected.base?"default":"pointer",opacity:selected.base?.75:1}}>
                <input type="checkbox" checked={draft.permissions.includes(perm)} disabled={selected.base} onChange={()=>togglePerm(perm)}/>
                <span style={{fontSize:12,color:"var(--wh)"}}>{label}</span>
              </label>)}
            </div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          {!selected.base&&<Btn onClick={saveRole}>Guardar rol</Btn>}
          {selected.base&&<div style={{fontSize:11,color:"var(--gr2)"}}>Los roles base se usan como referencia y no se editan desde aquí.</div>}
        </div>
      </div>:<Empty text="Selecciona un rol para editar"/>}
    </div>
  </div>;
}

function AdminPanel({open,onClose,theme,onSaveTheme,empresa,user,users,empresas,saveUsers,saveEmpresas,listas,saveListas,onPurge,ntf}){
  const [tab,setTab]=useState(0);
  const [lt,setLt]=useState(theme||{});
  const [uf,setUf]=useState({});const [uid2,setUid2]=useState(null);
  const [uq,setUq]=useState("");
  const [uRole,setURole]=useState("");
  const [uState,setUState]=useState("");
  const [refSols,setRefSols]=useState([]);
  useEffect(()=>setLt(theme||{}),[theme]);
  useEffect(()=>{ dbGet("produ:solicitudes").then(v=>setRefSols(v||[])); },[]);
  const empUsers=(users||[]).filter(u=>u.empId===empresa?.id||user?.role==="superadmin");
  const filteredUsers=empUsers.filter(u=>(!uq||u.name?.toLowerCase().includes(uq.toLowerCase())||u.email?.toLowerCase().includes(uq.toLowerCase()))&&(!uRole||u.role===uRole)&&(!uState||(uState==="active"?u.active:u.active===false)));
  const activeUsers=empUsers.filter(u=>u.active!==false).length;
  const inactiveUsers=empUsers.filter(u=>u.active===false).length;
  const referredSols=(refSols||[]).filter(s=>s.referredByEmpId===empresa?.id&&s.tipo==="empresa");
  const referralStatus=(sol)=>{
    const targetEmp=(empresas||[]).find(e=>e.id===sol.empresaId);
    const hasActiveUser=(users||[]).some(u=>u.empId===sol.empresaId&&u.active!==false);
    if(hasActiveUser || targetEmp?.pendingActivation===false) return "Activado";
    if(targetEmp) return "Tenant creado";
    return "Pendiente";
  };
  const resetAccess=async target=>{
    const temp=uid().slice(1,9);
    await saveUsers((users||[]).map(u=>u.id===target.id?{...u,passwordHash:"",password:temp}:u));
    ntf("Acceso temporal generado ✓");
    alert(`Acceso temporal para ${target.email}: ${temp}`);
  };
  const saveUser=async()=>{
    if(!uf.name||!uf.email) return;
    const id=uid2||uid();
    const prev=(users||[]).find(x=>x.id===id);
    const passwordHash = uf.password
      ? await sha256Hex(uf.password)
      : prev?.passwordHash || (prev?.password ? await sha256Hex(prev.password) : "");
    const obj={id,name:uf.name,email:uf.email,passwordHash,role:uf.role||"viewer",empId:empresa?.id||null,active:uf.active!==false,isCrew:uf.isCrew===true,crewRole:uf.isCrew===true?(uf.crewRole||"Crew interno"):""};
    saveUsers(uid2?(users||[]).map(u=>u.id===uid2?obj:u):[...(users||[]),obj]);
    setUf({});setUid2(null);ntf("Usuario guardado");
  };
  return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre||"Sistema"}`} wide>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Usuarios activos</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"var(--cy)"}}>{activeUsers}</div></div>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Usuarios inactivos</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"#ffcc44"}}>{inactiveUsers}</div></div>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Addons activos</div><div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:"#00e08a"}}>{(empresa?.addons||[]).length}</div></div>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Plan</div><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,color:"var(--wh)"}}>{empresa?.plan||"—"}</div></div>
    </div>
    <Tabs tabs={["Colores","Usuarios","Empresa","Listas","Roles y Permisos","Referidos","Datos"]} active={tab} onChange={setTab}/>
    {tab===0&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Selecciona un preset visual curado para tu instancia. Conserva la identidad de Produ y evita combinaciones de color poco legibles.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {Object.entries(THEME_PRESETS).map(([key,preset])=>{
          const swatch=preset[lt.mode||"dark"]||preset.dark;
          const active=(lt.preset||"clasico")===key;
          return <button key={key} onClick={(e)=>{e.stopPropagation();setLt({...swatch,preset:key,mode:lt.mode||"dark"});}} style={{textAlign:"left",padding:"14px 16px",borderRadius:12,border:`1px solid ${active?"var(--cy)":"var(--bdr2)"}`,background:active?"linear-gradient(180deg,var(--cg),transparent)":"var(--sur)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,color:"var(--wh)"}}>{preset.label}</div>
              {active&&<Badge label="Activo" color="cyan" sm/>}
            </div>
            <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10,lineHeight:1.4}}>{preset.description}</div>
            <div style={{display:"flex",gap:8}}>
              {[swatch.bg,swatch.surface,swatch.card,swatch.accent].map(c=><span key={c} style={{width:24,height:24,borderRadius:8,background:c,border:"1px solid var(--bdr2)"}}/>)}
            </div>
          </button>;
        })}
      </div>
      <FG label="Modo visual">
        <FSl value={lt.mode||"dark"} onChange={e=>{
          const mode=e.target.value;
          const presetKey=lt.preset||"clasico";
          const preset=THEME_PRESETS[presetKey]||THEME_PRESETS.clasico;
          setLt({...preset[mode],preset:presetKey,mode});
        }}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </FSl>
      </FG>
      <div style={{fontSize:11,color:"var(--gr2)",marginBottom:14}}>Los presets son fijos para mantener consistencia visual. Si más adelante quieres, podemos sumar nuevos estilos sin reabrir el selector libre de colores.</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={(e)=>{e.stopPropagation();e.preventDefault();onSaveTheme(lt);ntf("Tema aplicado ✓");}} style={{padding:"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Aplicar</button>
        <button onClick={(e)=>{e.stopPropagation();const dt={...THEME_PRESETS.clasico.dark,preset:"clasico",mode:"dark"};setLt(dt);onSaveTheme(dt);ntf("Produ Clásico Dark");}} style={{padding:"9px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>Reset clásico</button>
      </div>
    </div>}
    {tab===1&&<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={uq} onChange={setUq} placeholder="Buscar usuario por nombre o email..."/>
        <FilterSel value={uRole} onChange={setURole} options={roleOptions(empresa)} placeholder="Todos los roles"/>
        <FilterSel value={uState} onChange={setUState} options={[{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}].map(o=>o.label)} placeholder="Todos los estados"/>
      </div>
      <div style={{marginBottom:14}}>
        {filteredUsers.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div></div>
          <Badge label={getRoleConfig(u.role, empresa).label} color={getRoleConfig(u.role, empresa).badge} sm/>
          {u.isCrew&&<Badge label={u.crewRole||"Crew"} color="cyan" sm/>}
          <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
          <Badge label={userGoogleCalendar(u).connected?"Google conectado":"Sin Google"} color={userGoogleCalendar(u).connected?"cyan":"gray"} sm/>
          <GBtn sm onClick={()=>{setUid2(u.id);setUf({...u,password:""});}}>✏</GBtn>
          <GBtn sm onClick={()=>resetAccess(u)}>🔐 Reset</GBtn>
          <GBtn sm onClick={()=>saveUsers((users||[]).map(x=>x.id===u.id?{...x,active:!x.active}:x))}>{u.active?"Desactivar":"Activar"}</GBtn>
          {u.role!=="superadmin"&&<XBtn onClick={()=>{ if(!confirm("¿Eliminar usuario?")) return; saveUsers((users||[]).filter(x=>x.id!==u.id)); }}/>}
        </div>)}
        {!filteredUsers.length&&<Empty text="Sin usuarios para este filtro"/>}
      </div>
        <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>{uid2?"Editar":"Agregar"} Usuario</div>
        <R2><FG label="Nombre"><FI value={uf.name||""} onChange={e=>setUf(p=>({...p,name:e.target.value}))} placeholder="Juan Pérez"/></FG><FG label="Email"><FI type="email" value={uf.email||""} onChange={e=>setUf(p=>({...p,email:e.target.value}))} placeholder="juan@empresa.cl"/></FG></R2>
        <R3><FG label="Contraseña"><FI type="password" value={uf.password||""} onChange={e=>setUf(p=>({...p,password:e.target.value}))} placeholder={uid2?"Nueva contraseña opcional":"Contraseña inicial"}/></FG><FG label="Rol"><FSl value={uf.role||"viewer"} onChange={e=>setUf(p=>({...p,role:e.target.value}))}>{roleOptions(empresa).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FSl></FG><FG label="Estado"><FSl value={uf.active===false?"false":"true"} onChange={e=>setUf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)",paddingTop:10}}>
            <input type="checkbox" checked={uf.isCrew===true} onChange={e=>setUf(p=>({...p,isCrew:e.target.checked,crewRole:e.target.checked?(p.crewRole||"Crew interno"):""}))}/>
            Este usuario pertenece al crew interno
          </label>
          {uf.isCrew===true&&<FG label="Cargo en crew"><FI value={uf.crewRole||""} onChange={e=>setUf(p=>({...p,crewRole:e.target.value}))} placeholder="Ej: Productor Ejecutivo, Editor, Community Manager"/></FG>}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>Puedes dejar la contraseña vacía al editar si no quieres cambiar el acceso.</div>
        <div style={{display:"flex",gap:8}}><Btn onClick={saveUser}>Guardar Usuario</Btn>{uid2&&<GBtn onClick={()=>{setUid2(null);setUf({});}}>Cancelar</GBtn>}</div>
      </div>
    </div>}
    {tab===2&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Configura el logo y datos de tu empresa. El logo aparecerá en los presupuestos PDF.</div>
      {/* Logo Upload */}
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:20,marginBottom:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>Logo de la Empresa</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:80,height:80,borderRadius:12,background:"var(--bdr)",border:"2px dashed var(--bdr2)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {empresa?.logo
              ? <img src={empresa.logo} style={{width:80,height:80,objectFit:"contain",borderRadius:10}} alt="Logo"/>
              : <div style={{textAlign:"center"}}><div style={{fontSize:24,marginBottom:4}}>🏢</div><div style={{fontSize:10,color:"var(--gr2)"}}>Sin logo</div></div>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:"var(--gr3)",marginBottom:10}}>Sube el logo de {empresa?.nombre}. Aparecerá en los presupuestos PDF y en el selector de empresas.</div>
            <div style={{display:"flex",gap:8}}>
              <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>
                📁 Subir logo
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>{
                    const logoData=ev.target.result;
                    const newEmp={...empresa,logo:logoData};
                    saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?newEmp:em));
                    ntf("Logo guardado ✓");
                  };
                  reader.readAsDataURL(file);
                }}/>
              </label>
              {empresa?.logo&&<button onClick={()=>{saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?{...em,logo:""}:em));ntf("Logo eliminado","warn");}} style={{padding:"8px 14px",borderRadius:6,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:600}}>✕ Quitar</button>}
            </div>
            <div style={{fontSize:10,color:"var(--gr2)",marginTop:8}}>Formatos: JPG, PNG, SVG. Tamaño recomendado: 400×400px</div>
          </div>
        </div>
      </div>
      {/* Empresa data editable */}
      {empresa&&<EmpresaEdit empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf}/>}
    </div>}
    {tab===3&&<ListasEditor listas={listas} saveListas={saveListas}/>}
    {tab===4&&<RolesEditor empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf}/>}
    {tab===5&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1.05fr .95fr",gap:16}}>
        <Card title="Programa de referidos" sub="Comparte tu código y acumula meses de descuento">
          <div style={{padding:14,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:14}}>
            <div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Tu código</div>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
              <div style={{fontFamily:"var(--fh)",fontSize:22,fontWeight:800,color:"var(--cy)"}}>{empresa?.referralCode||"—"}</div>
              <GBtn sm onClick={()=>{
                try{navigator.clipboard?.writeText(empresa?.referralCode||""); ntf("Código copiado ✓");}catch{}
              }}>Copiar</GBtn>
            </div>
            <div style={{fontSize:12,color:"var(--gr2)",marginTop:8,lineHeight:1.6}}>Cada empresa activada con tu código suma 1 mes de descuento potencial para tu mensualidad en Produ.</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
            <Stat label="Créditos" value={Number(empresa?.referralCredits||0)} sub="Meses acumulados" accent="var(--cy)"/>
            <Stat label="Referidos" value={referredSols.length} sub="Solicitudes asociadas" accent="#a855f7" vc="#a855f7"/>
            <Stat label="Activados" value={referredSols.filter(sol=>referralStatus(sol)==="Activado").length} sub="Ya operativos" accent="#00e08a" vc="#00e08a"/>
          </div>
        </Card>
        <Card title="Cómo funciona" sub="Simple y visible para tu equipo admin">
          <div style={{display:"grid",gap:10,fontSize:12,color:"var(--gr3)",lineHeight:1.7}}>
            <div>1. Comparte tu código de referido con otra empresa interesada.</div>
            <div>2. Esa empresa solicita su demo desde el login de Produ.</div>
            <div>3. Cuando el Super Admin la activa, se acredita 1 mes de descuento en tu cuenta.</div>
          </div>
        </Card>
      </div>
      <Card title="Seguimiento de referidos" sub="Estado de cada empresa referida" style={{marginTop:16}}>
        <div style={{display:"grid",gap:8}}>
          {referredSols.map(sol=>{
            const status=referralStatus(sol);
            const tone=status==="Activado"?"green":status==="Tenant creado"?"cyan":"yellow";
            return <div key={sol.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700}}>{sol.emp}</div>
                <div style={{fontSize:11,color:"var(--gr2)"}}>{sol.nom} · {sol.ema}</div>
                <div style={{fontSize:11,color:"var(--gr3)",marginTop:4}}>{fmtD(sol.fecha)} · {sol.customerType||"productora"} · {sol.teamSize||"—"}</div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <Badge label="Referido" color="purple" sm/>
                <Badge label={status} color={tone} sm/>
              </div>
            </div>;
          })}
          {!referredSols.length&&<Empty text="Todavía no tienes referidos registrados" sub="Comparte tu código desde esta vista para comenzar a generar descuentos."/>}
        </div>
      </Card>
    </div>}
    {tab===6&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Acciones sobre la base de datos de esta empresa.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <GBtn onClick={()=>{ if(!confirm("¿Restaurar datos demo?")) return; const sd=SEED_DATA(empresa?.id||"emp1"); Object.entries(sd).forEach(([k,v])=>dbSet(`produ:${empresa?.id}:${k}`,v)); ntf("Datos demo restaurados"); onClose(); }}>🔄 Restaurar Demo</GBtn>
        <button onClick={onPurge} style={{padding:"9px 18px",borderRadius:6,border:"1px solid #ff556640",background:"#ff556818",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:700}}>🗑 Eliminar todos los datos</button>
      </div>
    </div>}
  </Modal>;
}

// ── APP ROOT ─────────────────────────────────────────────────
export default function App(){
  const [curUser,setCurUser]=useState(null);
  const [curEmp,setCurEmp]=useState(null);
  const [storedSession,setStoredSession]=useState(null);
  const [view,setView]=useState("dashboard");
  const [detId,setDetId]=useState(null);
  const [toast,setToast]=useState(null);
  const [mOpen,setMOpen]=useState("");
  const [mData,setMData]=useState({});
  const [adminOpen,setAdminOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [isMobile,setIsMobile]=useState(()=>typeof window!=="undefined" ? window.innerWidth<=768 : false);
  const [syncPulse,setSyncPulse]=useState(false);
  const [superPanel,setSuperPanel]=useState(false);
  const [alertasOpen,setAlertasOpen]=useState(false);
  const [alertasLeidas,setAlertasLeidas]=useState([]);
  const [systemOpen,setSystemOpen]=useState(false);
  const [systemLeidas,setSystemLeidas]=useState([]);

  // Global data
  const [empresas,setEmpresasRaw,savEmpRef]=useDB("produ:empresas");
  const [users,setUsersRaw,savUsrRef]=useDB("produ:users");
  const [,setThemeDB]=useDB("produ:theme");

  // Per-empresa data
  const eId=curEmp?.id||"__none__";
  const [listas,setListas,savLst,ldLst]=useDB(`produ:${eId}:listas`);
  const [tareas,setTareas,savTar,ldTar]=useDB(`produ:${eId}:tareas`);
  const L = listas || DEFAULT_LISTAS; // listas activas con fallback a defaults
  const [clientes,setClientes,savCli,ldCli]=useDB(`produ:${eId}:clientes`);
  const [producciones,setProducciones,savPro,ldPro]=useDB(`produ:${eId}:producciones`);
  const [programas,setProgramas,savPg,ldPg]=useDB(`produ:${eId}:programas`);
  const [piezas,setPiezas,savPiezas,ldPiezas]=useDB(`produ:${eId}:piezas`);
  const [episodios,setEpisodios,savEp,ldEp]=useDB(`produ:${eId}:episodios`);
  const [auspiciadores,setAuspiciadores,savAus,ldAus]=useDB(`produ:${eId}:auspiciadores`);
  const [contratos,setContratos,savCt,ldCt]=useDB(`produ:${eId}:contratos`);
  const [movimientos,setMovimientos,savMov,ldMov]=useDB(`produ:${eId}:movimientos`);
  const [crew,setCrew,savCrew,ldCrew]=useDB(`produ:${eId}:crew`);
  const [eventos,setEventos,savEv,ldEv]=useDB(`produ:${eId}:eventos`);
  const [presupuestos,setPresupuestos,savPres,ldPres]=useDB(`produ:${eId}:presupuestos`);
  const [facturas,setFacturas,savFact,ldFact]=useDB(`produ:${eId}:facturas`);
  const [activos,setActivos,savAct,ldAct]=useDB(`produ:${eId}:activos`);
  const empId = curEmp?.id;
  const isLoading = !!curEmp && [ldLst,ldTar,ldCli,ldPro,ldPg,ldPiezas,ldEp,ldAus,ldCt,ldMov,ldCrew,ldEv,ldPres,ldFact,ldAct].some(Boolean);
  const tasksEnabled = hasAddon(curEmp,"tareas");
  const alertas = useAlertas(episodios, programas, eventos||[], tasksEnabled?(tareas||[]):[], facturas||[], contratos||[], empId);

  // Polling
  usePoll(`produ:${eId}:clientes`,setClientes,savCli);
  usePoll(`produ:${eId}:producciones`,setProducciones,savPro);
  usePoll(`produ:${eId}:programas`,setProgramas,savPg);
  usePoll(`produ:${eId}:piezas`,setPiezas,savPiezas);
  usePoll(`produ:${eId}:episodios`,setEpisodios,savEp);
  usePoll(`produ:${eId}:auspiciadores`,setAuspiciadores,savAus);
  usePoll(`produ:${eId}:contratos`,setContratos,savCt);
  usePoll(`produ:${eId}:movimientos`,setMovimientos,savMov);
  usePoll(`produ:${eId}:eventos`,setEventos,savEv);
  usePoll(`produ:${eId}:presupuestos`,setPresupuestos,savPres);
  usePoll(`produ:${eId}:facturas`,setFacturas,savFact);
  usePoll(`produ:${eId}:activos`,setActivos,savAct);
  usePoll(`produ:${eId}:crew`,setCrew,savCrew);
  usePoll(`produ:${eId}:listas`,setListas,savLst);
  usePoll(`produ:${eId}:tareas`,setTareas,savTar);

  // Init global data
  useEffect(()=>{
    dbGet("produ:empresas").then(v=>{
      if(!v){
        const seeded = normalizeEmpresasTenantCodes(SEED_EMPRESAS);
        setEmpresasRaw(seeded);
        dbSet("produ:empresas",seeded);
      }else{
        const normalized = normalizeEmpresasTenantCodes(v);
        setEmpresasRaw(normalized);
        if(JSON.stringify(normalized)!==JSON.stringify(v)) dbSet("produ:empresas",normalized);
      }
    });
    dbGet("produ:users").then(v=>{ if(!v){setUsersRaw(SEED_USERS);dbSet("produ:users",SEED_USERS);}else setUsersRaw(v); });
    applyTheme(THEME_PRESETS.dark);
    try{const s=localStorage.getItem("produ_session");if(s){setStoredSession(JSON.parse(s));}}catch{}
  },[]);

  useEffect(()=>{
    if(!Array.isArray(users) || !users.length) return;
    normalizeUsersAuth(users).then(next=>{
      const changed = JSON.stringify(next) !== JSON.stringify(users);
      if(changed){
        setUsersRaw(next);
        dbSet("produ:users",next);
      }
    });
  },[users]);

  useEffect(()=>{
    if(!storedSession || !Array.isArray(users) || !Array.isArray(empresas)) return;
    const freshUser=(users||[]).find(u=>u.id===storedSession.userId&&u.active);
    if(!freshUser){
      setCurUser(null);setCurEmp(null);
      try{localStorage.removeItem("produ_session");}catch{}
      setStoredSession(null);
      return;
    }
    const sessionEmpId=freshUser.role==="superadmin" ? storedSession.empId : freshUser.empId;
    const freshEmp=sessionEmpId?(empresas||[]).find(e=>e.id===sessionEmpId&&e.active!==false):null;
    setCurUser(freshUser);
    setCurEmp(freshEmp||null);
  },[storedSession,users,empresas]);

  useEffect(()=>{
    if(!curEmp?.id || !curUser?.id){ setSystemLeidas([]); return; }
    try{
      const raw=localStorage.getItem(`produ:sysread:${curEmp.id}:${curUser.id}`);
      setSystemLeidas(raw?JSON.parse(raw):[]);
    }catch{
      setSystemLeidas([]);
    }
  },[curEmp?.id,curUser?.id]);

  useEffect(()=>{
    if(!Array.isArray(empresas) || !empresas.length) return;
    const normalized = normalizeEmpresasModel(empresas);
    if(JSON.stringify(normalized)!==JSON.stringify(empresas)){
      setEmpresasRaw(normalized);
      dbSet("produ:empresas",normalized);
    }
  },[empresas]);

  // Seed per-empresa data
  useEffect(()=>{
    if(!curEmp) return;
    const id=curEmp.id;
    const keys=["clientes","producciones","programas","piezas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas","activos","listas","tareas"];
    const setters={setTareas,setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos};
    keys.forEach(async k=>{
      const v=await dbGet(`produ:${id}:${k}`);
      if(v===null){const seed=SEED_DATA(id)[k]||[];dbSet(`produ:${id}:${k}`,seed);setters[k]?.(seed);}
    });
  },[curEmp?.id]);

  useEffect(()=>{
    if(!curEmp || ldPiezas || !Array.isArray(piezas)) return;
    const normalized = normalizeSocialCampaigns(piezas);
    const changed = JSON.stringify(normalized) !== JSON.stringify(piezas);
    if(changed) setPiezas(normalized);
  },[curEmp?.id,ldPiezas,piezas,setPiezas]);

  useEffect(()=>{
    if(!curEmp?.id || ldCrew) return;
    const scopedUsers=(users||[]).filter(u=>u?.empId===curEmp.id);
    const currentCrew=(crew||[]).filter(c=>c?.empId===curEmp.id);
    const synced=syncCrewWithUsers(scopedUsers,currentCrew);
    if(JSON.stringify(synced)!==JSON.stringify(currentCrew)) setCrew(synced);
  },[curEmp?.id,users,crew,ldCrew,setCrew]);

  useEffect(()=>{
    const onResize=()=>{
      const mobile=window.innerWidth<=768;
      setIsMobile(mobile);
      if(mobile) setCollapsed(false);
    };
    onResize();
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  const DEFAULT_T={...THEME_PRESETS.clasico.dark,preset:"clasico"};
  const [theme,setThemeState]=useState(DEFAULT_T);
  const resolveTheme=(rawTheme,emp)=>{
    const presetKey=rawTheme?.preset||"clasico";
    const mode=rawTheme?.mode||"dark";
    const preset=THEME_PRESETS[presetKey]||THEME_PRESETS.clasico;
    const base=preset[mode]||preset.dark;
    return {...base,...rawTheme,preset:presetKey,mode};
  };
  const applyTheme=t=>{
    const merged=resolveTheme(t,curEmp);
    setThemeState(merged);
    const r=document.documentElement;
    const map={"--bg":merged.bg,"--sur":merged.surface,"--card":merged.card,"--card2":merged.card,"--bdr":merged.border,"--bdr2":merged.border,"--cy":merged.accent,"--cy2":merged.accent2||merged.accent,"--cg":merged.accent+"20","--cm":merged.accent+"40","--wh":merged.white,"--gr":merged.gray,"--gr2":merged.gray,"--gr3":merged.white+"cc","--sidebar-bg":merged.sidebarBg||"#0f172a","--sidebar-panel":merged.sidebarPanel||"#132033","--sidebar-text":merged.sidebarText||"#e5f5ff","--sidebar-muted":merged.sidebarMuted||"#9fb3c8"};
    Object.entries(map).forEach(([k,v])=>r.style.setProperty(k,v));
    document.body.className=merged.mode==="light"?"light":"dark";
  };
  const saveTheme=t=>{
    const next=resolveTheme(t,curEmp);
    applyTheme(next);
    if(curEmp?.id){
      const updated=(empresas||[]).map(e=>e.id===curEmp.id?{...e,theme:next,color:next.accent||e.color}:e);
      setEmpresasRaw(updated);
      dbSet("produ:empresas",updated);
    }else{
      setThemeDB(next);
      dbSet("produ:theme",next);
    }
  };

  useEffect(()=>{
    if(curEmp?.id){
      const freshEmp=(empresas||[]).find(e=>e.id===curEmp.id)||curEmp;
      applyTheme(freshEmp?.theme||DEFAULT_T);
      if(freshEmp!==curEmp) setCurEmp(freshEmp);
      return;
    }
    applyTheme(DEFAULT_T);
  },[curEmp?.id,empresas]);

  const ntf=useCallback((msg,type="ok")=>{setToast({msg,type});setSyncPulse(true);setTimeout(()=>setSyncPulse(false),2000);},[]);
  const openM=(k,d={})=>{setMData(d);setMOpen(k);};
  const closeM=()=>{setMOpen("");setMData({});};
  const navTo=(v,id=null)=>{setView(v);setDetId(id);};

  const login=u=>{
    if(u.role==="superadmin"){
      setCurUser(u);setCurEmp(null);
      try{localStorage.setItem("produ_session",sessionPayload(u,null));}catch{}
      return;
    }
    const emp=(empresas||SEED_EMPRESAS).find(e=>e.id===u.empId);
    setCurUser(u);setCurEmp(emp||null);
    try{localStorage.setItem("produ_session",sessionPayload(u,emp||null));}catch{}
  };
  const logout=()=>{setCurUser(null);setCurEmp(null);try{localStorage.removeItem("produ_session");}catch{}};
  const selectEmp=emp=>{
    if(emp==="__super__"){setSuperPanel(true);return;}
    setCurEmp(emp);
    try{localStorage.setItem("produ_session",sessionPayload(curUser,emp));}catch{}
  };

  // CRUD
  const cSave=async(arr,setArr,item)=>{
    const withEmp=item.empId?item:{...item,empId:curEmp?.id};
    const idx=(arr||[]).findIndex(x=>x.id===withEmp.id);
    const next=idx>=0?(arr||[]).map((x,i)=>i===idx?withEmp:x):[...(arr||[]),{...withEmp,id:withEmp.id||uid(),cr:today()}];
    closeM();ntf("Guardado ✓");await setArr(next);
  };
  const cDel=async(arr,setArr,id,goFn,msg="Eliminado")=>{
    if(!confirm("¿Confirmar eliminación?")) return;
    ntf(msg,"warn");if(goFn)goFn();
    await setArr((arr||[]).filter(x=>x.id!==id));
  };
  const saveMov=async d=>{
    const item={
      ...d,
      id:uid(),
      empId:curEmp?.id,
      mon:Number(d?.mon ?? d?.monto ?? 0),
      des:d?.des ?? d?.desc ?? "",
      fec:d?.fec ?? d?.fecha ?? today(),
    };
    const next=[...(movimientos||[]),item];
    closeM();ntf("Registrado ✓");await setMovimientos(next);
  };
  const delMov=async id=>{await setMovimientos((movimientos||[]).filter(m=>m.id!==id));ntf("Eliminado","warn");};
  const saveFacturaDoc=async fact=>{
    const currentFacts=Array.isArray(facturas)?facturas:[];
    const isNew = !fact.id;
    const recurringEnabled = !!fact.recurring && isNew;
    const recurringMonths = Math.max(1, Number(fact.recMonths || 1));
    const seriesId = fact.seriesId || uid();
    const baseDate = fact.recStart || fact.fechaEmision || today();
    const series = recurringEnabled
      ? Array.from({ length: recurringMonths }, (_, idx) => {
          const fechaEmision = addMonths(baseDate, idx);
          const fechaVencimiento = fact.fechaVencimiento ? addMonths(fact.fechaVencimiento, idx) : "";
          const fechaPago = cobranzaState(fact)==="Pagado" && fact.fechaPago ? addMonths(fact.fechaPago, idx) : cobranzaState(fact)==="Pagado" ? fechaEmision : "";
          return {
            ...fact,
            empId:fact.empId || curEmp?.id,
            id:uid(),
            cr:idx === 0 ? (fact.cr || today()) : today(),
            tipoDoc:"Invoice",
            estado:fact.estado || "Emitida",
            cobranzaEstado:cobranzaState(fact),
            recurring:true,
            recurringStatus:fact.recurringStatus || "Activa",
            recMonths:recurringMonths,
            recStart:baseDate,
            seriesId,
            seriesIndex:idx + 1,
            seriesTotal:recurringMonths,
            fechaEmision,
            fechaVencimiento,
            fechaPago,
            correlativo:fact.correlativo
              ? (recurringMonths > 1 ? `${fact.correlativo}-${String(idx + 1).padStart(2,"0")}` : fact.correlativo)
              : "",
          };
        })
      : [{...fact, empId:fact.empId || curEmp?.id, id:fact.id || uid(), cr:fact.cr || today(), estado:fact.estado || "Emitida", cobranzaEstado:cobranzaState(fact)}];
    const itemsById = new Map(currentFacts.map(x=>[x.id,x]));
    series.forEach(item=>itemsById.set(item.id,item));
    const nextFacts = Array.from(itemsById.values());
    await setFacturas(nextFacts);
    let nextMovs = Array.isArray(movimientos) ? [...movimientos] : [];
    series.forEach(item=>{
      const targetEt=item.tipoRef==="produccion"?"pro":item.tipoRef==="programa"?"pg":item.tipoRef==="contenido"?"pz":"";
      const movement={
        empId:curEmp?.id,
        eid:item.proId||"",
        et:targetEt,
        tipo:"ingreso",
        cat:"Facturación",
        des:`${item.tipoDoc||"Orden de Factura"}${item.correlativo?` ${item.correlativo}`:""}`,
        mon:Number(item.total||0),
        fec:item.fechaPago||item.fechaEmision||today(),
        facturaId:item.id,
      };
      const existing=nextMovs.find(m=>m.facturaId===item.id);
      if(cobranzaState(item)==="Pagado"){
        nextMovs = existing
          ? nextMovs.map(m=>m.facturaId===item.id?{...m,...movement,id:m.id}:m)
          : [...nextMovs,{id:uid(),...movement}];
      } else if(existing){
        nextMovs = nextMovs.filter(m=>m.facturaId!==item.id);
      }
    });
    await setMovimientos(nextMovs);
    closeM();
    ntf(recurringEnabled ? `Serie mensual creada ✓ (${recurringMonths} documento${recurringMonths===1?"":"s"})` : "Documento guardado ✓");
  };

  const saveUsers=async u=>{
    const normalized = await normalizeUsersAuth(u);
    setUsersRaw(normalized);
    dbSet("produ:users",normalized);
    if(curEmp?.id){
      const scopedUsers=normalized.filter(x=>x?.empId===curEmp.id);
      const currentCrew=(crew||[]).filter(c=>c?.empId===curEmp.id);
      const syncedCrew=syncCrewWithUsers(scopedUsers,currentCrew);
      await setCrew(syncedCrew);
    }
  };
  const saveEmpresas=e=>{const normalized=normalizeEmpresasModel(e);setEmpresasRaw(normalized);dbSet("produ:empresas",normalized);};
  const saveSuperData=(key,data)=>{ if(key==="empresas"){saveEmpresas(data);}else if(key==="users"){saveUsers(data);} ntf("Guardado ✓");};

  const ef=arr=>(arr||[]).filter(x=>x.empId===empId);
  const socialCampaigns = normalizeSocialCampaigns(piezas);
  const counts={cli:ef(clientes).length,pro:ef(producciones).length,pg:ef(programas).length,pz:ef(socialCampaigns).length,crew:ef(crew).length,aus:ef(auspiciadores).length,ct:ef(contratos).length,pres:ef(presupuestos).length,fact:ef(facturas).length,act:ef(activos).length,tar:tasksEnabled?(Array.isArray(tareas)?tareas:[]).filter(t=>t&&t.empId===empId&&getAssignedIds(t).includes(curUser?.id)&&t.estado!=="Completada").length:0};

  // Breadcrumb
  const buildBc=()=>{
    const L={dashboard:"DASHBOARD",calendario:"CALENDARIO",clientes:"CLIENTES",producciones:"PROYECTOS",programas:"PRODUCCIONES",contenidos:"CONTENIDOS",crew:"EQUIPO / CREW",auspiciadores:"AUSPICIADORES",contratos:"CONTRATOS",presupuestos:"PRESUPUESTOS",facturacion:"FACTURACIÓN",activos:"ACTIVOS",television:"TELEVISIÓN",social:"CONTENIDOS RRSS"};
    if(view==="cli-det"){const c=(clientes||[]).find(x=>x.id===detId);return [{l:"CLIENTES",fn:()=>navTo("clientes")},{l:c?.nom||"—"}];}
    if(view==="pro-det"){const p=(producciones||[]).find(x=>x.id===detId);return [{l:"PROYECTOS",fn:()=>navTo("producciones")},{l:p?.nom||"—"}];}
    if(view==="pg-det"){const pg=(programas||[]).find(x=>x.id===detId);return [{l:"PRODUCCIONES",fn:()=>navTo("programas")},{l:pg?.nom||"—"}];}
    if(view==="contenido-det"){const pz=socialCampaigns.find(x=>x.id===detId);return [{l:"CONTENIDOS",fn:()=>navTo("contenidos")},{l:pz?.nom||"—"}];}
    if(view==="ep-det"){const ep=(episodios||[]).find(x=>x.id===detId);const pg=(programas||[]).find(x=>x.id===ep?.pgId);return [{l:"PRODUCCIONES",fn:()=>navTo("programas")},{l:pg?.nom||"—",fn:()=>navTo("pg-det",ep?.pgId)},{l:`Ep.${ep?.num}`}];}
    if(view==="pres-det"){const p=(presupuestos||[]).find(x=>x.id===detId);return [{l:"PRESUPUESTOS",fn:()=>navTo("presupuestos")},{l:p?.titulo||"—"}];}
    return [{l:L[view]||view.toUpperCase()}];
  };

  const VP={empresa:curEmp,user:curUser,listas:L,tareas:tareas||[],clientes:clientes||[],producciones:producciones||[],programas:programas||[],piezas:socialCampaigns,episodios:episodios||[],auspiciadores:auspiciadores||[],contratos:contratos||[],movimientos:movimientos||[],crew:crew||[],eventos:eventos||[],presupuestos:presupuestos||[],facturas:facturas||[],activos:activos||[],users:users||SEED_USERS,empresas:empresas||SEED_EMPRESAS,saveUsers,navTo,openM,cSave,cDel,saveMov,delMov,saveFacturaDoc,ntf,theme,canDo:(a)=>canDo(curUser,a,curEmp)};
  const setters={setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos,setTareas};

  const renderView=()=>{
    if(superPanel) return <><div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>Panel Super Admin</div><GBtn onClick={()=>setSuperPanel(false)}>← Volver</GBtn></div><SuperAdminPanel empresas={empresas||[]} users={users||[]} onSave={saveSuperData}/></>;
    if(!canAccessModule(curUser, view, curEmp)) return <Card title="Acceso restringido"><Empty text="Este módulo está disponible solo para perfiles autorizados" sub="Si necesitas verlo, pide acceso al administrador de tu empresa."/></Card>;
    switch(view){
      case"dashboard":    return <ViewDashboard {...VP} alertas={alertas}/>;
    case"tareas":       return <ViewTareas {...VP} saveTareas={async t=>{await setTareas(t);}} cSave={cSave} cDel={cDel} setTareas={setTareas} openM={openM} canDo={canDo}/>;
      case"clientes":     return <ViewClientes     {...VP} setClientes={setClientes}/>;
      case"cli-det":      return <ViewCliDet        {...VP} id={detId} setClientes={setClientes} setContratos={setContratos}/>;
      case"producciones": return <ViewPros          {...VP} setProducciones={setProducciones}/>;
      case"pro-det":      return <ViewProDet        {...VP} id={detId} setProducciones={setProducciones} setMovimientos={setMovimientos} setTareas={setTareas}/>;
      case"programas":    return <ViewPgs           {...VP} setProgramas={setProgramas}/>;
      case"pg-det":       return <ViewPgDet         {...VP} id={detId} setProgramas={setProgramas} setEpisodios={setEpisodios} setMovimientos={setMovimientos} setTareas={setTareas}/>;
      case"contenidos":   return <ViewContenidos    {...VP} setPiezas={setPiezas}/>;
      case"contenido-det":return <ViewContenidoDet  {...VP} id={detId} setPiezas={setPiezas} setMovimientos={setMovimientos} setTareas={setTareas}/>;
      case"ep-det":       return <ViewEpDet         {...VP} id={detId} setEpisodios={setEpisodios} setMovimientos={setMovimientos}/>;
      case"crew":         return <ViewCrew          {...VP} setCrew={setCrew}/>;
      case"calendario":   return <ViewCalendario    {...VP} setEventos={setEventos}/>;
      case"auspiciadores":return <ViewAus           {...VP} setAuspiciadores={setAuspiciadores}/>;
      case"contratos":    return <ViewCts           {...VP} setContratos={setContratos}/>;
      case"presupuestos": return <ViewPres          {...VP} setPresupuestos={setPresupuestos}/>;
      case"pres-det":     return <ViewPresDet       {...VP} id={detId} setPresupuestos={setPresupuestos} setProducciones={setProducciones} setProgramas={setProgramas} setMovimientos={setMovimientos}/>;
      case"facturacion":  return <ViewFact          {...VP} setFacturas={setFacturas} setMovimientos={setMovimientos}/>;
      case"activos":      return <ViewActivos       {...VP} setActivos={setActivos}/>;
      default: return <Empty text="Módulo no disponible"/>;
    }
  };

  // Screens
  if(!empresas||!users) return <div style={{background:"#080809",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#00d4e8",fontFamily:"monospace"}}><StyleTag/>Iniciando Produ...</div>;
  if(!curUser) return <><StyleTag/><Login users={users||SEED_USERS} empresas={empresas||SEED_EMPRESAS} onLogin={login}/></>;
  if(curUser.role==="superadmin"&&!curEmp&&!superPanel) return <><StyleTag/><EmpresaSelector empresas={empresas||SEED_EMPRESAS} onSelect={selectEmp}/></>;

  const closeMobileSidebar=()=>{
    document.querySelector("aside")?.classList.remove("mob-open");
    const overlay=document.getElementById("mob-overlay");
    if(overlay) overlay.style.display="none";
  };
  const openMobileSidebar=()=>{
    setCollapsed(false);
    const sidebar=document.querySelector("aside");
    const overlay=document.getElementById("mob-overlay");
    if(sidebar) sidebar.classList.add("mob-open");
    if(overlay) overlay.style.display="block";
  };
  const sidebarCollapsed=isMobile?false:collapsed;
  const SW=sidebarCollapsed?64:240;
  const bc=buildBc();
  const currentEmpresa=(empresas||[]).find(e=>e.id===curEmp?.id)||curEmp||null;
  const systemMessages=(currentEmpresa?.systemMessages||[]);
  const activeBanner=currentEmpresa?.systemBanner?.active && currentEmpresa?.systemBanner?.text ? currentEmpresa.systemBanner : null;
  const unreadSystemCount=systemMessages.filter(m=>!systemLeidas.includes(m.id)).length;
  const markSystemRead=id=>setSystemLeidas(prev=>{
    const next=prev.includes(id)?prev:[...prev,id];
    try{localStorage.setItem(`produ:sysread:${curEmp?.id}:${curUser?.id}`,JSON.stringify(next));}catch{}
    return next;
  });
  const markAllSystemRead=()=>{
    const next=systemMessages.map(m=>m.id);
    setSystemLeidas(next);
    try{localStorage.setItem(`produ:sysread:${curEmp?.id}:${curUser?.id}`,JSON.stringify(next));}catch{}
  };

  return <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
    <StyleTag/>
    {/* Mobile overlay */}
    <div id="mob-overlay" onClick={closeMobileSidebar} style={{display:"none",position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,.6)"}}/>
    <Sidebar user={curUser} empresa={curEmp} view={superPanel?"__super__":view} onNav={v=>{setSuperPanel(false);navTo(v);closeMobileSidebar();}} onAdmin={()=>{setAdminOpen(true);closeMobileSidebar();}} onLogout={logout} onChangeEmp={curUser.role==="superadmin"?()=>{setCurEmp(null);setSuperPanel(false);closeMobileSidebar();}:null} counts={counts} collapsed={sidebarCollapsed} onToggle={()=>{if(isMobile) closeMobileSidebar(); else setCollapsed(v=>!v);}} syncPulse={syncPulse} isMobile={isMobile}/>
    <main className="app-main" style={{marginLeft:SW,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",transition:"margin-left .2s",background:"var(--bg)",overflowX:"hidden",overflowY:"auto"}}>
      {/* Topbar */}
      <div className="topbar" style={{height:64,background:"transparent",display:"flex",alignItems:"center",padding:"0 26px",gap:10,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        {/* Hamburger - solo visible en móvil via CSS */}
        <button className="ham-btn" onClick={openMobileSidebar} style={{display:"none",background:"none",border:"none",color:"var(--wh)",cursor:"pointer",fontSize:22,padding:"4px 6px",flexShrink:0,alignItems:"center",lineHeight:1}}>☰</button>
        <div className="app-breadcrumbs" style={{display:"flex",alignItems:"center",gap:8,flex:1,overflow:"hidden"}}>
          {bc.map((b,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            {i>0&&<span style={{color:"var(--bdr2)",fontSize:16}}>/</span>}
            <span onClick={b.fn} style={{fontFamily:"var(--fh)",fontWeight:700,fontSize:i===bc.length-1?15:11,letterSpacing:i===bc.length-1?1:2,textTransform:"uppercase",color:b.fn?"var(--gr2)":"var(--wh)",cursor:b.fn?"pointer":"default",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",}} onMouseEnter={e=>{if(b.fn)e.target.style.color="var(--cy)";}} onMouseLeave={e=>{if(b.fn)e.target.style.color="var(--gr2)";}}>{b.l}</span>
          </span>)}
        </div>
        <div className="app-actions" style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
    {(view==="pro-det"||view==="pg-det"||view==="contenido-det")&&canDo(curUser,"movimientos",curEmp)&&<Btn onClick={()=>openM("mov",{eid:detId,et:view==="pro-det"?"pro":view==="pg-det"?"pg":"pz"})} sm>+ Movimiento</Btn>}
          {view==="ep-det"&&canDo(curUser,"movimientos",curEmp)&&<Btn onClick={()=>openM("mov",{eid:detId,et:"ep",tipo:"gasto"})} sm>+ Gasto</Btn>}
          {curEmp&&<button onClick={()=>{setSystemOpen(!systemOpen);setAlertasOpen(false);}} style={{position:"relative",background:systemOpen?"var(--cg)":"var(--sur)",border:`1px solid ${systemOpen?"var(--cy)":"var(--bdr2)"}`,borderRadius:10,padding:"7px 12px",cursor:"pointer",color:systemOpen?"var(--cy)":"var(--gr3)",fontSize:13,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
            <span style={{fontSize:16}}>💬</span>
            <span>Mensajes</span>
            {unreadSystemCount>0&&<span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"var(--cy)",fontSize:9,fontWeight:700,color:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadSystemCount}</span>}
          </button>}
          {curEmp&&<button onClick={()=>setAlertasOpen(!alertasOpen)} style={{position:"relative",background:alertasOpen?"var(--cg)":"var(--sur)",border:`1px solid ${alertasOpen?"var(--cy)":"var(--bdr2)"}`,borderRadius:10,padding:"7px 12px",cursor:"pointer",color:alertasOpen?"var(--cy)":"var(--gr3)",fontSize:13,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
            <span style={{fontSize:16}}>🔔</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
              Alertas
              {alertas.filter(a=>a.tipo==="urgente"&&!alertasLeidas.includes(a.id)).length>0&&<span style={{fontSize:10,color:"#ff5566"}}>Urgente</span>}
            </span>
            {alertas.filter(a=>!alertasLeidas.includes(a.id)).length>0&&<span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ff5566",fontSize:9,fontWeight:700,color:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center"}}>{alertas.filter(a=>!alertasLeidas.includes(a.id)).length}</span>}
          </button>}
        </div>
      </div>
      <div className="app-page" style={{flex:1,padding:"18px 26px 28px"}}>
        {activeBanner&&<div style={{marginBottom:14,padding:"12px 16px",borderRadius:14,border:`1px solid ${activeBanner.tone==="critical"?"#ff556640":activeBanner.tone==="warn"?"#ffcc4440":"var(--cm)"}`,background:activeBanner.tone==="critical"?"#ff556615":activeBanner.tone==="warn"?"#ffcc4415":"var(--cg)",color:activeBanner.tone==="critical"?"#ff5566":activeBanner.tone==="warn"?"#ffcc44":"var(--cy)",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>{activeBanner.tone==="critical"?"⛔":activeBanner.tone==="warn"?"⚠️":"ℹ️"}</span>
          <span style={{whiteSpace:"pre-line"}}>{activeBanner.text}</span>
        </div>}
        <div className="va" key={view+detId+superPanel}>
          {isLoading ? <LoadingScreen/> : renderView()}
        </div>
      </div>
    </main>
    {alertasOpen&&<AlertasPanel alertas={alertas} leidas={alertasLeidas} onMarcar={id=>setAlertasLeidas(p=>[...p,id])} onMarcarTodas={()=>setAlertasLeidas(alertas.map(a=>a.id))} onClose={()=>setAlertasOpen(false)}/> }
    {systemOpen&&<SystemMessagesPanel empresa={currentEmpresa} mensajes={systemMessages} leidas={systemLeidas} onMarcar={markSystemRead} onMarcarTodas={markAllSystemRead} onClose={()=>setSystemOpen(false)}/>}
        {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    {mOpen&&<ModalRouter mOpen={mOpen} mData={mData} closeM={closeM} VP={VP} setters={setters} saveTheme={saveTheme} saveUsers={saveUsers} saveEmpresas={saveEmpresas} ntf={ntf} cSave={cSave} saveMov={saveMov} saveFacturaDoc={saveFacturaDoc}/>}
    {adminOpen&&<AdminPanel open={adminOpen} onClose={()=>setAdminOpen(false)} theme={theme} onSaveTheme={saveTheme} empresa={curEmp} user={curUser} users={users||[]} empresas={empresas||[]} saveUsers={saveUsers} saveEmpresas={saveEmpresas} listas={L} saveListas={async nl=>{await setListas(nl);ntf("Listas guardadas");}} onPurge={()=>{if(!confirm("¿Eliminar TODOS los datos de esta empresa?")) return; ["clientes","producciones","programas","piezas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas","activos"].forEach(k=>dbSet(`produ:${empId}:${k}`,[]));ntf("Datos eliminados","warn");setAdminOpen(false);}} ntf={ntf}/>}
  </div>;
}

// ── HELPERS COMPARTIDOS ─────────────────────────────────────
function MovBlock({movimientos,tipo,eid,etype,onAdd,onDel,canEdit}){
  const lbl={ingreso:"Ingresos",gasto:"Gastos / Egresos",caja:"Movimientos de Caja"}[tipo];
  const items=(movimientos||[]).filter(m=>m.tipo===tipo&&m.eid===eid);
  const total=items.reduce((s,m)=>s+Number(m.mon),0);
  const mc=tipo==="ingreso"?"#00e08a":tipo==="gasto"?"#ff5566":"var(--wh)";
  const [pg,setPg]=useState(1);const PP=8;
  return <Card title={lbl} sub={`Total: `} action={canEdit?{label:"+ Agregar",fn:()=>onAdd(eid,etype,tipo)}:null}>
    <div style={{fontSize:11,color:"var(--gr2)",marginTop:-10,marginBottom:12}}>Total: <span style={{color:mc,fontFamily:"var(--fm)"}}>{fmtM(total)}</span></div>
    {items.length>0?<><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><TH>Descripción</TH><TH>Categoría</TH><TH>Fecha</TH><TH>Monto</TH>{canEdit&&<TH></TH>}</tr></thead>
      <tbody>{items.slice((pg-1)*PP,pg*PP).map(m=><tr key={m.id}>
        <TD bold>{m.des}</TD>
        <TD><Badge label={m.cat||"General"} color="gray" sm/></TD>
        <TD mono style={{fontSize:11}}>{m.fec?fmtD(m.fec):"—"}</TD>
        <TD style={{color:mc,fontFamily:"var(--fm)",fontSize:12}}>{fmtM(m.mon)}</TD>
        {canEdit&&<TD><XBtn onClick={()=>onDel(m.id)}/></TD>}
      </tr>)}</tbody>
    </table></div><Paginator page={pg} total={items.length} perPage={PP} onChange={setPg}/></>
    :<Empty text={`Sin ${lbl.toLowerCase()}`} sub={canEdit?'Clic en "+ Agregar" para comenzar':""}/>}
  </Card>;
}

function MiniCal({refId,eventos,onAdd,onDel,onEdit,canEdit,titulo}){
  const propios=(eventos||[]).filter(e=>e.ref===refId);
  const [pg,setPg]=useState(1);const PP=8;
  const sorted=[...propios].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
  const TIPOS=[{v:"grabacion",ico:"🎬",lbl:"Grabación",c:"var(--cy)"},{v:"emision",ico:"📡",lbl:"Emisión",c:"#00e08a"},{v:"reunion",ico:"💬",lbl:"Reunión",c:"#ffcc44"},{v:"entrega",ico:"✓",lbl:"Entrega",c:"#ff8844"},{v:"otro",ico:"📌",lbl:"Otro",c:"#7c7c8a"}];
  const tc=v=>TIPOS.find(t=>t.v===v)?.c||"#7c7c8a";
  const ti=v=>TIPOS.find(t=>t.v===v)?.ico||"📌";
  const tl=v=>TIPOS.find(t=>t.v===v)?.lbl||v;
  return <Card title={`📅 Fechas — ${titulo||""}`} action={canEdit?{label:"+ Evento",fn:onAdd}:null}>
    {sorted.length>0?<><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><TH>Tipo</TH><TH>Título</TH><TH>Fecha</TH><TH>Hora</TH><TH>Descripción</TH>{canEdit&&<TH></TH>}</tr></thead>
      <tbody>{sorted.slice((pg-1)*PP,pg*PP).map(ev=><tr key={ev.id}>
        <TD><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:tc(ev.tipo)+"22",color:tc(ev.tipo),border:`1px solid ${tc(ev.tipo)}40`}}>{ti(ev.tipo)} {tl(ev.tipo)}</span></TD>
        <TD bold>{ev.titulo}</TD>
        <TD mono style={{fontSize:11}}>{ev.fecha?fmtD(ev.fecha):"—"}</TD>
        <TD style={{fontSize:12,color:"var(--gr2)"}}>{ev.hora||"—"}</TD>
        <TD style={{fontSize:12,color:"var(--gr3)",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.desc||"—"}</TD>
        {canEdit&&<TD><div style={{display:"flex",gap:4}}>{onEdit&&<GBtn sm onClick={()=>onEdit(ev)}>✏</GBtn>}<XBtn onClick={()=>onDel(ev.id)}/></div></TD>}
      </tr>)}</tbody>
    </table></div><Paginator page={pg} total={sorted.length} perPage={PP} onChange={setPg}/></>
    :<Empty text="Sin fechas registradas" sub={canEdit?"Agrega el primer evento con el botón arriba":""}/>}
  </Card>;
}

// ── MODALES DE FORMULARIO ─────────────────────────────────────

function MCli({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",rut:"",ind:"",dir:"",not:"",contactos:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const addContact=()=>setF(p=>({...p,contactos:[...(p.contactos||[]),{id:uid(),nom:"",car:"",ema:"",tel:"",not:""}]}));
  const updContact=(i,k,v)=>setF(p=>({...p,contactos:(p.contactos||[]).map((c,j)=>j===i?{...c,[k]:v}:c)}));
  const delContact=i=>setF(p=>({...p,contactos:(p.contactos||[]).filter((_,j)=>j!==i)}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Cliente":"Nuevo Cliente"} sub="Empresa o persona" wide>
    <R2><FG label="Nombre / Razón Social *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Empresa ABC S.A."/></FG><FG label="RUT"><FI value={f.rut||""} onChange={e=>u("rut",e.target.value)} placeholder="76.543.210-0"/></FG></R2>
    <R2><FG label="Industria"><FSl value={f.ind||""} onChange={e=>u("ind",e.target.value)}><option value="">Seleccionar...</option>{(listas?.industriasCli||DEFAULT_LISTAS.industriasCli).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Dirección"><FI value={f.dir||""} onChange={e=>u("dir",e.target.value)} placeholder="Av. Providencia 123"/></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Observaciones generales..."/></FG>
    <Sep/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Contactos</div>
      <GBtn sm onClick={addContact}>+ Agregar Contacto</GBtn>
    </div>
    {(f.contactos||[]).map((c,i)=><div key={c.id} style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,padding:12,marginBottom:10,position:"relative"}}>
      <div style={{position:"absolute",top:8,right:8}}><XBtn onClick={()=>delContact(i)}/></div>
      <R2><FG label="Nombre"><FI value={c.nom||""} onChange={e=>updContact(i,"nom",e.target.value)} placeholder="Juan Pérez"/></FG><FG label="Cargo"><FI value={c.car||""} onChange={e=>updContact(i,"car",e.target.value)} placeholder="Gerente Marketing"/></FG></R2>
      <R2><FG label="Email"><FI type="email" value={c.ema||""} onChange={e=>updContact(i,"ema",e.target.value)} placeholder="juan@empresa.cl"/></FG><FG label="Teléfono"><FI value={c.tel||""} onChange={e=>updContact(i,"tel",e.target.value)} placeholder="+56 9 1234 5678"/></FG></R2>
      <FG label="Observaciones"><FI value={c.not||""} onChange={e=>updContact(i,"not",e.target.value)} placeholder="Notas sobre este contacto..."/></FG>
    </div>)}
    {!(f.contactos||[]).length&&<div style={{textAlign:"center",padding:"14px",color:"var(--gr2)",fontSize:12,border:"1px dashed var(--bdr2)",borderRadius:8,marginBottom:14}}>Sin contactos. Haz clic en "+ Agregar Contacto"</div>}
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MPro({open,data,clientes,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",cliId:data?.cliId||"",tip:"Podcast",est:"Pre-Producción",ini:"",fin:"",des:"",crewIds:[],comentarios:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Proyecto":"Nuevo Proyecto"} sub="Proyecto audiovisual">
    <FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre del proyecto"/></FG>
    <R2><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposPro||DEFAULT_LISTAS.tiposPro).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{(listas?.estadosPro||DEFAULT_LISTAS.estadosPro).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Fecha Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG><FG label="Fecha Entrega"><FI type="date" value={f.fin||""} onChange={e=>u("fin",e.target.value)}/></FG></R2>
    <FG label="Descripción"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="Descripción del proyecto..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MPg({open,data,clientes,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",tip:"Producción",can:"",est:"Activo",totalEp:"",fre:"Semanal",temporada:"",conductor:"",prodEjec:"",des:"",cliId:"",crewIds:[],comentarios:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Producción":"Nueva Producción"} sub="TV, Podcast, Web Series…" wide>
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre de la producción"/></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposPg||DEFAULT_LISTAS.tiposPg).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Canal / Plataforma"><FI value={f.can||""} onChange={e=>u("can",e.target.value)} placeholder="Canal 13, Spotify..."/></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{(listas?.estadosPg||DEFAULT_LISTAS.estadosPg).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3><FG label="Total Episodios"><FI type="number" value={f.totalEp||""} onChange={e=>u("totalEp",Number(e.target.value))} placeholder="24"/></FG><FG label="Frecuencia"><FSl value={f.fre||""} onChange={e=>u("fre",e.target.value)}>{(listas?.freqsPg||DEFAULT_LISTAS.freqsPg).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Temporada"><FI value={f.temporada||""} onChange={e=>u("temporada",e.target.value)} placeholder="T1 2025"/></FG></R3>
    <R2><FG label="Conductor / Host"><FI value={f.conductor||""} onChange={e=>u("conductor",e.target.value)} placeholder="Nombre del conductor"/></FG><FG label="Productor Ejecutivo"><FI value={f.prodEjec||""} onChange={e=>u("prodEjec",e.target.value)} placeholder="Nombre del productor"/></FG></R2>
    <FG label="Cliente asociado (opcional)"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <FG label="Descripción"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="De qué trata el programa..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MCampanaContenido({open,data,clientes,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?normalizeSocialCampaign(data):{nom:"",cliId:"",plataforma:"Instagram",mes:MESES[new Date().getMonth()],ano:new Date().getFullYear(),est:"Planificada",ini:today(),fin:"",des:"",crewIds:[],comentarios:[],plannedPieces:1,piezas:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Campaña":"Nueva Campaña"} sub="Contenidos para redes sociales" wide>
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre de la campaña"/></FG><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG></R2>
    <R3><FG label="Plataforma principal"><FSl value={f.plataforma||"Instagram"} onChange={e=>u("plataforma",e.target.value)}>{(listas?.plataformasContenido||DEFAULT_LISTAS.plataformasContenido).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Estado"><FSl value={f.est||"Planificada"} onChange={e=>u("est",e.target.value)}>{(listas?.estadosCamp||DEFAULT_LISTAS.estadosCamp).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Piezas mensuales"><FSl value={String(f.plannedPieces ?? 1)} onChange={e=>u("plannedPieces",Number(e.target.value))}>{Array.from({length:200},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</FSl></FG></R3>
    <R2><FG label="Mes"><FSl value={f.mes||MESES[new Date().getMonth()]} onChange={e=>u("mes",e.target.value)}>{MESES.map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Año"><FI type="number" value={f.ano||new Date().getFullYear()} onChange={e=>u("ano",Number(e.target.value))} min="2024"/></FG></R2>
    <R2><FG label="Fecha Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG><FG label="Fecha Cierre"><FI type="date" value={f.fin||""} onChange={e=>u("fin",e.target.value)}/></FG></R2>
    <FG label="Descripción"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="Objetivo, tono, entregables, alcance mensual..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(normalizeSocialCampaign(f));}}/>
  </Modal>;
}

function MPiezaContenido({open,data,listas,crewOptions,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?normalizeSocialPiece(data):normalizeSocialPiece({id:uid(),nom:"",formato:"Reel",plataforma:data?.plataforma||"Instagram",est:"Planificado",ini:data?.ini||today(),fin:"",des:"",link:"",comentarios:[]},data||{}));},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Pieza":"Nueva Pieza"} sub="Pieza dentro de una campaña" wide>
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre de la pieza"/></FG><FG label="Estado"><FSl value={f.est||"Planificado"} onChange={e=>u("est",e.target.value)}>{(listas?.estadosPieza||DEFAULT_LISTAS.estadosPieza).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3><FG label="Formato"><FSl value={f.formato||"Reel"} onChange={e=>u("formato",e.target.value)}>{(listas?.formatosPieza||DEFAULT_LISTAS.formatosPieza).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Plataforma"><FSl value={f.plataforma||"Instagram"} onChange={e=>u("plataforma",e.target.value)}>{(listas?.plataformasContenido||DEFAULT_LISTAS.plataformasContenido).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Responsable"><FSl value={f.responsableId||""} onChange={e=>u("responsableId",e.target.value)}><option value="">— Sin responsable —</option>{(crewOptions||[]).map(member=><option key={member.id} value={member.id}>{member.nom} · {member.rol||"Crew"}</option>)}</FSl></FG></R3>
    <R3><FG label="Fecha Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG><FG label="Fecha Entrega"><FI type="date" value={f.fin||""} onChange={e=>u("fin",e.target.value)}/></FG><FG label="Fecha de Publicación"><FI type="date" value={f.publishDate||""} onChange={e=>u("publishDate",e.target.value)}/></FG></R3>
    <R2><FG label="Estado de aprobación"><FSl value={f.approval||"Pendiente"} onChange={e=>u("approval",e.target.value)}><option>Pendiente</option><option>En revisión</option><option>Aprobada</option><option>Observada</option></FSl></FG><FG label="Fecha de publicación real"><FI type="date" value={f.publishedAt||""} onChange={e=>u("publishedAt",e.target.value)}/></FG></R2>
    <R2><FG label="Enlace de trabajo"><FI value={f.link||""} onChange={e=>u("link",e.target.value)} placeholder="https://drive.google.com/..."/></FG><FG label="Versión final / Link final"><FI value={f.finalLink||""} onChange={e=>u("finalLink",e.target.value)} placeholder="https://instagram.com/... o drive final"/></FG></R2>
    <FG label="Brief de la pieza"><FTA value={f.brief||""} onChange={e=>u("brief",e.target.value)} placeholder="Qué se necesita, foco, tono, referencias y criterios del cliente."/></FG>
    <R2><FG label="Objetivo de la pieza"><FI value={f.objetivo||""} onChange={e=>u("objetivo",e.target.value)} placeholder="Awareness, conversión, engagement..."/></FG><FG label="CTA"><FI value={f.cta||""} onChange={e=>u("cta",e.target.value)} placeholder="Desliza, compra, comenta, guarda..."/></FG></R2>
    <FG label="Copy principal"><FTA value={f.copy||""} onChange={e=>u("copy",e.target.value)} placeholder="Texto o bajada principal que acompañará la publicación."/></FG>
    <FG label="Hashtags"><FI value={f.hashtags||""} onChange={e=>u("hashtags",e.target.value)} placeholder="#marca #campaña #contenido"/></FG>
    <FG label="Descripción / Brief"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="Concepto creativo, referencias, notas y criterios editoriales..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MEp({open,data,programas,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{pgId:data?.pgId||"",num:data?.num||1,titulo:"",estado:"Planificado",fechaGrab:"",fechaEmision:"",invitado:"",descripcion:"",locacion:"",duracion:"",notas:"",crewIds:[],comentarios:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Episodio":"Nuevo Episodio"} sub="Planificación de episodio" wide>
    <R3><FG label="Producción"><FSl value={f.pgId||""} onChange={e=>u("pgId",e.target.value)}><option value="">Seleccionar...</option>{(programas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG><FG label="Número *"><FI type="number" value={f.num||""} onChange={e=>u("num",Number(e.target.value))} min="1" placeholder="1"/></FG><FG label="Estado"><FSl value={f.estado||""} onChange={e=>u("estado",e.target.value)}>{(listas?.estadosEp||DEFAULT_LISTAS.estadosEp).map(o=><option key={o}>{o}</option>)}</FSl></FG></R3>
    <FG label="Título del Episodio *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Título descriptivo del episodio"/></FG>
    <R2><FG label="Invitado / Tema"><FI value={f.invitado||""} onChange={e=>u("invitado",e.target.value)} placeholder="Nombre o tema principal"/></FG><FG label="Locación"><FI value={f.locacion||""} onChange={e=>u("locacion",e.target.value)} placeholder="Estudio A, Exteriores..."/></FG></R2>
    <R3><FG label="Fecha Grabación"><FI type="date" value={f.fechaGrab||""} onChange={e=>u("fechaGrab",e.target.value)}/></FG><FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision||""} onChange={e=>u("fechaEmision",e.target.value)}/></FG><FG label="Duración (min)"><FI type="number" value={f.duracion||""} onChange={e=>u("duracion",e.target.value)} placeholder="45"/></FG></R3>
    <FG label="Descripción / Sinopsis"><FTA value={f.descripcion||""} onChange={e=>u("descripcion",e.target.value)} placeholder="Descripción del contenido..."/></FG>
    <FG label="Notas de Producción"><FTA value={f.notas||""} onChange={e=>u("notas",e.target.value)} placeholder="Notas internas, pendientes..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.titulo?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MAus({open,data,programas,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",tip:"Auspiciador Principal",con:"",ema:"",tel:"",pids:data?.pids||[],mon:"",vig:"",est:"Activo",frecPago:"Mensual",not:""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Auspiciador":"Nuevo Auspiciador"} sub="Marca o colaborador">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Banco Estado"/></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposAus||DEFAULT_LISTAS.tiposAus).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Contacto"><FI value={f.con||""} onChange={e=>u("con",e.target.value)} placeholder="María González"/></FG><FG label="Email"><FI value={f.ema||""} onChange={e=>u("ema",e.target.value)} placeholder="mg@empresa.cl"/></FG></R2>
    <R2><FG label="Monto (CLP)"><FI type="number" value={f.mon||""} onChange={e=>u("mon",e.target.value)} placeholder="0"/></FG><FG label="Frecuencia de Pago"><FSl value={f.frecPago||"Mensual"} onChange={e=>u("frecPago",e.target.value)}>{(listas?.frecPagoAus||DEFAULT_LISTAS.frecPagoAus).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <FG label="Producciones Asociadas"><MultiSelect options={(programas||[]).map(p=>({value:p.id,label:p.nom}))} value={f.pids||[]} onChange={v=>u("pids",v)} placeholder="Seleccionar producciones..."/></FG>
    <R2><FG label="Vigencia"><FI type="date" value={f.vig||""} onChange={e=>u("vig",e.target.value)}/></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{(listas?.estadosAus||DEFAULT_LISTAS.estadosAus).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Menciones, logo en créditos..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MCt({open,data,empresa,clientes,producciones,programas,piezas,presupuestos,facturas,listas,onClose,onSave}){
  const [f,setF]=useState({});
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canPres = hasAddon(empresa, "presupuestos");
  const canFact = hasAddon(empresa, "facturacion");
  useEffect(()=>{
    setF(data?.id
      ? {...data, pids:data.pids||[], facturaIds:data.facturaIds||[], alertaDias:data.alertaDias||30}
      : {nom:"",cliId:data?.cliId||"",tip:"Producción",est:"Borrador",mon:"",ini:"",vig:"",arc:"",not:"",pids:[],presupuestoId:"",facturaIds:[],alertaDias:30,renovacionAuto:false}
    );
  },[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const opts=[
    ...(producciones||[]).map(p=>({value:"p:"+p.id,label:"📽 "+p.nom})),
    ...(canPrograms ? (programas||[]).map(p=>({value:"pg:"+p.id,label:"📺 "+p.nom})) : []),
    ...(canSocial ? (piezas||[]).map(p=>({value:"pz:"+p.id,label:"📱 "+p.nom})) : []),
  ];
  const presupuestosCli = (presupuestos||[]).filter(p => !f.cliId || p.cliId === f.cliId);
  const facturasCli = (facturas||[]).filter(x => !f.cliId || x.entidadId === f.cliId);
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Contrato":"Nuevo Contrato"} sub="Documento legal">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Contrato de Proyecto Q2"/></FG><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG></R2>
    <FG label="Asociaciones"><MultiSelect options={opts} value={f.pids||[]} onChange={v=>u("pids",v)} placeholder={canSocial?"Proyectos, producciones y campañas...":canPrograms?"Proyectos y producciones...":"Proyectos vinculados..."}/></FG>
    <R2><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposCt||DEFAULT_LISTAS.tiposCt).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{(listas?.estadosCt||DEFAULT_LISTAS.estadosCt).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3>
      <FG label="Monto Total (CLP)"><FI type="number" value={f.mon||""} onChange={e=>u("mon",e.target.value)} placeholder="0"/></FG>
      <FG label="Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG>
      <FG label="Vigencia"><FI type="date" value={f.vig||""} onChange={e=>u("vig",e.target.value)}/></FG>
    </R3>
    <R2>
      <FG label="Alerta previa (días)"><FI type="number" value={f.alertaDias||30} onChange={e=>u("alertaDias",e.target.value)} min="0" placeholder="30"/></FG>
      <FG label="Renovación"><FSl value={f.renovacionAuto?"true":"false"} onChange={e=>u("renovacionAuto",e.target.value==="true")}><option value="false">Manual</option><option value="true">Automática</option></FSl></FG>
    </R2>
    {canPres && <FG label="Presupuesto asociado">
      <FSl value={f.presupuestoId||""} onChange={e=>u("presupuestoId",e.target.value)}>
        <option value="">— Sin presupuesto asociado —</option>
        {presupuestosCli.map(p=><option key={p.id} value={p.id}>{p.correlativo||p.titulo} · {fmtM(p.total||0)}</option>)}
      </FSl>
    </FG>}
    {canFact && <FG label="Órdenes de factura asociadas">
      <MultiSelect options={facturasCli.map(x=>({value:x.id,label:`${x.correlativo||"Sin correlativo"} · ${fmtM(x.total||0)}`}))} value={f.facturaIds||[]} onChange={v=>u("facturaIds",v)} placeholder="Seleccionar órdenes..."/>
    </FG>}
    <FG label="Archivo / URL"><FI value={f.arc||""} onChange={e=>u("arc",e.target.value)} placeholder="URL del documento"/></FG>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Condiciones especiales..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MMov({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF({tipo:data?.tipo||"ingreso",mon:"",des:"",cat:"General",fec:today(),not:"",eid:data?.eid||"",et:data?.et||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title="Registrar Movimiento" sub="Ingreso o gasto">
    <R2><FG label="Tipo *"><FSl value={f.tipo} onChange={e=>u("tipo",e.target.value)}><option value="ingreso">💰 Ingreso</option><option value="gasto">💸 Gasto / Egreso</option></FSl></FG><FG label="Monto (CLP) *"><FI type="number" value={f.mon} onChange={e=>u("mon",e.target.value)} placeholder="0" min="0"/></FG></R2>
    <FG label="Descripción *"><FI value={f.des} onChange={e=>u("des",e.target.value)} placeholder="Ej: Pago cuota 1, Arriendo..."/></FG>
    <R2><FG label="Categoría"><FSl value={f.cat} onChange={e=>u("cat",e.target.value)}>{(listas?.catMov||DEFAULT_LISTAS.catMov).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Fecha"><FI type="date" value={f.fec} onChange={e=>u("fec",e.target.value)}/></FG></R2>
    <MFoot onClose={onClose} onSave={()=>{if(!f.mon||!f.des?.trim())return;onSave({...f,mon:Number(f.mon)});}} label="Registrar"/>
  </Modal>;
}

function MCrew({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",rol:"",area:"Producción",tipo:"externo",tel:"",ema:"",dis:"",tarifa:"",not:"",active:true});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const AREAS=listas?.areasCrew||DEFAULT_LISTAS.areasCrew;
  const ROLES_C=listas?.rolesCrew||DEFAULT_LISTAS.rolesCrew;
  const managedByUser = f.managedByUser===true;
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Miembro":"Agregar al Equipo"} sub="Crew de producción">
    <FG label="Tipo de Crew"><FSl value={f.tipo||"externo"} disabled><option value="externo">Externo — tarifa aplica a producciones</option><option value="interno">Interno — derivado de usuarios</option></FSl></FG>
    {managedByUser&&<div style={{fontSize:11,color:"var(--gr2)",marginTop:-6,marginBottom:12}}>Este miembro viene desde `Usuarios`. Aquí puedes complementar datos operativos como área, teléfono, disponibilidad y notas.</div>}
    <R2><FG label="Nombre completo *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Juan Pérez" disabled={managedByUser}/></FG><FG label="Rol / Cargo">{managedByUser?<FI value={f.rol||""} disabled placeholder="Cargo sincronizado desde usuario"/>:<FSl value={f.rol||""} onChange={e=>u("rol",e.target.value)}><option value="">Seleccionar...</option>{ROLES_C.map(r=><option key={r}>{r}</option>)}</FSl>}</FG></R2>
    <R2><FG label="Área"><FSl value={f.area||""} onChange={e=>u("area",e.target.value)}>{AREAS.map(a=><option key={a}>{a}</option>)}</FSl></FG><FG label="Disponibilidad"><FI value={f.dis||""} onChange={e=>u("dis",e.target.value)} placeholder="Lun-Vie, Fines de semana..."/></FG></R2>
    <R2><FG label="Teléfono"><FI value={f.tel||""} onChange={e=>u("tel",e.target.value)} placeholder="+56 9 1234 5678"/></FG><FG label="Email"><FI type="email" value={f.ema||""} onChange={e=>u("ema",e.target.value)} placeholder="juan@email.cl" disabled={managedByUser}/></FG></R2>
    <R2><FG label="Tarifa"><FI value={f.tarifa||""} onChange={e=>u("tarifa",e.target.value)} placeholder="$150.000/día" disabled={managedByUser}/></FG><FG label="Estado"><FSl value={f.active!==false?"true":"false"} onChange={e=>u("active",e.target.value==="true")} disabled={managedByUser}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Especialidades, observaciones..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MEvento({open,data,producciones,programas,piezas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{titulo:"",tipo:"grabacion",fecha:data?.fecha||"",hora:"",desc:"",ref:data?.ref||"",refTipo:data?.refTipo||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const TIPOS=[{v:"grabacion",l:"🎬 Grabación"},{v:"emision",l:"📡 Emisión"},{v:"reunion",l:"💬 Reunión"},{v:"entrega",l:"✓ Entrega"},{v:"estreno",l:"🌟 Estreno"},{v:"otro",l:"📌 Otro"}];
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Evento":"Nuevo Evento de Calendario"} sub="Fecha de grabación, emisión, reunión u otro">
    <FG label="Título del evento *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Grabación Episodio 5, Reunión..."/></FG>
    <R2><FG label="Tipo"><FSl value={f.tipo||"grabacion"} onChange={e=>u("tipo",e.target.value)}>{TIPOS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</FSl></FG>
    <FG label="Vinculado a"><FSl value={f.ref||""} onChange={e=>{const opt=[...(producciones||[]).map(p=>({v:p.id,t:"produccion"})),...(programas||[]).map(p=>({v:p.id,t:"programa"})),...(piezas||[]).map(p=>({v:p.id,t:"contenido"}))].find(o=>o.v===e.target.value);u("ref",e.target.value);u("refTipo",opt?.t||"");}}>
      <option value="">Sin vinculación</option>
      <optgroup label="Proyectos">{(producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
      <optgroup label="Producciones">{(programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>
      <optgroup label="Campañas">{(piezas||[]).map(p=><option key={p.id} value={p.id}>📱 {p.nom}</option>)}</optgroup>
    </FSl></FG></R2>
    <R2><FG label="Fecha *"><FI type="date" value={f.fecha||""} onChange={e=>u("fecha",e.target.value)}/></FG><FG label="Hora"><FI type="time" value={f.hora||""} onChange={e=>u("hora",e.target.value)}/></FG></R2>
    <FG label="Descripción / Notas"><FTA value={f.desc||""} onChange={e=>u("desc",e.target.value)} placeholder="Detalles, ubicación, participantes..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.titulo?.trim()||!f.fecha)return;onSave(f);}}/>
  </Modal>;
}

// ── MODAL ROUTER ──────────────────────────────────────────────
function ModalRouter({mOpen,mData,closeM,VP,setters,saveTheme,saveUsers,saveEmpresas,ntf,cSave,saveMov,saveFacturaDoc}){
  const {empresa,clientes,producciones,programas,piezas,auspiciadores,contratos,crew,eventos}=VP;
  const {setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos,setTareas}=setters;

  const empId=empresa?.id;
  const withEmp=d=>({...d,empId});

  return <>
    <MCli    open={mOpen==="cli"}    data={mData} listas={VP.listas} onClose={closeM} onSave={d=>cSave(clientes,setClientes,withEmp(d))}/>
    <MPro    open={mOpen==="pro"}    data={mData} clientes={clientes} listas={VP.listas} onClose={closeM} onSave={d=>cSave(producciones,setProducciones,withEmp(d))}/>
    <MPg     open={mOpen==="pg"}     data={mData} clientes={clientes} listas={VP.listas} onClose={closeM} onSave={d=>cSave(programas,setProgramas,withEmp(d))}/>
    <MCampanaContenido open={mOpen==="contenido"} data={mData} clientes={clientes} listas={VP.listas} onClose={closeM} onSave={d=>cSave(piezas,setPiezas,withEmp(d))}/>
    <MPiezaContenido open={mOpen==="pieza"} data={mData} listas={VP.listas} crewOptions={(VP.crew||[]).filter(c=>c.empId===empresa?.id&&c.active!==false)} onClose={closeM} onSave={async d=>{const campId=mData?.campId; if(!campId) return; const next=(piezas||[]).map(c=>c.id!==campId?c:{...c,piezas:(c.piezas||[]).some(p=>p.id===d.id)?(c.piezas||[]).map(p=>p.id===d.id?normalizeSocialPiece(d,c):p):[...(c.piezas||[]),normalizeSocialPiece(d,c)]}); await setPiezas(next); closeM(); ntf("Pieza guardada ✓"); }}/>
    <MEp     open={mOpen==="ep"}     data={mData} programas={programas} listas={VP.listas} onClose={closeM} onSave={d=>cSave(VP.episodios,setEpisodios,withEmp(d))}/>
    <MAus    open={mOpen==="aus"}    data={mData} programas={programas} listas={VP.listas} onClose={closeM} onSave={d=>cSave(auspiciadores,setAuspiciadores,withEmp(d))}/>
    <MCt     open={mOpen==="ct"}     data={mData} empresa={empresa} clientes={clientes} producciones={producciones} programas={programas} piezas={piezas} presupuestos={VP.presupuestos} facturas={VP.facturas} listas={VP.listas} onClose={closeM} onSave={d=>cSave(contratos,setContratos,withEmp(d))}/>
    <MMov    open={mOpen==="mov"}    data={mData} listas={VP.listas} onClose={closeM} onSave={saveMov}/>
    <MCrew   open={mOpen==="crew"}   data={mData} listas={VP.listas} onClose={closeM} onSave={d=>cSave(crew,setCrew,withEmp(d))}/>
    <MEvento open={mOpen==="evento"} data={mData} producciones={producciones} programas={programas} piezas={piezas} onClose={closeM} onSave={d=>cSave(eventos,setEventos,withEmp(d))}/>
    <MPres   open={mOpen==="pres"}   data={mData} clientes={clientes} producciones={producciones} programas={programas} piezas={piezas} contratos={VP.contratos} listas={VP.listas} onClose={closeM} onSave={d=>cSave(VP.presupuestos,setPresupuestos,withEmp(d))} empresa={empresa} currentUser={VP.user}/>
    <MFact   open={mOpen==="fact"}   data={mData} empresa={empresa} clientes={clientes} auspiciadores={auspiciadores} producciones={producciones} programas={programas} piezas={piezas} presupuestos={VP.presupuestos} contratos={VP.contratos} listas={VP.listas} onClose={closeM} onSave={d=>saveFacturaDoc(withEmp(d))}/>
    <MActivo open={mOpen==="activo"} data={mData} producciones={producciones} listas={VP.listas} onClose={closeM} onSave={d=>cSave(VP.activos,setActivos,withEmp(d))}/>
    <MTarea  open={mOpen==="tarea"}  data={mData} producciones={producciones} programas={programas} piezas={piezas} crew={crew} listas={VP.listas} onClose={closeM} onSave={async d=>{const item={...withEmp(d),id:d.id||uid(),cr:d.cr||today()};const arr=Array.isArray(VP.tareas)?VP.tareas.filter(x=>x&&typeof x==="object"):[];const next=arr.find(x=>x.id===item.id)?arr.map(x=>x.id===item.id?item:x):[...arr,item];await setTareas(next);closeM();ntf("Tarea guardada ✓");}}/>
  </>;
}

// ── CLIENTES ──────────────────────────────────────────────────
function ViewClientes({empresa,clientes,producciones,movimientos,navTo,openM,canDo:_cd}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fi,setFi]=useState("");const [vista,setVista]=useState("cards");const [pg,setPg]=useState(1);const PP=9;
  const fd=(clientes||[]).filter(x=>x.empId===empId).filter(c=>(c.nom.toLowerCase().includes(q.toLowerCase())||(c.contactos||[]).some(co=>co.nom.toLowerCase().includes(q.toLowerCase())))&&(!fi||c.ind===fi));
  const canEdit=canDo({role:_cd?.user?.role||"admin"},"clientes");
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar cliente o contacto..."/>
      <FilterSel value={fi} onChange={v=>{setFi(v);setPg(1);}} options={["Retail","Tecnología","Salud","Educación","Entretenimiento","Gastronomía","Inmobiliaria","Servicios","Media","Gobierno","Otro"]} placeholder="Todas industrias"/>
      <div style={{display:"flex",gap:4,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:3}}>
        {[["cards","⊟"],["list","☰"]].map(([v,i])=><button key={v} onClick={()=>setVista(v)} style={{padding:"5px 10px",borderRadius:4,border:"none",background:vista===v?"var(--cy)":"transparent",color:vista===v?"var(--bg)":"var(--gr2)",cursor:"pointer",fontSize:13}}>{i}</button>)}
      </div>
      {_cd&&_cd("clientes")&&<Btn onClick={()=>openM("cli",{})}>+ Nuevo Cliente</Btn>}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(c=>{
          const pr=(producciones||[]).filter(p=>p.cliId===c.id).length;
          let ti=0,tg=0;(producciones||[]).filter(p=>p.cliId===c.id).forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
          return <div key={c.id} onClick={()=>navTo("cli-det",c.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>
            <div style={{width:44,height:44,background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:15,fontWeight:800,color:"var(--cy)",marginBottom:14}}>{ini(c.nom)}</div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{c.nom}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{c.ind||"Sin industria"}</div>
            {(c.contactos||[]).slice(0,2).map(co=><div key={co.id} style={{fontSize:11,color:"var(--gr2)",marginTop:5}}>👤 {co.nom}{co.car?" · "+co.car:""}</div>)}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
              <span style={{fontSize:11,color:"var(--cy)"}}>{pr} prod.</span>
              <span style={{fontSize:11,color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(ti-tg)}</span>
            </div>
          </div>;
        })}
      </div>
      {!fd.length&&<Empty text="Sin clientes" sub="Crea el primero con el botón superior"/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Industria</TH><TH>Contacto Principal</TH><TH>Email</TH><TH>Teléfono</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>{fd.slice((pg-1)*PP,pg*PP).map(c=>{
          let ti=0,tg=0;(producciones||[]).filter(p=>p.cliId===c.id).forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
          const pc=(c.contactos||[])[0];
          return <tr key={c.id} onClick={()=>navTo("cli-det",c.id)}>
            <TD bold>{c.nom}</TD><TD>{c.ind||"—"}</TD>
            <TD>{pc?pc.nom:"—"}</TD><TD style={{fontSize:11}}>{pc?.ema||"—"}</TD><TD style={{fontSize:11}}>{pc?.tel||"—"}</TD>
            <TD style={{color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ti-tg)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("cli-det",c.id);}}>Ver →</GBtn></TD>
          </tr>;
        })}</tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

function ViewCliDet({id,empresa,clientes,producciones,programas,piezas,contratos,movimientos,navTo,openM,canDo:_cd,cSave,cDel,setClientes,setContratos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const c=(clientes||[]).find(x=>x.id===id);if(!c) return <Empty text="No encontrado"/>;
  const prs=(producciones||[]).filter(p=>p.cliId===id);
  const pgs=(programas||[]).filter(p=>p.cliId===id);
  const ctn=(piezas||[]).filter(p=>p.cliId===id);
  const cts=(contratos||[]).filter(x=>x.cliId===id);
  let ti=0,tg=0;prs.forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
  pgs.forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
  ctn.forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
  const associationBlocks = [
    { key:"pro", title:"Proyectos", count:prs.length, action:_cd&&_cd("producciones")?{label:"+ Nuevo",fn:()=>openM("pro",{cliId:id})}:null, render:()=><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Nombre</TH><TH>Tipo</TH><TH>Estado</TH><TH>Inicio</TH><TH>Entrega</TH><TH>Balance</TH><TH></TH></tr></thead><tbody>
      {prs.map(p=>{const b=bal(p.id);return <tr key={p.id} onClick={()=>navTo("pro-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.tip} color="gray" sm/></TD><TD><Badge label={p.est}/></TD><TD mono style={{fontSize:11}}>{p.ini?fmtD(p.ini):"—"}</TD><TD mono style={{fontSize:11}}>{p.fin?fmtD(p.fin):"—"}</TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pro-det",p.id);}}>Ver →</GBtn></TD></tr>;})}
    </tbody></table>},
    { key:"pg", title:"Producciones", count:pgs.length, action:_cd&&_cd("programas")?{label:"+ Nuevo",fn:()=>openM("pg",{cliId:id})}:null, render:()=><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Nombre</TH><TH>Tipo</TH><TH>Estado</TH><TH>Canal</TH><TH>Frecuencia</TH><TH>Balance</TH><TH></TH></tr></thead><tbody>
      {pgs.map(p=>{const b=bal(p.id);return <tr key={p.id} onClick={()=>navTo("pg-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.tip||"Producción"} color="gray" sm/></TD><TD><Badge label={p.est}/></TD><TD>{p.can||"—"}</TD><TD>{p.fre||"—"}</TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pg-det",p.id);}}>Ver →</GBtn></TD></tr>;})}
    </tbody></table>},
    { key:"pz", title:"Contenidos", count:ctn.length, action:_cd&&_cd("contenidos")?{label:"+ Nuevo",fn:()=>openM("contenido",{cliId:id})}:null, render:()=><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Campaña</TH><TH>Plataforma</TH><TH>Mes</TH><TH>Estado</TH><TH>Piezas</TH><TH>Balance</TH><TH></TH></tr></thead><tbody>
      {ctn.map(p=>{const b=bal(p.id);return <tr key={p.id} onClick={()=>navTo("contenido-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.plataforma||"Contenidos"} color="gray" sm/></TD><TD>{[p.mes,p.ano].filter(Boolean).join(" ")||"—"}</TD><TD><Badge label={p.est||"Planificada"}/></TD><TD mono style={{fontSize:11}}>{countCampaignPieces(p)}</TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("contenido-det",p.id);}}>Ver →</GBtn></TD></tr>;})}
    </tbody></table>},
  ].filter(block=>block.count>0);
  return <div>
    <DetHeader title={c.nom} tag={c.ind} meta={[c.rut&&`RUT: ${c.rut}`,c.dir].filter(Boolean)}
      actions={_cd&&_cd("clientes")&&<><GBtn onClick={()=>openM("cli",c)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(clientes,setClientes,id,()=>navTo("clientes"),"Cliente eliminado");}}>🗑 Eliminar</DBtn></>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Asociaciones" value={prs.length+pgs.length+ctn.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Contratos"    value={cts.length}/>
      <Stat label="Ingresos"     value={fmtM(ti)}     accent="#00e08a" vc="#00e08a"/>
      <Stat label="Balance"      value={fmtM(ti-tg)}  accent={ti-tg>=0?"#00e08a":"#ff5566"} vc={ti-tg>=0?"#00e08a":"#ff5566"}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
      <Card title="Contactos">
        {(c.contactos||[]).length>0?(c.contactos||[]).map(co=><div key={co.id} style={{padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"var(--cg)",border:"1px solid var(--cm)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--cy)",flexShrink:0}}>{ini(co.nom)}</div>
            <div><div style={{fontSize:13,fontWeight:600}}>{co.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{co.car||"—"}</div></div>
          </div>
          <div style={{fontSize:11,color:"var(--gr3)",paddingLeft:38,marginBottom:8}}>✉ {co.ema||"—"} &nbsp;·&nbsp; ☎ {co.tel||"—"}</div>
          {co.not&&<div style={{fontSize:11,color:"var(--gr2)",paddingLeft:38,marginBottom:8}}>{co.not}</div>}
          <div style={{paddingLeft:38}}><ContactBtns tel={co.tel} ema={co.ema} nombre={co.nom} mensaje={`Hola ${co.nom}, te contactamos desde Produ.`}/></div>
        </div>):<Empty text="Sin contactos registrados"/>}
      </Card>
      <Card title="Financiero">
        <KV label="Total Ingresos" value={<span style={{color:"#00e08a",fontFamily:"var(--fm)"}}>{fmtM(ti)}</span>}/>
        <KV label="Total Gastos"   value={<span style={{color:"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(tg)}</span>}/>
        <Sep/>
        <KV label={<b>Balance</b>} value={<span style={{color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:14}}>{fmtM(ti-tg)}</span>}/>
        {c.not&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)"}}>{c.not}</div></>}
      </Card>
    </div>
    {associationBlocks.map(block=><Card key={block.key} title={`${block.title} (${block.count})`} action={block.action} style={{marginBottom:16}}>
      {block.render()}
    </Card>)}
    <Card title={`Contratos (${cts.length})`} action={_cd&&_cd("contratos")?{label:"+ Nuevo",fn:()=>openM("ct",{cliId:id})}:null}>
      {cts.map(ct=><div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:18,flexShrink:0}}>📄</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{ct.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ct.tip}{ct.vig?" · "+fmtD(ct.vig):""}</div></div><Badge label={ct.est}/>{ct.mon&&<span style={{fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ct.mon)}</span>}</div>)}
      {!cts.length&&<Empty text="Sin contratos"/>}
    </Card>
  </div>;
}

// ── PROYECTOS ──────────────────────────────────────────────
function ViewPros({empresa,clientes,producciones,movimientos,navTo,openM,canDo:_cd,listas}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [ft,setFt]=useState("");const [vista,setVista]=useState("list");const [pg,setPg]=useState(1);const PP=10;
  const fd=(producciones||[]).filter(p=>p.empId===empId).filter(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);return(p.nom.toLowerCase().includes(q.toLowerCase())||(c&&c.nom.toLowerCase().includes(q.toLowerCase())))&&(!fe||p.est===fe)&&(!ft||p.tip===ft);});
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar producción o cliente..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={listas?.estadosPro||DEFAULT_LISTAS.estadosPro} placeholder="Todo estados"/>
      <FilterSel value={ft} onChange={v=>{setFt(v);setPg(1);}} options={listas?.tiposPro||DEFAULT_LISTAS.tiposPro} placeholder="Todo tipos"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("producciones")&&<Btn onClick={()=>openM("pro",{})}>+ Nuevo Proyecto</Btn>}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(p=>{
          const c=(clientes||[]).find(x=>x.id===p.cliId);
          const b=bal(p.id);
          return <div key={p.id} onClick={()=>navTo("pro-det",p.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:18,cursor:"pointer",transition:".15s",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,lineHeight:1.25}}>{p.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{c?.nom||"Sin cliente"}</div>
            </div>
            <Badge label={p.est}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <Badge label={p.tip||"Sin tipo"} color="gray" sm/>
            {p.ini&&<Badge label={`Ini ${fmtD(p.ini)}`} color="cyan" sm/>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
            <div><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Ingresos</div><div style={{fontFamily:"var(--fm)",fontSize:14,color:"#00e08a",marginTop:4}}>{fmtM(b.i)}</div></div>
            <div><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Balance</div><div style={{fontFamily:"var(--fm)",fontSize:14,color:b.b>=0?"#00e08a":"#ff5566",marginTop:4}}>{fmtM(b.b)}</div></div>
          </div>
          <div style={{fontSize:11,color:"var(--gr2)",display:"flex",justifyContent:"space-between",marginTop:"auto"}}>
            <span>{p.fin?`Entrega ${fmtD(p.fin)}`:"Sin entrega"}</span>
            <span style={{color:"var(--cy)",fontWeight:700}}>Ver →</span>
          </div>
        </div>;
        })}
      </div>
      {!fd.length&&<Empty text="Sin proyectos" sub="Crea el primero con el botón superior"/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Proyecto</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH>Inicio</TH><TH>Entrega</TH><TH>Ingresos</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);const b=bal(p.id);return<tr key={p.id} onClick={()=>navTo("pro-det",p.id)}>
            <TD bold>{p.nom}</TD><TD>{c?c.nom:"—"}</TD><TD><Badge label={p.tip} color="gray" sm/></TD><TD><Badge label={p.est}/></TD>
            <TD mono style={{fontSize:11}}>{p.ini?fmtD(p.ini):"—"}</TD>
            <TD mono style={{fontSize:11}}>{p.fin?fmtD(p.fin):"—"}</TD>
            <TD style={{color:"#00e08a",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.i)}</TD>
            <TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pro-det",p.id);}}>Ver →</GBtn></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin proyectos" sub="Crea el primero con el botón superior"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

function ViewProDet({id,empresa,user,clientes,producciones,programas,piezas,contratos,movimientos,crew,eventos,tareas,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setProducciones,setMovimientos,setTareas,ntf}){
  const empId=empresa?.id;
  const tasksEnabled=hasAddon(empresa,"tareas");
  const bal=useBal(movimientos,empId);
  const p=(producciones||[]).find(x=>x.id===id);if(!p) return <Empty text="No encontrado"/>;
  const c=(clientes||[]).find(x=>x.id===p.cliId);
  const contratosRel = contractsForReference(contratos||[], p.cliId, "produccion", id);
  const b=bal(id);const mv=(movimientos||[]).filter(m=>m.eid===id);
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(p.crewIds||[]).includes(x.id));
  const cContacto=(c?.contactos||[])[0];
  const [tab,setTab]=useState(0);
  const addCrew=async crId=>{const next=(producciones||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);await setProducciones(next);};
  const remCrew=async crId=>{const next=(producciones||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setProducciones(next);};
  return <div>
    <DetHeader title={p.nom} tag={p.tip} badges={[<Badge key={0} label={p.est}/>]} meta={[c&&`Cliente: ${c.nom}`,p.ini&&`Inicio: ${fmtD(p.ini)}`,p.fin&&`Entrega: ${fmtD(p.fin)}`].filter(Boolean)} des={p.des}
      actions={_cd&&_cd("producciones")&&<><GBtn onClick={()=>openM("pro",p)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(producciones,setProducciones,id,()=>navTo("producciones"),"Proyecto eliminado");}}>🗑</DBtn></>}/>
    {cContacto&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:14,flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:12,color:"var(--gr2)"}}>Contacto: <b style={{color:"var(--wh)"}}>{cContacto.nom}</b> {cContacto.car?`· ${cContacto.car}`:""}</span>
      <ContactBtns tel={cContacto.tel} ema={cContacto.ema} nombre={cContacto.nom} mensaje={`Hola ${cContacto.nom}, te escribimos sobre el proyecto "${p.nom}".`}/>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m=>m.tipo==="ingreso").length} reg.`} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Gastos"   value={fmtM(b.g)} sub={`${mv.filter(m=>m.tipo==="gasto").length} reg.`}  accent="#ff5566" vc="#ff5566"/>
      <Stat label="Balance"  value={fmtM(b.b)} accent={b.b>=0?"#00e08a":"#ff5566"} vc={b.b>=0?"#00e08a":"#ff5566"}/>
      <Stat label="Crew"     value={pCrew.length} sub="asignados" accent="var(--cy)" vc="var(--cy)"/>
    </div>
    <Tabs tabs={["Comentarios","Ingresos","Gastos","Crew","Fechas","Contratos",...(tasksEnabled?["Tareas"]:[])]} active={tab} onChange={setTab}/>
    {(tab===1||tab===2)&&<div style={{display:"flex",gap:8,margin:"10px 0"}}>
      <GBtn sm onClick={()=>exportMovCSV(mv.filter(m=>tab===1?m.tipo==="ingreso":m.tipo==="gasto"),p.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={()=>exportMovPDF(mv.filter(m=>tab===1?m.tipo==="ingreso":m.tipo==="gasto"),p.nom,empresa,tab===1?"Ingresos":"Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab===0&&<ComentariosBlock items={p.comentarios||[]} onSave={async comentarios=>{await setProducciones((producciones||[]).map(x=>x.id===id?{...x,comentarios}:x));}} onCreateTask={tasksEnabled?async comment=>{const task=normalizeTaskAssignees({id:uid(),empId,cr:today(),titulo:comment.text?.split("\n")[0]?.slice(0,80)||`Seguimiento ${p.nom}`,desc:comment.text||"",estado:"Pendiente",prioridad:"Media",fechaLimite:"",refTipo:"pro",refId:id,assignedIds:getAssignedIds(comment),asignadoA:getAssignedIds(comment)[0]||""});await setTareas([...(Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"):[]),task]);ntf&&ntf("Comentario guardado y tarea creada ✓");}:null} crewOptions={pCrew} canEdit={_cd&&_cd("producciones")} title="Comentarios del Proyecto" empresa={empresa} currentUser={user}/>}
    {tab===1&&<MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pro" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===2&&<MovBlock movimientos={mv} tipo="gasto"   eid={id} etype="pro" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===3&&<CrewTab crew={crew||[]} empId={empId} asignados={p.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("producciones")} onHonorario={m=>{saveMov({eid:id,et:"pro",tipo:"gasto",cat:"Honorarios",des:"Honorarios "+m.nom,mon:parseTarifa(m.tarifa),fec:today()});}}/>}
    {tab===4&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
      <Card title="Fechas Base del Proyecto" action={_cd&&_cd("producciones")?{label:"✏ Editar Fechas",fn:()=>openM("pro",p)}:null}>
        <KV label="Inicio" value={p.ini?fmtD(p.ini):"Por definir"}/>
        <KV label="Entrega" value={p.fin?fmtD(p.fin):"Por definir"}/>
      </Card>
      <MiniCal refId={id} eventos={eventos||[]} onAdd={()=>openM("evento",{ref:id,refTipo:"produccion"})} onEdit={ev=>openM("evento",ev)} onDel={async evId=>{await cSave((eventos||[]).filter(x=>x.id!==evId),()=>{},{}); }} canEdit={_cd&&_cd("calendario")} titulo={p.nom}/>
    </div>}
    {tab===5&&<Card title="Contratos Relacionados" action={_cd&&_cd("contratos")?{label:"+ Nuevo",fn:()=>openM("ct",{cliId:p.cliId,pids:[`p:${id}`],tip:"Producción",nom:`Contrato ${p.nom}`})}:null}>
      {contratosRel.map(ct=><div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:18}}>📄</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{ct.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ct.tip}{ct.vig?" · "+fmtD(ct.vig):""}</div></div><Badge label={ct.est}/>{ct.mon&&<span style={{fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ct.mon)}</span>}</div>)}
      {!contratosRel.length&&<Empty text="Sin contratos relacionados"/>}
    </Card>}
    {tasksEnabled&&tab===6&&<TareasContexto title="Tareas del Proyecto" refTipo="pro" refId={id} tareas={Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"&&t.empId===empId):[]} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={_cd&&_cd("producciones")}/>}
  </div>;
}

// helper tab crew

function parseTarifa(t){return parseInt(String(t||0).replace(/[^0-9]/g,""))||0;}

function CrewTab({crew,empId,asignados,onAdd,onRem,onHonorario,canEdit}){
  const todos=(crew||[]).filter(x=>x.empId===empId);
  const asig=todos.filter(x=>asignados.includes(x.id));
  const disp=todos.filter(x=>!asignados.includes(x.id)&&x.active!==false);
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <Card title={`Crew Asignado (${asig.length})`}>
      {asig.length?asig.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(m.nom)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{m.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{m.rol}{m.tarifa&&m.tipo!=="interno"?` · ${fmtM(Number(String(m.tarifa).replace(/[^0-9]/g,"")))}`:""}</div></div>
        {canEdit&&onHonorario&&m.tipo!=="interno"&&m.tarifa&&<button onClick={()=>onHonorario(m)} title="Registrar honorario" style={{background:"#4ade8018",border:"1px solid #4ade8040",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:11,fontWeight:700,padding:"2px 8px",whiteSpace:"nowrap"}}>💰</button>}
        {canEdit&&<XBtn onClick={()=>onRem(m.id)}/>}
      </div>):<Empty text="Sin crew asignado"/>}
    </Card>
    <Card title={`Disponibles (${disp.length})`}>
      {disp.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--gr2)",flexShrink:0}}>{ini(m.nom)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{m.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{m.rol}</div></div>
        {canEdit&&<GBtn sm onClick={()=>onAdd(m.id)}>+ Asignar</GBtn>}
      </div>)}
      {!disp.length&&<Empty text="Sin crew disponible"/>}
    </Card>
  </div>;
}

// ── PRODUCCIONES ──────────────────────────────────────────────
function ViewPgs({empresa,programas,episodios,auspiciadores,movimientos,navTo,openM,canDo:_cd,listas}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [vista,setVista]=useState("cards");const [pg,setPg]=useState(1);const PP=9;
  const fd=(programas||[]).filter(x=>x.empId===empId).filter(p=>(p.nom.toLowerCase().includes(q.toLowerCase())||p.tip.toLowerCase().includes(q.toLowerCase()))&&(!fe||p.est===fe));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar producción..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={listas?.estadosPg||DEFAULT_LISTAS.estadosPg} placeholder="Todo estados"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("programas")&&<Btn onClick={()=>openM("pg",{})}>+ Nueva Producción</Btn>}
    </div>
    {vista==="cards"?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
      {fd.slice((pg-1)*PP,pg*PP).map(pg_=>{
        const eps=(episodios||[]).filter(e=>e.pgId===pg_.id);
        const pub=eps.filter(e=>e.estado==="Publicado").length;
        const aus=(auspiciadores||[]).filter(a=>(a.pids||[]).includes(pg_.id)).length;
        const b=bal(pg_.id);
        return <div key={pg_.id} onClick={()=>navTo("pg-det",pg_.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20,cursor:"pointer",position:"relative",overflow:"hidden",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--cy),var(--cy2))"}}/>
          <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--cy)",marginBottom:8,fontWeight:600}}>{pg_.tip}</div>
          <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:5,lineHeight:1.2}}>{pg_.nom}</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>{pg_.can||"Sin canal"} · {pg_.fre||""}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}><Badge label={pg_.est}/>{pg_.totalEp&&<Badge label={`${pg_.totalEp} ep.`} color="gray"/>}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
            {[["Total",eps.length,"var(--wh)"],["Pub.",pub,"#00e08a"],["Aus.",aus,"var(--cy)"]].map(([l,v,c])=><div key={l} style={{textAlign:"center"}}><div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>{l}</div></div>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:10}}>
            <span style={{color:"var(--gr2)"}}>Balance</span>
            <span style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(b.b)}</span>
          </div>
        </div>;
      })}
    </div>:<Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Producción</TH><TH>Canal</TH><TH>Estado</TH><TH>Episodios</TH><TH>Publicados</TH><TH>Auspiciadores</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(pg_=>{const eps=(episodios||[]).filter(e=>e.pgId===pg_.id);const pub=eps.filter(e=>e.estado==="Publicado").length;const aus=(auspiciadores||[]).filter(a=>(a.pids||[]).includes(pg_.id)).length;const b=bal(pg_.id);return <tr key={pg_.id} onClick={()=>navTo("pg-det",pg_.id)}>
            <TD bold>{pg_.nom}</TD>
            <TD>{[pg_.can,pg_.fre].filter(Boolean).join(" · ")||"—"}</TD>
            <TD><Badge label={pg_.est}/></TD>
            <TD mono style={{fontSize:11}}>{eps.length}</TD>
            <TD mono style={{fontSize:11,color:"#00e08a"}}>{pub}</TD>
            <TD mono style={{fontSize:11}}>{aus}</TD>
            <TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pg-det",pg_.id);}}>Ver →</GBtn></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin producciones" sub="Crea la primera con el botón superior"/></td></tr>}
        </tbody>
      </table></div>
    </Card>}
    {!fd.length&&vista==="cards"&&<Empty text="Sin producciones" sub="Crea la primera con el botón superior"/>}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
  </div>;
}

function ViewContenidos({empresa,clientes,piezas,movimientos,navTo,openM,canDo:_cd}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [fm,setFm]=useState("");const [fp,setFp]=useState("");const [vista,setVista]=useState("list");const [pg,setPg]=useState(1);const PP=10;
  const fd=(piezas||[]).filter(x=>x.empId===empId).filter(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);return (p.nom||"").toLowerCase().includes(q.toLowerCase())||((c?.nom||"").toLowerCase().includes(q.toLowerCase()));}).filter(p=>(!fe||p.est===fe)&&(!fm||p.mes===fm)&&(!fp||p.plataforma===fp));
  const totalPlanned=fd.reduce((s,p)=>s+Number(p.plannedPieces||0),0);
  const totalCreated=fd.reduce((s,p)=>s+countCampaignPieces(p),0);
  const totalPublished=fd.reduce((s,p)=>s+(p.piezas||[]).filter(pc=>pc.est==="Publicado").length,0);
  const totalScheduled=fd.reduce((s,p)=>s+(p.piezas||[]).filter(pc=>pc.est==="Programado").length,0);
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar campaña o cliente..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={CAMPANA_ESTADOS} placeholder="Todo estados"/>
      <FilterSel value={fm} onChange={v=>{setFm(v);setPg(1);}} options={MESES} placeholder="Todos los meses"/>
      <FilterSel value={fp} onChange={v=>{setFp(v);setPg(1);}} options={PIEZA_PLATAFORMAS} placeholder="Todas las plataformas"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("contenidos")&&<Btn onClick={()=>openM("contenido",{})}>+ Nueva Campaña</Btn>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
      <Stat label="Planificadas" value={totalPlanned} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Creadas" value={totalCreated} accent="#7c5cff" vc="#7c5cff"/>
      <Stat label="Programadas" value={totalScheduled} accent="#38bdf8" vc="#38bdf8"/>
      <Stat label="Publicadas" value={totalPublished} accent="#00e08a" vc="#00e08a"/>
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(pz=>{const c=(clientes||[]).find(x=>x.id===pz.cliId);const b=bal(pz.id);return <div key={pz.id} onClick={()=>navTo("contenido-det",pz.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:18,cursor:"pointer",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,lineHeight:1.25}}>{pz.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{c?.nom||"Sin cliente"}</div>
            </div>
            <Badge label={pz.est||"Planificada"}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <Badge label={[pz.mes,pz.ano].filter(Boolean).join(" ")||"Sin mes"} color="cyan" sm/>
            <Badge label={pz.plataforma||"Multi-plataforma"} color="gray" sm/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
            <div><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Piezas</div><div style={{fontFamily:"var(--fm)",fontSize:14,marginTop:4}}>{countCampaignPieces(pz)}/{pz.plannedPieces||countCampaignPieces(pz)}</div></div>
            <div><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Balance</div><div style={{fontFamily:"var(--fm)",fontSize:14,color:b.b>=0?"#00e08a":"#ff5566",marginTop:4}}>{fmtM(b.b)}</div></div>
          </div>
        </div>;})}
      </div>
      {!fd.length&&<Empty text="Sin campañas" sub="Crea la primera con el botón superior"/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Campaña</TH><TH>Cliente</TH><TH>Mes</TH><TH>Piezas</TH><TH>Plataforma</TH><TH>Estado</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(pz=>{const c=(clientes||[]).find(x=>x.id===pz.cliId);const b=bal(pz.id);return<tr key={pz.id} onClick={()=>navTo("contenido-det",pz.id)}>
            <TD bold>{pz.nom}</TD>
            <TD>{c?.nom||"—"}</TD>
            <TD>{[pz.mes,pz.ano].filter(Boolean).join(" ")||"—"}</TD>
            <TD><Badge label={`${countCampaignPieces(pz)}/${pz.plannedPieces||countCampaignPieces(pz)} piezas`} color="gray" sm/></TD>
            <TD><Badge label={pz.plataforma||"Multi-plataforma"} color="gray" sm/></TD>
            <TD><Badge label={pz.est||"Planificada"}/></TD>
            <TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("contenido-det",pz.id);}}>Ver →</GBtn></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin campañas" sub="Crea la primera con el botón superior"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

function ViewPgDet({id,empresa,user,clientes,producciones,programas,piezas,episodios,auspiciadores,movimientos,crew,eventos,tareas,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setProgramas,setEpisodios,setMovimientos,setTareas,ntf}){
  const empId=empresa?.id;
  const tasksEnabled=hasAddon(empresa,"tareas");
  const bal=useBal(movimientos,empId);
  const pg_=(programas||[]).find(x=>x.id===id);if(!pg_) return <Empty text="No encontrado"/>;
  const eps=(episodios||[]).filter(e=>e.pgId===id).sort((a,b)=>a.num-b.num);
  const aus=(auspiciadores||[]).filter(a=>(a.pids||[]).includes(id));
  const b=bal(id);const mv=(movimientos||[]).filter(m=>m.eid===id);
  const tauz=aus.reduce((s,a)=>s+Number(a.mon||0),0);
  const [tab,setTab]=useState(0);
  const [epQ,setEpQ]=useState("");const [epF,setEpF]=useState("");const [epPg,setEpPg]=useState(1);const EPP=8;
  const epStats={plan:eps.filter(e=>e.estado==="Planificado").length,grab:eps.filter(e=>e.estado==="Grabado").length,edit:eps.filter(e=>e.estado==="En Edición").length,prog:eps.filter(e=>e.estado==="Programado").length,pub:eps.filter(e=>e.estado==="Publicado").length,can:eps.filter(e=>e.estado==="Cancelado").length};
  const fdEps=eps.filter(e=>(!epF||e.estado===epF)&&(e.titulo.toLowerCase().includes(epQ.toLowerCase())||(e.invitado||"").toLowerCase().includes(epQ.toLowerCase())));
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(pg_.crewIds||[]).includes(x.id));
  const addCrew=async crId=>{const next=(programas||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);await setProgramas(next);};
  const remCrew=async crId=>{const next=(programas||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setProgramas(next);};
  const cliAsoc=(clientes||[]).find(x=>x.id===pg_.cliId);
  return <div>
    <DetHeader title={pg_.nom} tag={pg_.tip} badges={[<Badge key={0} label={pg_.est}/>]} meta={[pg_.can,pg_.fre,pg_.temporada&&`Temp: ${pg_.temporada}`,pg_.conductor&&`🎙 ${pg_.conductor}`,cliAsoc&&`Cliente: ${cliAsoc.nom}`].filter(Boolean)} des={pg_.des}
      actions={_cd&&_cd("programas")&&<><GBtn onClick={()=>openM("pg",pg_)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar producción y episodios?"))return;cDel(programas,setProgramas,id,()=>navTo("programas"),"Eliminado");}}>🗑</DBtn></>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Episodios"   value={eps.length}    sub={`${epStats.plan} planificados`}/>
      <Stat label="Publicados"  value={epStats.pub}   accent="#00e08a" vc="#00e08a" sub={`${epStats.grab} grabados`}/>
      <Stat label="Balance"     value={fmtM(b.b)}     accent={b.b>=0?"#00e08a":"#ff5566"} vc={b.b>=0?"#00e08a":"#ff5566"}/>
      <Stat label="Auspicios"   value={fmtM(tauz)}    accent="#ffcc44" vc="#ffcc44" sub={`${aus.length} auspiciadores`}/>
    </div>
    {pg_.conductor&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:14,flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:12,color:"var(--gr2)"}}>Conductor: <b style={{color:"var(--wh)"}}>{pg_.conductor}</b>{pg_.prodEjec?` · Prod: ${pg_.prodEjec}`:""}</span>
      {cliAsoc&&(cliAsoc.contactos||[]).slice(0,1).map(co=><ContactBtns key={co.id} tel={co.tel} ema={co.ema} nombre={co.nom} mensaje={`Hola ${co.nom}, te contactamos sobre el programa "${pg_.nom}".`}/>)}
    </div>}
    <Tabs tabs={["Comentarios","Episodios","Ingresos","Gastos","Auspiciadores","Crew","Fechas","Info",...(tasksEnabled?["Tareas"]:[])]} active={tab} onChange={setTab}/>
    {(tab===2||tab===3)&&<div style={{display:"flex",gap:8,margin:"10px 0"}}>
      <GBtn sm onClick={()=>exportMovCSV(mv.filter(m=>tab===2?m.tipo==="ingreso":m.tipo==="gasto"),pg_.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={()=>exportMovPDF(mv.filter(m=>tab===2?m.tipo==="ingreso":m.tipo==="gasto"),pg_.nom,empresa,tab===2?"Ingresos":"Gastos")}>⬇ PDF</GBtn>
    </div>}

    {tab===0&&<ComentariosBlock items={pg_.comentarios||[]} onSave={async comentarios=>{await setProgramas((programas||[]).map(x=>x.id===id?{...x,comentarios}:x));}} onCreateTask={tasksEnabled?async comment=>{const task=normalizeTaskAssignees({id:uid(),empId,cr:today(),titulo:comment.text?.split("\n")[0]?.slice(0,80)||`Seguimiento ${pg_.nom}`,desc:comment.text||"",estado:"Pendiente",prioridad:"Media",fechaLimite:"",refTipo:"pg",refId:id,assignedIds:getAssignedIds(comment),asignadoA:getAssignedIds(comment)[0]||""});await setTareas([...(Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"):[]),task]);ntf&&ntf("Comentario guardado y tarea creada ✓");}:null} crewOptions={pCrew} canEdit={_cd&&_cd("programas")} title="Comentarios de la Producción" empresa={empresa} currentUser={user}/>}
    {tab===1&&<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={epQ} onChange={v=>{setEpQ(v);setEpPg(1);}} placeholder="Buscar episodio..."/>
        <FilterSel value={epF} onChange={v=>{setEpF(v);setEpPg(1);}} options={["Planificado","Grabado","En Edición","Programado","Publicado","Cancelado"]} placeholder="Todo estados"/>
        {_cd&&_cd("programas")&&<Btn onClick={()=>openM("ep",{pgId:id,num:eps.length?Math.max(...eps.map(e=>e.num))+1:1})}>+ Nuevo Episodio</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:16}}>
        {[["Planificado",epStats.plan,"#ffcc44"],["Grabado",epStats.grab,"var(--cy)"],["En Edición",epStats.edit,"var(--cy)"],["Programado",epStats.prog,"#a855f7"],["Publicado",epStats.pub,"#00e08a"],["Cancelado",epStats.can,"#ff5566"]].map(([s,cnt,c])=>(
          <div key={s} onClick={()=>setEpF(epF===s?"":s)} style={{background:"var(--card)",border:`1px solid ${epF===s?c:"var(--bdr)"}`,borderRadius:8,padding:"10px 14px",cursor:"pointer"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:c}}>{cnt}</div>
            <div style={{fontSize:10,color:"var(--gr2)"}}>{s}</div>
          </div>
        ))}
      </div>
      <Card>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>N°</TH><TH>Título</TH><TH>Invitado</TH><TH>Grabación</TH><TH>Emisión</TH><TH>Estado</TH><TH>Gastos</TH><TH></TH></tr></thead>
          <tbody>
            {fdEps.slice((epPg-1)*EPP,epPg*EPP).map(ep=>{const eg=bal(ep.id);return<tr key={ep.id} onClick={()=>navTo("ep-det",ep.id)}>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontWeight:700,fontSize:13}}>#{String(ep.num).padStart(2,"0")}</TD>
              <TD bold>{ep.titulo}</TD>
              <TD style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12}}>{ep.invitado||"—"}</TD>
              <TD mono style={{fontSize:11}}>{ep.fechaGrab?fmtD(ep.fechaGrab):"Por confirmar"}</TD>
              <TD mono style={{fontSize:11}}>{ep.fechaEmision?fmtD(ep.fechaEmision):"—"}</TD>
              <TD><Badge label={ep.estado}/></TD>
              <TD style={{color:"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(eg.g)}</TD>
              <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("ep-det",ep.id);}}>Ver →</GBtn></TD>
            </tr>;})}
            {!fdEps.length&&<tr><td colSpan={8}><Empty text="Sin episodios" sub={_cd&&_cd("programas")?"Crea el primero arriba":""}/></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={epPg} total={fdEps.length} perPage={EPP} onChange={setEpPg}/>
      </Card>
    </div>}
    {tab===2&&<MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pg" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===3&&<MovBlock movimientos={mv} tipo="gasto"   eid={id} etype="pg" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===4&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>{_cd&&_cd("auspiciadores")&&<Btn onClick={()=>openM("aus",{pids:[id]})}>+ Auspiciador</Btn>}</div>
      {aus.length?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{aus.map(a=><AusCard key={a.id} a={a} pgs={[pg_]} onEdit={_cd&&_cd("auspiciadores")?()=>openM("aus",a):null}/>)}</div>:<Empty text="Sin auspiciadores"/>}
    </div>}
    {tab===5&&<CrewTab crew={crew||[]} empId={empId} asignados={pg_.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("programas")} onHonorario={m=>{saveMov({eid:id,et:"pg",tipo:"gasto",cat:"Honorarios",des:"Honorarios "+m.nom,mon:parseTarifa(m.tarifa),fec:today()});}}/>}
    {tab===6&&<MiniCal refId={id} eventos={eventos||[]} onAdd={()=>openM("evento",{ref:id,refTipo:"programa"})} onEdit={ev=>openM("evento",ev)} onDel={async evId=>{await cSave((eventos||[]).filter(x=>x.id!==evId),()=>{},{});}} canEdit={_cd&&_cd("calendario")} titulo={pg_.nom}/>}
    {tab===7&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Datos de la Producción">
        {[["Tipo",pg_.tip],["Canal",pg_.can||"—"],["Frecuencia",pg_.fre||"—"],["Temporada",pg_.temporada||"—"],["Total Ep.",pg_.totalEp||"—"],["Estado",<Badge key={0} label={pg_.est}/>],["Cliente",cliAsoc?.nom||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Equipo">
        {[["Conductor / Host",pg_.conductor||"—"],["Prod. Ejecutivo",pg_.prodEjec||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {pg_.des&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)"}}>{pg_.des}</div></>}
      </Card>
    </div>}
    {tasksEnabled&&tab===8&&<TareasContexto title="Tareas de la Producción" refTipo="pg" refId={id} tareas={Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"&&t.empId===empId):[]} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={_cd&&_cd("programas")}/>}
  </div>;
}

function ViewContenidoDet({id,empresa,user,clientes,piezas,movimientos,crew,eventos,tareas,presupuestos,contratos,facturas,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setPiezas,setMovimientos,setTareas,ntf,producciones,programas}){
  const empId=empresa?.id;
  const tasksEnabled=hasAddon(empresa,"tareas");
  const bal=useBal(movimientos,empId);
  const pz=(piezas||[]).find(x=>x.id===id);if(!pz) return <Empty text="No encontrado"/>;
  const cli=(clientes||[]).find(x=>x.id===pz.cliId);
  const b=bal(id);const mv=(movimientos||[]).filter(m=>m.eid===id);
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(pz.crewIds||[]).includes(x.id));
  const [tab,setTab]=useState(0);
  const [piezaQ,setPiezaQ]=useState("");
  const [piezaEstado,setPiezaEstado]=useState("");
  const [piezaResp,setPiezaResp]=useState("");
  const piezasCamp=(pz.piezas||[]).filter(pc=>(pc.nom||"").toLowerCase().includes(piezaQ.toLowerCase())&&(!piezaEstado||pc.est===piezaEstado));
  const piezasFiltradas=piezasCamp.filter(pc=>(!piezaResp||pc.responsableId===piezaResp));
  const piezasPub=(pz.piezas||[]).filter(pc=>pc.est==="Publicado").length;
  const piezasProgramadas=(pz.piezas||[]).filter(pc=>pc.est==="Programado").length;
  const piezasRevision=(pz.piezas||[]).filter(pc=>(pc.approval||"Pendiente")==="En revisión" || pc.est==="Correcciones").length;
  const piezasAprobadas=(pz.piezas||[]).filter(pc=>(pc.approval||"Pendiente")==="Aprobada").length;
  const crewMap=Object.fromEntries((crew||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const editorialPendientes=(pz.piezas||[]).filter(pc=>pc.publishDate && pc.publishDate>=today() && pc.est!=="Publicado").sort((a,b)=>(a.publishDate||"").localeCompare(b.publishDate||""));
  const editorialAtrasadas=(pz.piezas||[]).filter(pc=>pc.publishDate && pc.publishDate<today() && pc.est!=="Publicado").sort((a,b)=>(a.publishDate||"").localeCompare(b.publishDate||""));
  const editorialPublicadas=(pz.piezas||[]).filter(pc=>pc.publishedAt || pc.est==="Publicado").sort((a,b)=>(b.publishedAt||b.publishDate||"").localeCompare(a.publishedAt||a.publishDate||""));
  const addCrew=async crId=>{const next=(piezas||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);await setPiezas(next);};
  const remCrew=async crId=>{const next=(piezas||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setPiezas(next);};
  const savePiece=async piece=>{
    const next=(piezas||[]).map(x=>x.id!==id?x:{...x,piezas:(x.piezas||[]).some(p=>p.id===piece.id)?(x.piezas||[]).map(p=>p.id===piece.id?normalizeSocialPiece(piece,x):p):[...(x.piezas||[]),normalizeSocialPiece(piece,x)]});
    await setPiezas(next);
  };
  const deletePiece=async pieceId=>{
    if(!confirm("¿Eliminar pieza?")) return;
    const next=(piezas||[]).map(x=>x.id!==id?x:{...x,piezas:(x.piezas||[]).filter(p=>p.id!==pieceId)});
    await setPiezas(next);
    ntf&&ntf("Pieza eliminada","warn");
  };
  return <div>
    <DetHeader title={pz.nom} tag="Campaña" badges={[<Badge key={0} label={pz.est||"Planificada"}/>]} meta={[cli&&`Cliente: ${cli.nom}`,pz.plataforma&&`Plataforma: ${pz.plataforma}`,[pz.mes,pz.ano].filter(Boolean).join(" "),pz.fin&&`Cierre: ${fmtD(pz.fin)}`].filter(Boolean)} des={pz.des}
      actions={_cd&&_cd("contenidos")&&<><GBtn onClick={()=>openM("contenido",pz)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar campaña?"))return;cDel(piezas,setPiezas,id,()=>navTo("contenidos"),"Campaña eliminada");}}>🗑</DBtn></>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m=>m.tipo==="ingreso").length} reg.`} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Gastos" value={fmtM(b.g)} sub={`${mv.filter(m=>m.tipo==="gasto").length} reg.`} accent="#ff5566" vc="#ff5566"/>
      <Stat label="Piezas" value={countCampaignPieces(pz)} sub={`${piezasPub} publicadas`} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Balance" value={fmtM(b.b)} accent={b.b>=0?"#00e08a":"#ff5566"} vc={b.b>=0?"#00e08a":"#ff5566"}/>
    </div>
    <Tabs tabs={["Comentarios","Piezas","Editorial","Ingresos","Gastos","Crew","Fechas","Info",...(tasksEnabled?["Tareas"]:[])]} active={tab} onChange={setTab}/>
    {(tab===3||tab===4)&&<div style={{display:"flex",gap:8,margin:"10px 0"}}>
      <GBtn sm onClick={()=>exportMovCSV(mv.filter(m=>tab===3?m.tipo==="ingreso":m.tipo==="gasto"),pz.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={()=>exportMovPDF(mv.filter(m=>tab===3?m.tipo==="ingreso":m.tipo==="gasto"),pz.nom,empresa,tab===3?"Ingresos":"Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab===0&&<ComentariosBlock items={pz.comentarios||[]} onSave={async comentarios=>{await setPiezas((piezas||[]).map(x=>x.id===id?{...x,comentarios}:x));}} onCreateTask={tasksEnabled?async comment=>{const task=normalizeTaskAssignees({id:uid(),empId,cr:today(),titulo:comment.text?.split("\n")[0]?.slice(0,80)||`Seguimiento ${pz.nom}`,desc:comment.text||"",estado:"Pendiente",prioridad:"Media",fechaLimite:"",refTipo:"pz",refId:id,assignedIds:getAssignedIds(comment),asignadoA:getAssignedIds(comment)[0]||""});await setTareas([...(Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"):[]),task]);ntf&&ntf("Comentario guardado y tarea creada ✓");}:null} crewOptions={pCrew} canEdit={_cd&&_cd("contenidos")} title="Comentarios de la Campaña" empresa={empresa} currentUser={user}/>}
    {tab===1&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:14}}>
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Publicadas</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:700,color:"#00e08a"}}>{piezasPub}</div></div>
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Programadas</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:700,color:"var(--cy)"}}>{piezasProgramadas}</div></div>
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>En revisión</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:700,color:"#ffcc44"}}>{piezasRevision}</div></div>
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:12,padding:"12px 14px"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Aprobadas</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:700,color:"#7cffa6"}}>{piezasAprobadas}</div></div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={piezaQ} onChange={v=>setPiezaQ(v)} placeholder="Buscar pieza..."/>
        <FilterSel value={piezaEstado} onChange={setPiezaEstado} options={PIEZA_ESTADOS} placeholder="Todo estados"/>
        <FilterSel value={piezaResp} onChange={setPiezaResp} options={pCrew.map(m=>({value:m.id,label:m.nom}))} placeholder="Todos los responsables"/>
        {_cd&&_cd("contenidos")&&<Btn onClick={()=>openM("pieza",{campId:id,plataforma:pz.plataforma,ini:pz.ini,fin:pz.fin})}>+ Nueva Pieza</Btn>}
      </div>
      <Card>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Pieza</TH><TH>Formato</TH><TH>Responsable</TH><TH>Estado</TH><TH>Aprobación</TH><TH>Publicación</TH><TH>Enlace</TH><TH></TH></tr></thead>
          <tbody>
            {piezasFiltradas.map(pc=><tr key={pc.id}>
              <TD bold><div>{pc.nom}</div><div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{pc.objetivo||pc.plataforma||"—"}</div></TD>
              <TD><Badge label={pc.formato||"Pieza"} color="gray" sm/></TD>
              <TD>{pc.responsableId&&crewMap[pc.responsableId]?crewMap[pc.responsableId].nom:<span style={{color:"var(--gr2)"}}>—</span>}</TD>
              <TD><Badge label={pc.est||"Planificado"}/></TD>
              <TD><Badge label={pc.approval||"Pendiente"} color={(pc.approval||"Pendiente")==="Aprobada"?"green":(pc.approval||"Pendiente")==="Observada"?"red":(pc.approval||"Pendiente")==="En revisión"?"yellow":"gray"} sm/></TD>
              <TD mono style={{fontSize:11}}>{pc.publishDate?fmtD(pc.publishDate):pc.fin?fmtD(pc.fin):"—"}{pc.publishedAt&&<div style={{fontSize:10,color:"#00e08a",marginTop:4}}>Publicado {fmtD(pc.publishedAt)}</div>}</TD>
              <TD style={{fontSize:11}}>
                {pc.link
                  ? <a href={pc.link} target="_blank" rel="noreferrer" style={{color:"var(--cy)",fontWeight:700,textDecoration:"none"}}>Pieza ↗</a>
                  : <span style={{color:"var(--gr2)"}}>—</span>}
              </TD>
              <TD><div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                {_cd&&_cd("contenidos")&&<><GBtn sm onClick={()=>openM("pieza",{...pc,campId:id})}>✏</GBtn><XBtn onClick={()=>deletePiece(pc.id)}/></>}
              </div></TD>
            </tr>)}
            {!piezasFiltradas.length&&<tr><td colSpan={8}><Empty text="Sin piezas" sub="Crea la primera para esta campaña"/></td></tr>}
          </tbody>
        </table></div>
      </Card>
      {!!piezasFiltradas.length&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16}}>
        {piezasFiltradas.slice(0,4).map(pc=><div key={pc.id} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontSize:14,fontWeight:800}}>{pc.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{pc.formato||"Pieza"} · {pc.plataforma||"—"}</div>
            </div>
            <Badge label={pc.est||"Planificado"} sm/>
          </div>
          <div style={{display:"grid",gap:6,fontSize:12,color:"var(--gr3)"}}>
            <div><strong style={{color:"var(--wh)"}}>Responsable:</strong> {pc.responsableId&&crewMap[pc.responsableId]?crewMap[pc.responsableId].nom:"—"}</div>
            <div><strong style={{color:"var(--wh)"}}>Objetivo:</strong> {pc.objetivo||"—"}</div>
            <div><strong style={{color:"var(--wh)"}}>CTA:</strong> {pc.cta||"—"}</div>
            <div><strong style={{color:"var(--wh)"}}>Publicación:</strong> {pc.publishDate?fmtD(pc.publishDate):"—"}</div>
          </div>
        </div>)}
      </div>}
    </div>}
    {tab===2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Calendario editorial" sub="Qué se viene, qué está atrasado y qué ya salió.">
        <div style={{display:"grid",gap:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:800,color:"#ff5566",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Atrasadas</div>
            {editorialAtrasadas.length?editorialAtrasadas.map(pc=><div key={pc.id} style={{padding:"10px 0",borderTop:"1px solid var(--bdr)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700}}>{pc.nom}</div>
                  <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{pc.publishDate?fmtD(pc.publishDate):"—"} · {crewMap[pc.responsableId]?.nom||"Sin responsable"}</div>
                </div>
                <Badge label={pc.est||"Pendiente"} color="red" sm/>
              </div>
            </div>):<div style={{fontSize:12,color:"var(--gr2)"}}>No hay piezas atrasadas.</div>}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:800,color:"var(--cy)",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Próximas publicaciones</div>
            {editorialPendientes.length?editorialPendientes.slice(0,8).map(pc=><div key={pc.id} style={{padding:"10px 0",borderTop:"1px solid var(--bdr)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:700}}>{pc.nom}</div>
                  <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{pc.publishDate?fmtD(pc.publishDate):"—"} · {pc.plataforma||"—"}</div>
                </div>
                <Badge label={pc.approval||"Pendiente"} sm color={(pc.approval||"Pendiente")==="Aprobada"?"green":"gray"}/>
              </div>
            </div>):<div style={{fontSize:12,color:"var(--gr2)"}}>No hay publicaciones próximas.</div>}
          </div>
        </div>
      </Card>
      <Card title="Publicado recientemente" sub="Seguimiento del cierre editorial de la campaña.">
        {editorialPublicadas.length?editorialPublicadas.slice(0,8).map(pc=><div key={pc.id} style={{padding:"10px 0",borderTop:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{pc.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{pc.publishedAt?fmtD(pc.publishedAt):pc.publishDate?fmtD(pc.publishDate):"—"} · {pc.finalLink?"Con link final":"Sin link final"}</div>
            </div>
            {pc.finalLink?<a href={pc.finalLink} target="_blank" rel="noreferrer" style={{fontSize:11,color:"var(--cy)",fontWeight:700,textDecoration:"none"}}>Final ↗</a>:<Badge label="Pendiente link" color="yellow" sm/>}
          </div>
        </div>):<Empty text="Aún no hay piezas publicadas" sub="Cuando publiques contenido, lo verás aquí."/>}
      </Card>
    </div>}
    {tab===3&&<MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pz" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===4&&<MovBlock movimientos={mv} tipo="gasto" eid={id} etype="pz" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===5&&<CrewTab crew={crew||[]} empId={empId} asignados={pz.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("contenidos")} onHonorario={m=>{saveMov({eid:id,et:"pz",tipo:"gasto",cat:"Honorarios",des:"Honorarios "+m.nom,mon:parseTarifa(m.tarifa),fec:today()});}}/>}
    {tab===6&&<MiniCal refId={id} eventos={eventos||[]} onAdd={()=>openM("evento",{ref:id,refTipo:"contenido"})} onEdit={ev=>openM("evento",ev)} onDel={async evId=>{await cSave((eventos||[]).filter(x=>x.id!==evId),()=>{},{});}} canEdit={_cd&&_cd("calendario")} titulo={pz.nom}/>}
    {tab===7&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Datos de la Campaña">
        {[["Cliente",cli?.nom||"—"],["Plataforma",pz.plataforma||"—"],["Mes",pz.mes||"—"],["Año",pz.ano||"—"],["Estado",<Badge key={0} label={pz.est||"Planificada"}/>],["Piezas creadas",countCampaignPieces(pz)],["Piezas mensuales",pz.plannedPieces||countCampaignPieces(pz)]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Timeline">
        {[["Inicio",pz.ini?fmtD(pz.ini):"—"],["Cierre",pz.fin?fmtD(pz.fin):"—"],["Crew",pCrew.length]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {pz.des&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)"}}>{pz.des}</div></>}
      </Card>
    </div>}
    {tasksEnabled&&tab===8&&<TareasContexto title="Tareas de la Campaña" refTipo="pz" refId={id} tareas={Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"&&t.empId===empId):[]} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={_cd&&_cd("contenidos")}/>}
  </div>;
}

function AusCard({a,pgs,onEdit,onDel}){
  return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:16}}>
    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
      <div style={{width:38,height:38,borderRadius:8,background:"var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:12,fontWeight:800,flexShrink:0}}>{ini(a.nom)}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{a.nom}</div><div style={{marginTop:4}}><Badge label={a.tip} sm/></div></div>
      {onEdit&&<GBtn sm onClick={onEdit}>✏</GBtn>}
      {onDel&&<XBtn onClick={onDel}/>}
    </div>
    {(pgs||[]).length>0&&<div style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:4}}>{pgs.map(p=><Badge key={p.id} label={p.nom} color="cyan" sm/>)}</div>}
    {a.con&&<div style={{fontSize:11,color:"var(--gr3)"}}>{a.con}{a.ema?" · "+a.ema:""}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
      {a.mon&&Number(a.mon)>0?<span style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(a.mon)}</span>:<span/>}
      <div style={{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
        {a.vig&&<span style={{fontSize:10,color:"var(--gr2)"}}>hasta {fmtD(a.vig)}</span>}
        {a.frecPago&&<span style={{fontSize:10,color:"var(--gr2)"}}>{a.frecPago}</span>}
      </div>
    </div>
  </div>;
}

// ── EPISODIO DETALLE ──────────────────────────────────────────
function ViewEpDet({id,empresa,user,episodios,programas,movimientos,crew,eventos,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setEpisodios,setMovimientos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const ep=(episodios||[]).find(x=>x.id===id);if(!ep) return <Empty text="No encontrado"/>;
  const pg_=(programas||[]).find(x=>x.id===ep.pgId);
  const mv=(movimientos||[]).filter(m=>m.eid===id);const b=bal(id);
  const [tab,setTab]=useState(0);
  const NEXT={Planificado:"Grabado",Grabado:"En Edición","En Edición":"Programado",Programado:"Publicado"};
  const STATUS=["Planificado","Grabado","En Edición","Programado","Publicado","Cancelado"];
  const changeStatus=async s=>{const next=(episodios||[]).map(x=>x.id===id?{...x,estado:s}:x);await setEpisodios(next);};
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(ep.crewIds||[]).includes(x.id));
  const addCrew=async crId=>{const next=(episodios||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);await setEpisodios(next);};
  const remCrew=async crId=>{const next=(episodios||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setEpisodios(next);};
  return <div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:52,height:52,background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:8,color:"var(--cy)",fontWeight:700,letterSpacing:1}}>EP.</div>
          <div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:"var(--cy)",lineHeight:1}}>{String(ep.num).padStart(2,"0")}</div>
        </div>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:22,fontWeight:800}}>{ep.titulo}</div>
          <div style={{fontSize:12,color:"var(--gr2)",marginTop:4,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {pg_&&<span onClick={()=>navTo("pg-det",pg_.id)} style={{color:"var(--cy)",cursor:"pointer"}}>{pg_.nom}</span>}
            <Badge label={ep.estado}/>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {_cd&&_cd("programas")&&NEXT[ep.estado]&&<Btn onClick={()=>changeStatus(NEXT[ep.estado])}>→ {NEXT[ep.estado]}</Btn>}
        {_cd&&_cd("programas")&&<><GBtn onClick={()=>openM("ep",ep)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(episodios,setEpisodios,id,()=>navTo("pg-det",ep.pgId),"Episodio eliminado");}}>🗑</DBtn></>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Gastos Ep." value={fmtM(b.g)} sub={`${mv.filter(m=>m.tipo==="gasto").length} ítems`} accent="#ff5566" vc="#ff5566"/>
      <Stat label="Grabación"  value={ep.fechaGrab?fmtD(ep.fechaGrab):"—"}   accent="var(--cy)"/>
      <Stat label="Emisión"    value={ep.fechaEmision?fmtD(ep.fechaEmision):"—"} accent="#00e08a"/>
      <Stat label="Duración"   value={ep.duracion?ep.duracion+" min":"—"}/>
    </div>
    <Tabs tabs={["Comentarios","Información","Gastos","Crew"]} active={tab} onChange={setTab}/>
    {tab===0&&<ComentariosBlock items={ep.comentarios||[]} onSave={async comentarios=>{const next=(episodios||[]).map(x=>x.id===id?{...x,comentarios}:x);await setEpisodios(next);}} crewOptions={pCrew} canEdit={_cd&&_cd("programas")} title="Comentarios del Episodio" empresa={empresa} currentUser={user}/>}
    {tab===1&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Datos del Episodio">
        {[["Número","#"+String(ep.num).padStart(2,"0")],["Invitado / Tema",ep.invitado||"—"],["Locación",ep.locacion||"—"],["Descripción",ep.descripcion||"—"],["Notas",ep.notas||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Estado y Fechas">
        {[["Estado",<Badge key={0} label={ep.estado}/>],["Grabación",ep.fechaGrab?fmtD(ep.fechaGrab):"Por confirmar"],["Emisión",ep.fechaEmision?fmtD(ep.fechaEmision):"—"],["Duración",ep.duracion?ep.duracion+" min":"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {_cd&&_cd("programas")&&<><Sep/><div style={{fontSize:11,color:"var(--gr2)",marginBottom:8}}>Cambiar estado:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{STATUS.map(s=><button key={s} onClick={()=>changeStatus(s)} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${ep.estado===s?"var(--cy)":"var(--bdr2)"}`,background:ep.estado===s?"var(--cg)":"transparent",color:ep.estado===s?"var(--cy)":"var(--gr2)",cursor:"pointer",fontSize:10,fontWeight:600}}>{s}</button>)}</div>
        </>}
      </Card>
    </div>}
    {tab===2&&<MovBlock movimientos={mv} tipo="gasto" eid={id} etype="ep" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===3&&<CrewTab crew={crew||[]} empId={empId} asignados={ep.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("programas")}/>}
  </div>;
}

// ── CREW ──────────────────────────────────────────────────────
function ViewCrew({empresa,crew,producciones,programas,navTo,openM,canDo:_cd,cSave,cDel,setCrew,listas}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fa,setFa]=useState("");const [vista,setVista]=useState("list");const [pg,setPg]=useState(1);const PP=10;
  const AREAS=listas?.areasCrew||DEFAULT_LISTAS.areasCrew;
  const fd=(crew||[]).filter(x=>x.empId===empId).filter(c=>(c.nom.toLowerCase().includes(q.toLowerCase())||(c.rol||"").toLowerCase().includes(q.toLowerCase()))&&(!fa||c.area===fa));
  const canEditMember=m=>_cd&&_cd("crew");
  const canDeleteMember=m=>_cd&&_cd("crew")&&!m?.managedByUser;
  const exportCSV=()=>{
    const header="Nombre,Rol,Área,Email,Teléfono,Disponibilidad,Tarifa,Estado";
    const rows=fd.map(m=>[m.nom,m.rol,m.area,m.ema,m.tel,m.dis,m.tarifa,m.active!==false?"Activo":"Inactivo"].map(v=>`"${v||""}"`).join(","));
    const blob=new Blob([[header,...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="crew_produ.csv";a.click();
  };
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar por nombre o rol..."/>
      <FilterSel value={fa} onChange={v=>{setFa(v);setPg(1);}} options={AREAS} placeholder="Todas las áreas"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("crew")&&<Btn onClick={()=>openM("crew",{})}>+ Agregar Miembro</Btn>}
      <GBtn onClick={exportCSV}>⬇ Exportar CSV</GBtn>
    </div>
    <div style={{fontSize:11,color:"var(--gr2)",marginBottom:16}}>El crew interno proviene de `Usuarios`. Desde aquí puedes completar sus datos operativos; para cambiar nombre, cargo o estado base, usa `Panel Administrador &gt; Usuarios`.</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
      {AREAS.slice(0,6).map(a=>{const cnt=(crew||[]).filter(x=>x.empId===empId&&x.area===a).length;return<div key={a} onClick={()=>setFa(fa===a?"":a)} style={{background:"var(--card)",border:`1px solid ${fa===a?"var(--cy)":"var(--bdr)"}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"center"}}><div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:fa===a?"var(--cy)":"var(--wh)"}}>{cnt}</div><div style={{fontSize:9,color:"var(--gr2)",marginTop:2}}>{a}</div></div>;})}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(m=><div key={m.id} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"var(--bg)",flexShrink:0}}>{ini(m.nom)}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800}}>{m.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{m.rol||"Sin rol"}</div>
            </div>
            <Badge label={m.active!==false?"Activo":"Inactivo"} color={m.active!==false?"green":"red"} sm/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <Badge label={m.area||"Sin área"} color="gray" sm/>
            <Badge label={m.tipo==="interno"?"Planta":"Externo"} color={m.tipo==="interno"?"green":"yellow"} sm/>
            {m.managedByUser&&<Badge label="Usuario" color="cyan" sm/>}
          </div>
          <div style={{fontSize:11,color:"var(--gr2)",display:"grid",gap:5}}>
            <span>✉ {m.ema||"—"}</span>
            <span>☎ {m.tel||"—"}</span>
            <span>Disponibilidad: {m.dis||"—"}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"auto",paddingTop:10,borderTop:"1px solid var(--bdr)"}}>
            <span style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{m.tarifa||"—"}</span>
            <div style={{display:"flex",gap:4}}>
              {canEditMember(m)&&<GBtn sm onClick={()=>openM("crew",m)}>✏</GBtn>}
              {canDeleteMember(m)&&<XBtn onClick={()=>cDel(crew,setCrew,m.id,null,"Miembro eliminado")}/>}
            </div>
          </div>
        </div>)}
      </div>
      {!fd.length&&<Empty text="Sin miembros" sub={_cd&&_cd("crew")?"Agrega el primero arriba":""}/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Rol</TH><TH>Área</TH><TH>Email</TH><TH>Teléfono</TH><TH>Disponibilidad</TH><TH>Tarifa</TH><TH>Estado</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(m=><tr key={m.id}>
            <TD bold><div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(m.nom)}</div>{m.nom}
            </div></TD>
            <TD>{m.rol||"—"}</TD><TD><Badge label={m.area||"—"} color="gray" sm/> <Badge label={m.tipo==="interno"?"Planta":"Externo"} color={m.tipo==="interno"?"green":"yellow"} sm/> {m.managedByUser&&<Badge label="Usuario" color="cyan" sm/>}</TD>
            <TD style={{fontSize:11}}>{m.ema||"—"}</TD><TD style={{fontSize:11}}>{m.tel||"—"}</TD>
            <TD style={{fontSize:11,color:"var(--gr2)"}}>{m.dis||"—"}</TD>
            <TD mono style={{fontSize:11}}>{m.tarifa||"—"}</TD>
            <TD><Badge label={m.active!==false?"Activo":"Inactivo"} color={m.active!==false?"green":"red"} sm/></TD>
            <TD><div style={{display:"flex",gap:4}}>
              {canEditMember(m)&&<GBtn sm onClick={()=>openM("crew",m)}>✏</GBtn>}
              {canDeleteMember(m)&&<XBtn onClick={()=>cDel(crew,setCrew,m.id,null,"Miembro eliminado")}/>}
            </div></TD>
          </tr>)}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin miembros" sub={_cd&&_cd("crew")?"Agrega el primero arriba":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

// ── AUSPICIADORES ─────────────────────────────────────────────
function ViewAus({empresa,auspiciadores,programas,openM,canDo:_cd,cSave,cDel,setAuspiciadores,listas}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [ft,setFt]=useState("");const [fp,setFp]=useState("");const [vista,setVista]=useState("cards");const [pg,setPg]=useState(1);const PP=9;
  const fd=(auspiciadores||[]).filter(x=>x.empId===empId).filter(a=>(a.nom.toLowerCase().includes(q.toLowerCase())||(a.con||"").toLowerCase().includes(q.toLowerCase()))&&(!ft||a.tip===ft)&&(!fp||(a.pids||[]).includes(fp)));
  const pgOpts=(programas||[]).filter(x=>x.empId===empId).map(p=>({value:p.id,label:p.nom}));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar auspiciador..."/>
      <FilterSel value={ft} onChange={v=>{setFt(v);setPg(1);}} options={listas?.tiposAus||DEFAULT_LISTAS.tiposAus} placeholder="Todo tipos"/>
      <FilterSel value={fp} onChange={v=>{setFp(v);setPg(1);}} options={pgOpts} placeholder="Todas producciones"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("auspiciadores")&&<Btn onClick={()=>openM("aus",{})}>+ Nuevo Auspiciador</Btn>}
    </div>
    {vista==="cards"?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
      {fd.slice((pg-1)*PP,pg*PP).map(a=>{
        const pgs=(a.pids||[]).map(pid=>(programas||[]).find(x=>x.id===pid)).filter(Boolean);
        return <AusCard key={a.id} a={a} pgs={pgs} onEdit={_cd&&_cd("auspiciadores")?()=>openM("aus",a):null} onDel={_cd&&_cd("auspiciadores")?()=>cDel(auspiciadores,setAuspiciadores,a.id,null,"Auspiciador eliminado"):null}/>;
      })}
    </div>:<Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Auspiciador</TH><TH>Tipo</TH><TH>Producciones</TH><TH>Contacto</TH><TH>Monto</TH><TH>Vigencia</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(a=>{const pgs=(a.pids||[]).map(pid=>(programas||[]).find(x=>x.id===pid)?.nom).filter(Boolean);return <tr key={a.id}>
            <TD bold>{a.nom}</TD>
            <TD><Badge label={a.tip} sm/></TD>
            <TD style={{fontSize:11}}>{pgs.join(", ")||"—"}</TD>
            <TD style={{fontSize:11}}>{[a.con,a.ema].filter(Boolean).join(" · ")||"—"}</TD>
            <TD style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{a.mon?fmtM(a.mon):"—"}</TD>
            <TD style={{fontSize:11}}>{a.vig?fmtD(a.vig):"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>{_cd&&_cd("auspiciadores")&&<><GBtn sm onClick={()=>openM("aus",a)}>✏</GBtn><XBtn onClick={()=>cDel(auspiciadores,setAuspiciadores,a.id,null,"Auspiciador eliminado")}/></>}</div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={7}><Empty text="Sin auspiciadores"/></td></tr>}
        </tbody>
      </table></div>
    </Card>}
    {!fd.length&&vista==="cards"&&<Empty text="Sin auspiciadores"/>}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
  </div>;
}

// ── CONTRATOS ─────────────────────────────────────────────────
function ViewCts({empresa,contratos,clientes,presupuestos,facturas,openM,canDo:_cd,cSave,cDel,setContratos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [vista,setVista]=useState("list");const [pg,setPg]=useState(1);const PP=10;
  const fd=(contratos||[]).filter(x=>x.empId===empId).filter(c=>c.nom.toLowerCase().includes(q.toLowerCase())&&(!fe||contractVisualState(c)===fe||c.est===fe));
  const vigentes=fd.filter(ct=>contractVisualState(ct)==="Vigente").length;
  const porVencer=fd.filter(ct=>contractVisualState(ct)==="Por vencer").length;
  const vencidos=fd.filter(ct=>contractVisualState(ct)==="Vencido").length;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total Contratos" value={fd.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Vigentes" value={vigentes} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Por vencer" value={porVencer} accent="#ffcc44" vc="#ffcc44"/>
      <Stat label="Vencidos" value={vencidos} accent="#ff5566" vc="#ff5566"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar contrato..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","En Revisión","Firmado","Vigente","Vencido"]} placeholder="Todo estados"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("contratos")&&<Btn onClick={()=>openM("ct",{})}>+ Nuevo Contrato</Btn>}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(ct=>{const c=(clientes||[]).find(x=>x.id===ct.cliId);const vinculos=[(ct.pids||[]).length && `${(ct.pids||[]).length} vínculo${(ct.pids||[]).length===1?"":"s"}`,ct.presupuestoId && `${(presupuestos||[]).filter(p=>p.id===ct.presupuestoId).length} presupuesto`,(ct.facturaIds||[]).length && `${(ct.facturaIds||[]).length} factura${(ct.facturaIds||[]).length===1?"":"s"}`].filter(Boolean).join(" · ");return <div key={ct.id} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,lineHeight:1.25}}>{ct.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{c?.nom||"Sin cliente"}</div>
            </div>
            <Badge label={contractVisualState(ct)}/>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <Badge label={ct.tip||"Sin tipo"} color="gray" sm/>
            {ct.vig&&<Badge label={`Vig. ${fmtD(ct.vig)}`} color="cyan" sm/>}
          </div>
          <div style={{fontSize:11,color:"var(--gr2)"}}>{vinculos||"Sin vínculos"}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"auto",paddingTop:10,borderTop:"1px solid var(--bdr)"}}>
            <span style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{ct.mon?fmtM(ct.mon):"—"}</span>
            <div style={{display:"flex",gap:4}}>{_cd&&_cd("contratos")&&<><GBtn sm onClick={()=>openM("ct",ct)}>✏</GBtn><XBtn onClick={()=>cDel(contratos,setContratos,ct.id,null,"Contrato eliminado")}/></>}</div>
          </div>
        </div>;})}
      </div>
      {!fd.length&&<Empty text="Sin contratos"/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Contrato</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH>Monto</TH><TH>Vigencia</TH><TH>Conexiones</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(ct=>{const c=(clientes||[]).find(x=>x.id===ct.cliId);return<tr key={ct.id}>
            <TD bold>{ct.nom}</TD><TD>{c?c.nom:"—"}</TD><TD><Badge label={ct.tip} color="gray" sm/></TD><TD><Badge label={contractVisualState(ct)}/></TD>
            <TD mono style={{fontSize:12}}>{ct.mon?fmtM(ct.mon):"—"}</TD>
            <TD mono style={{fontSize:11}}>{ct.vig?fmtD(ct.vig):"—"}</TD>
            <TD style={{fontSize:11,color:"var(--gr2)"}}>
              {[
                (ct.pids||[]).length && `${(ct.pids||[]).length} vinc.`,
                ct.presupuestoId && `${(presupuestos||[]).filter(p=>p.id===ct.presupuestoId).length} pres.`,
                (ct.facturaIds||[]).length && `${(ct.facturaIds||[]).length} fact.`
              ].filter(Boolean).join(" · ") || "Sin vínculos"}
            </TD>
            <TD><div style={{display:"flex",gap:4}}>{_cd&&_cd("contratos")&&<><GBtn sm onClick={()=>openM("ct",ct)}>✏</GBtn><XBtn onClick={()=>cDel(contratos,setContratos,ct.id,null,"Contrato eliminado")}/></>}</div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin contratos"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

// ── CALENDARIO ────────────────────────────────────────────────
function ViewCalendario({empresa,user,tareas,crew,clientes,auspiciadores,episodios,programas,piezas,producciones,eventos,facturas,contratos,openM,canDo:_cd,cSave,cDel,setEventos,ntf}){
  const empId=empresa?.id;
  const tasksEnabled=hasAddon(empresa,"tareas");
  const [mes,setMes]=useState(()=>{const h=new Date();return{y:h.getFullYear(),m:h.getMonth()};});
  const [filtro,setFiltro]=useState("todos");
  const [diaSelec,setDiaSelec]=useState(null);
  const [vistaLista,setVistaLista]=useState(false);
  const [subTab,setSubTab]=useState(0);
  const [filtroModulo,setFiltroModulo]=useState("");
  const [filtroResponsable,setFiltroResponsable]=useState("");
  const [filtroEstado,setFiltroEstado]=useState("");
  const [filtroCliente,setFiltroCliente]=useState("");
  const DIAS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const addMes=delta=>setMes(prev=>{let m=prev.m+delta,y=prev.y;if(m>11){m=0;y++;}if(m<0){m=11;y--; }return{y,m};});
  const TIPOS=[{v:"grabacion",ico:"🎬",lbl:"Grabación",c:"var(--cy)"},{v:"emision",ico:"📡",lbl:"Emisión",c:"#00e08a"},...(tasksEnabled?[{v:"tarea",ico:"✅",lbl:"Tarea",c:"#7c5cff"}]:[]),{v:"entrega",ico:"✓",lbl:"Entrega",c:"#ff8844"},{v:"cobranza",ico:"💸",lbl:"Cobranza",c:"#ff5566"},{v:"estreno",ico:"🌟",lbl:"Publicado",c:"#22c55e"},{v:"reunion",ico:"💬",lbl:"Reunión",c:"#ffcc44"},{v:"otro",ico:"📌",lbl:"Otro",c:"#7c7c8a"}];
  const tc=v=>TIPOS.find(t=>t.v===v)?.c||"#7c7c8a";
  const ti=v=>TIPOS.find(t=>t.v===v)?.ico||"📌";
  const moduloLabel = ev => ({pro:"Proyecto",pg:"Producción",ep:"Episodio",pz:"Contenidos",cal:"Evento",task:"Tarea",billing:"Cobranza",contract:"Contrato"})[ev.modulo]||"General";
  const safeTasks = tasksEnabled && Array.isArray(tareas) ? tareas.filter(t=>t&&t.empId===empId) : [];
  const crewMap = Object.fromEntries((crew||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const editCalItem=ev=>{
    if(!ev||!(_cd&&_cd("calendario"))) return;
    if(ev.task){
      openM("tarea",safeTasks.find(t=>t.id===ev.sourceId)||{id:ev.sourceId});
      return;
    }
    if(ev.custom){
      const original=(eventos||[]).find(x=>x.id===ev.id);
      if(original) openM("evento",original);
      return;
    }
    if(ev.editModal==="pro"){
      const pro=(producciones||[]).find(x=>x.id===ev.sourceId);
      if(pro) openM("pro",pro);
      return;
    }
    if(ev.editModal==="ep"){
      const ep=(episodios||[]).find(x=>x.id===ev.sourceId);
      if(ep) openM("ep",ep);
      return;
    }
    if(ev.editModal==="contenido"){
      const contenido=(piezas||[]).find(x=>x.id===ev.sourceId);
      if(contenido) openM("contenido",contenido);
    }
  };
  const todosEvs=[];
  (eventos||[]).filter(e=>e.empId===empId).forEach(ev=>{
    if(!ev.fecha) return;
    const d=new Date(ev.fecha+"T12:00:00");
    if(d.getFullYear()===mes.y&&d.getMonth()===mes.m){
      const ref=ev.refTipo==="produccion"
        ? (producciones||[]).find(x=>x.id===ev.ref)
        : (ev.refTipo==="pieza"||ev.refTipo==="contenido")
          ? (piezas||[]).find(x=>x.id===ev.ref)
          : (programas||[]).find(x=>x.id===ev.ref);
      todosEvs.push({id:ev.id,fecha:ev.fecha,dia:d.getDate(),tipo:ev.tipo,label:`${ti(ev.tipo)} ${ev.titulo}`,sub:ref?ref.nom:"Sin vinculación",color:tc(ev.tipo),hora:ev.hora||"",custom:true,desc:ev.desc||"",modulo:"cal",estado:"Programado"});
    }
  });
  (episodios||[]).filter(e=>e.empId===empId).forEach(ep=>{
    const pg=(programas||[]).find(x=>x.id===ep.pgId);
    if(ep.fechaGrab){const d=new Date(ep.fechaGrab+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:ep.id+"_g",fecha:ep.fechaGrab,dia:d.getDate(),tipo:"grabacion",label:`🎬 Ep.${ep.num}: ${ep.titulo}`,sub:pg?.nom||"",color:"var(--cy)",hora:"",auto:true,editModal:"ep",sourceId:ep.id,modulo:"ep",estado:ep.estado||"Planificado"});}
    if(ep.fechaEmision){const d=new Date(ep.fechaEmision+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:ep.id+"_e",fecha:ep.fechaEmision,dia:d.getDate(),tipo:"emision",label:`📡 Ep.${ep.num}: ${ep.titulo}`,sub:pg?.nom||"",color:"#00e08a",hora:"",auto:true,editModal:"ep",sourceId:ep.id,modulo:"ep",estado:ep.estado||"Programado"});}
  });
  (producciones||[]).filter(p=>p.empId===empId).forEach(p=>{
    if(p.ini){const d=new Date(p.ini+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:p.id+"_ini",fecha:p.ini,dia:d.getDate(),tipo:"otro",label:`▶ Inicio: ${p.nom}`,sub:"Proyecto",color:"#a855f7",hora:"",auto:true,editModal:"pro",sourceId:p.id,modulo:"pro",estado:p.est||"En Curso",clienteId:p.cliId||""});}
    if(p.fin){const d=new Date(p.fin+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:p.id+"_fin",fecha:p.fin,dia:d.getDate(),tipo:"entrega",label:`✓ Entrega: ${p.nom}`,sub:"Proyecto",color:"#ff8844",hora:"",auto:true,editModal:"pro",sourceId:p.id,modulo:"pro",estado:p.est||"En Curso",clienteId:p.cliId||""});}
  });
  (piezas||[]).filter(p=>p.empId===empId).forEach(c=>{
    if(c.ini){const d=new Date(c.ini+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:c.id+"_ini",fecha:c.ini,dia:d.getDate(),tipo:"otro",label:`📱 Inicio campaña: ${c.nom}`,sub:"Contenidos",color:"#a855f7",hora:"",auto:true,editModal:"contenido",sourceId:c.id,modulo:"pz",estado:c.est||"Planificada",clienteId:c.cliId||""});}
    if(c.fin){const d=new Date(c.fin+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:c.id+"_fin",fecha:c.fin,dia:d.getDate(),tipo:"entrega",label:`✓ Cierre campaña: ${c.nom}`,sub:"Contenidos",color:"#ff8844",hora:"",auto:true,editModal:"contenido",sourceId:c.id,modulo:"pz",estado:c.est||"Planificada",clienteId:c.cliId||""});}
    (c.piezas||[]).forEach(pc=>{
      if(pc.fin){
        const d=new Date(pc.fin+"T12:00:00");
        if(d.getFullYear()===mes.y&&d.getMonth()===mes.m) todosEvs.push({id:pc.id+"_fin",fecha:pc.fin,dia:d.getDate(),tipo:pc.est==="Publicado"?"estreno":"entrega",label:`📌 ${pc.nom}`,sub:c.nom,color:pc.est==="Publicado"?"#00e08a":"#ff8844",hora:"",auto:true,modulo:"pz",estado:pc.est||"",clienteId:c.cliId||""});
      }
    });
  });
  (safeTasks||[]).forEach(t=>{
    if(!t.fechaLimite) return;
    const d=new Date(t.fechaLimite+"T12:00:00");
    if(d.getFullYear()===mes.y&&d.getMonth()===mes.m){
      const refLabel = t.refTipo==="pro"
        ? (producciones||[]).find(x=>x.id===t.refId)?.nom
        : t.refTipo==="pg"
          ? (programas||[]).find(x=>x.id===t.refId)?.nom
          : t.refTipo==="pz"
            ? (piezas||[]).find(x=>x.id===t.refId)?.nom
            : t.refTipo==="crew"
              ? (crew||[]).find(x=>x.id===t.refId)?.nom
              : "";
      const assignedNames = assignedNameList(t, crew, user);
      const primaryAssigned = getAssignedIds(t)[0] || "";
      todosEvs.push({id:`task_${t.id}`,fecha:t.fechaLimite,dia:d.getDate(),tipo:"tarea",label:`✅ ${t.titulo}`,sub:refLabel||"Sin vínculo",color:"#7c5cff",hora:"",task:true,sourceId:t.id,modulo:"task",estado:t.estado||"Pendiente",responsableId:primaryAssigned,responsable:assignedNames.join(", "),desc:t.desc||""});
    }
  });
  const facturasEmp=(facturas||[]).filter(f=>f.empId===empId);
  const contratosEmp=(contratos||[]).filter(c=>c.empId===empId);
  const cobranzaItems=facturasEmp.filter(f=>f.fechaVencimiento).map(f=>{
    const estado=cobranzaState(f);
    const entidad = f.tipo==="auspiciador"
      ? (auspiciadores||[]).find(a=>a.id===f.entidadId)?.nom
      : (clientes||[]).find(c=>c.id===f.entidadId)?.nom;
    return {...f,estadoCobranza:estado,entidad:entidad||"Sin entidad"};
  }).sort((a,b)=>(a.fechaVencimiento||"").localeCompare(b.fechaVencimiento||""));
  const dueInvoices = cobranzaItems.filter(f=>f.fechaVencimiento).map(f=>{
    const d=new Date(f.fechaVencimiento+"T12:00:00");
    if(d.getFullYear()!==mes.y||d.getMonth()!==mes.m) return null;
    return {id:`bill_${f.id}`,fecha:f.fechaVencimiento,dia:d.getDate(),tipo:"cobranza",label:`💸 ${f.correlativo||f.tipoDoc||"Invoice"}`,sub:f.entidad,color:"#ff5566",hora:"",modulo:"billing",estado:f.estadoCobranza,clienteId:f.tipo==="cliente"?f.entidadId:"",desc:fmtM(f.total||0)};
  }).filter(Boolean);
  const dueContracts = contratosEmp.filter(ct=>ct.vig).map(ct=>{
    const d=new Date(ct.vig+"T12:00:00");
    if(d.getFullYear()!==mes.y||d.getMonth()!==mes.m) return null;
    return {id:`ct_${ct.id}`,fecha:ct.vig,dia:d.getDate(),tipo:"cobranza",label:`📄 ${ct.nom}`,sub:"Vigencia contrato",color:"#f59e0b",hora:"",modulo:"contract",estado:contractVisualState(ct),clienteId:ct.cliId||"",desc:ct.not||""};
  }).filter(Boolean);
  todosEvs.push(...dueInvoices,...dueContracts);
  const eventosFiltrados=todosEvs.filter(e=>
    (filtro==="todos"||e.tipo===filtro) &&
    (!filtroModulo||e.modulo===filtroModulo) &&
    (!filtroResponsable||e.responsableId===filtroResponsable) &&
    (!filtroEstado||String(e.estado||"")===filtroEstado) &&
    (!filtroCliente||e.clienteId===filtroCliente)
  );
  const evFiltrados=eventosFiltrados;
  const primerDia=new Date(mes.y,mes.m,1).getDay();
  const diasMes=new Date(mes.y,mes.m+1,0).getDate();
  const hoy=new Date();
  const hoyStr=today();
  const esHoy=d=>hoy.getFullYear()===mes.y&&hoy.getMonth()===mes.m&&hoy.getDate()===d;
  const celdas=[];for(let i=0;i<primerDia;i++)celdas.push(null);for(let d=1;d<=diasMes;d++)celdas.push(d);
  const evsDelDia=d=>evFiltrados.filter(e=>e.dia===d).sort((a,b)=>(a.hora||"").localeCompare(b.hora||""));
  const evsDiaSel=diaSelec?evFiltrados.filter(e=>e.dia===diaSelec):[];
  const proximos=[...evFiltrados].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||"") || (a.hora||"").localeCompare(b.hora||""));
  const agendaHoy=proximos.filter(ev=>ev.fecha===hoyStr);
  const agendaSemana=proximos.filter(ev=>ev.fecha>=hoyStr).slice(0,8);
  const programacion=proximos.filter(ev=>["grabacion","emision","entrega","estreno"].includes(ev.tipo));
  const agendaEquipo=proximos.filter(ev=>ev.tipo==="tarea");
  const hitosCriticos=proximos.filter(ev=>ev.tipo==="cobranza" || ev.estado==="En Revisión" || ev.estado==="Retrasado de pago").slice(0,8);
  const contratosPorVencer=contratosEmp.filter(ct=>ct.vig && ct.vig>=hoyStr).sort((a,b)=>(a.vig||"").localeCompare(b.vig||"")).slice(0,6);
  const estadoOptions = Array.from(new Set(todosEvs.map(ev=>ev.estado).filter(Boolean)));
  const delEvento=async evId=>{ await cDel(eventos,setEventos,evId,null,"Evento eliminado"); };
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,flexWrap:"wrap",marginBottom:18}}>
      <div>
        <div style={{fontFamily:"var(--fh)",fontSize:22,fontWeight:800}}>Calendario Operativo</div>
        <div style={{fontSize:12,color:"var(--gr2)",marginTop:4}}>Programación, agenda del equipo y vencimientos en un solo lugar.</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        {_cd&&_cd("calendario")&&<Btn onClick={()=>openM("evento",{})} sm>+ Nuevo Evento</Btn>}
      </div>
    </div>

    <Tabs tabs={["Agenda","Calendario","Programación","Cobranza"]} active={subTab} onChange={setSubTab}/>
    <Card title="Filtros operativos" sub="Afina la lectura por tipo, módulo, responsable, estado o cliente." style={{marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:10}}>
        <FilterSel value={filtroModulo} onChange={setFiltroModulo} placeholder="Todos los módulos" options={[
          {value:"pro",label:"Proyectos"},
          {value:"pg",label:"Producciones"},
          {value:"ep",label:"Episodios"},
          {value:"pz",label:"Contenidos"},
          ...(tasksEnabled?[{value:"task",label:"Tareas"}]:[]),
          {value:"billing",label:"Cobranza"},
          {value:"contract",label:"Contratos"},
          {value:"cal",label:"Eventos manuales"},
        ]}/>
        <FilterSel value={filtroResponsable} onChange={setFiltroResponsable} placeholder="Todos los responsables" options={(crew||[]).filter(c=>c.empId===empId).map(c=>({value:c.id,label:c.nom}))}/>
        <FilterSel value={filtroEstado} onChange={setFiltroEstado} placeholder="Todos los estados" options={estadoOptions}/>
        <FilterSel value={filtroCliente} onChange={setFiltroCliente} placeholder="Todos los clientes" options={(clientes||[]).filter(c=>c.empId===empId).map(c=>({value:c.id,label:c.nom}))}/>
        <FilterSel value={filtro} onChange={setFiltro} placeholder="Todos los tipos" options={TIPOS.map(t=>({value:t.v,label:`${t.ico} ${t.lbl}`}))}/>
      </div>
    </Card>

    {subTab===0&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["Hoy",agendaHoy.length,"var(--cy)"],["Próx. 7 días",agendaSemana.length,"#00e08a"],["Equipo",agendaEquipo.length,"#7c5cff"],["Críticos",hitosCriticos.length,"#ff5566"]].map(([l,v,c])=><Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr .8fr",gap:16}}>
        <Card title="Próximos eventos">
          {agendaSemana.length?agendaSemana.map(ev=><div key={ev.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bdr)",alignItems:"flex-start"}}>
            <div style={{width:44,height:44,borderRadius:10,background:ev.color+"20",border:`1px solid ${ev.color}35`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <div style={{fontSize:14}}>{ti(ev.tipo)}</div>
              <div style={{fontSize:9,fontFamily:"var(--fm)",fontWeight:700,color:ev.color}}>{ev.fecha?fmtD(ev.fecha).split(" ").slice(0,2).join(" "):"--"}</div>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700}}>{ev.label}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.sub}{ev.hora?` · ${ev.hora}`:""} · {moduloLabel(ev)}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                {ev.estado&&<Badge label={ev.estado} color={ev.tipo==="cobranza"?"red":"gray"} sm/>}
                {ev.responsable&&<Badge label={ev.responsable} color="purple" sm/>}
              </div>
              {ev.desc&&<div style={{fontSize:11,color:"var(--gr3)",marginTop:4}}>{ev.desc}</div>}
            </div>
            {_cd&&_cd("calendario")&&<GBtn sm onClick={()=>editCalItem(ev)}>Abrir</GBtn>}
          </div>):<Empty text="Sin eventos próximos" sub="Cuando programes fechas, aparecerán aquí."/>}
        </Card>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Card title="Hoy">
            {agendaHoy.length?agendaHoy.map(ev=><div key={ev.id} style={{display:"flex",justifyContent:"space-between",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:ev.color}}>{ev.label}</div>
                <div style={{fontSize:11,color:"var(--gr2)"}}>{ev.sub} · {moduloLabel(ev)}</div>
              </div>
              {ev.hora&&<Badge label={ev.hora} color="gray" sm/>}
            </div>):<Empty text="Nada programado hoy"/>}
          </Card>
          <Card title="Hitos críticos">
            {hitosCriticos.length?hitosCriticos.map(ev=><div key={ev.id} style={{padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
              <div style={{fontSize:12,fontWeight:700,color:ev.color}}>{ev.label}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.sub} · {ev.fecha?fmtD(ev.fecha):"Sin fecha"}</div>
            </div>):<Empty text="Sin hitos críticos"/>}
          </Card>
          <Card title="Acciones rápidas">
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {_cd&&_cd("calendario")&&<Btn onClick={()=>openM("evento",{})} sm>Crear evento manual</Btn>}
              {_cd&&_cd("calendario")&&<GBtn onClick={()=>{setSubTab(1);setVistaLista(false);}} sm>Ver mes completo</GBtn>}
              <GBtn onClick={()=>setSubTab(2)} sm>Ir a Programación</GBtn>
              <GBtn onClick={()=>setSubTab(3)} sm>Revisar Cobranza</GBtn>
            </div>
          </Card>
        </div>
      </div>
    </>}

    {subTab===1&&<>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>addMes(-1)} style={{width:36,height:36,borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:18}}>‹</button>
          <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,minWidth:190,textAlign:"center"}}>{MESES[mes.m]} {mes.y}</div>
          <button onClick={()=>addMes(1)}  style={{width:36,height:36,borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:18}}>›</button>
          <button onClick={()=>setMes({y:hoy.getFullYear(),m:hoy.getMonth()})} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:600}}>Hoy</button>
          <button onClick={()=>setVistaLista(!vistaLista)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--bdr2)",background:vistaLista?"var(--cg)":"transparent",color:vistaLista?"var(--cy)":"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:600}}>{vistaLista?"📅 Grilla":"☰ Lista"}</button>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          {["todos",...TIPOS.map(t=>t.v)].map(v=><button key={v} onClick={()=>setFiltro(v)} style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${filtro===v?tc(v):"var(--bdr2)"}`,background:filtro===v?tc(v)+"22":"transparent",color:filtro===v?tc(v):"var(--gr3)",cursor:"pointer",fontSize:10,fontWeight:600}}>{v==="todos"?"Todos":ti(v)+" "+TIPOS.find(t=>t.v===v)?.lbl}</button>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[["Total",evFiltrados.length,"var(--cy)"],["Grabaciones",evFiltrados.filter(e=>e.tipo==="grabacion").length,"var(--cy)"],["Emisiones",evFiltrados.filter(e=>e.tipo==="emision").length,"#00e08a"],["Reuniones+",evFiltrados.filter(e=>!["grabacion","emision"].includes(e.tipo)).length,"#ffcc44"]].map(([l,v,c])=><Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,alignItems:"start"}}>
        {!vistaLista?<div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--bdr)"}}>{DIAS.map(d=><div key={d} style={{padding:"10px 0",textAlign:"center",fontSize:11,fontWeight:600,color:"var(--gr2)",letterSpacing:1}}>{d}</div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
            {celdas.map((d,i)=>{const evs=d?evsDelDia(d):[];const isTod=d&&esHoy(d);const isSel=d&&diaSelec===d;return(
              <div key={i} onClick={()=>d&&setDiaSelec(diaSelec===d?null:d)} style={{minHeight:90,padding:"5px 3px",borderRight:i%7!==6?"1px solid var(--bdr)":"none",borderBottom:"1px solid var(--bdr)",background:isSel?"var(--am)":isTod?"var(--cg)":"transparent",cursor:d?"pointer":"default",transition:".1s"}}>
                {d&&<><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3,padding:"0 2px"}}>
                  <span style={{fontSize:12,fontWeight:isTod||isSel?700:400,color:isTod||isSel?"var(--cy)":"var(--gr3)"}}>{d}</span>
                  {_cd&&_cd("calendario")&&<span onClick={e=>{e.stopPropagation();openM("evento",{fecha:`${mes.y}-${String(mes.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`});}} style={{fontSize:10,color:"var(--gr)",cursor:"pointer",opacity:.6}}>+</span>}
                </div>
                {evs.slice(0,3).map(ev=><div key={ev.id} onClick={e=>{e.stopPropagation();if(_cd&&_cd("calendario")) editCalItem(ev);}} style={{fontSize:9,padding:"2px 4px",borderRadius:3,marginBottom:2,background:ev.color+"25",color:ev.color,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:_cd&&_cd("calendario")?"pointer":"default"}} title={(_cd&&_cd("calendario")?"Clic para editar · ":"")+ev.label+" · "+ev.sub+(ev.hora?" · "+ev.hora:"")}>{ev.hora?<span style={{opacity:.7}}>{ev.hora} </span>:""}{ev.label}</div>)}
                {evs.length>3&&<div style={{fontSize:9,color:"var(--gr2)",padding:"0 2px"}}>+{evs.length-3} más</div>}</>}
              </div>
            );})}
          </div>
        </div>:
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20}}>
          <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700,marginBottom:16}}>Todos los eventos — {MESES[mes.m]} {mes.y}</div>
          {proximos.length>0?proximos.map(ev=><div key={ev.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)",alignItems:"flex-start"}}>
            <div style={{width:44,height:44,borderRadius:8,background:ev.color+"22",border:`1px solid ${ev.color}40`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:14}}>{ti(ev.tipo)}</span>
              <span style={{fontSize:9,fontFamily:"var(--fm)",fontWeight:700,color:ev.color}}>{String(ev.dia).padStart(2,"0")}</span>
            </div>
            <div style={{flex:1,minWidth:0,cursor:_cd&&_cd("calendario")?"pointer":"default"}} onClick={()=>_cd&&_cd("calendario")&&editCalItem(ev)}><div style={{fontSize:13,fontWeight:600}}>{ev.label}</div><div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.sub}{ev.hora?" · "+ev.hora:""} · {moduloLabel(ev)}</div>{ev.desc&&<div style={{fontSize:11,color:"var(--gr3)",marginTop:3}}>{ev.desc}</div>}</div>
            {_cd&&_cd("calendario")&&<div style={{display:"flex",gap:4,alignItems:"flex-start"}}><GBtn sm onClick={()=>editCalItem(ev)}>✏</GBtn>{ev.custom&&<XBtn onClick={()=>delEvento(ev.id)}/>}</div>}
          </div>):<Empty text="Sin eventos este mes"/>}
        </div>}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {diaSelec&&<div style={{background:"var(--card)",border:"1px solid var(--cy)",borderRadius:10,padding:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700}}>{diaSelec} de {MESES[mes.m]}</div>
              {_cd&&_cd("calendario")&&<GBtn sm onClick={()=>openM("evento",{fecha:`${mes.y}-${String(mes.m+1).padStart(2,"0")}-${String(diaSelec).padStart(2,"0")}`})}>+ Agregar</GBtn>}
            </div>
            {evsDiaSel.length>0?evsDiaSel.map(ev=><div key={ev.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bdr)",alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{ti(ev.tipo)}</span>
              <div style={{flex:1,minWidth:0,cursor:_cd&&_cd("calendario")?"pointer":"default"}} onClick={()=>_cd&&_cd("calendario")&&editCalItem(ev)}><div style={{fontSize:12,fontWeight:600,color:ev.color}}>{ev.label.replace(/^[^\s]+\s/,"")}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ev.sub}{ev.hora?" · "+ev.hora:""} · {moduloLabel(ev)}</div>{ev.desc&&<div style={{fontSize:11,color:"var(--gr3)",marginTop:2}}>{ev.desc}</div>}</div>
              {_cd&&_cd("calendario")&&<div style={{display:"flex",gap:4,alignItems:"flex-start"}}><GBtn sm onClick={()=>editCalItem(ev)}>✏</GBtn>{ev.custom&&<XBtn onClick={()=>delEvento(ev.id)}/>}</div>}
            </div>):<Empty text="Sin eventos este día" sub="Clic en '+' para agregar"/>}
          </div>}
          <Card title="Próximos" sub={`${MESES[mes.m]} ${mes.y}`}>
            {proximos.slice(0,8).map(ev=><div key={ev.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bdr)",alignItems:"center"}}>
              <div style={{width:26,height:26,borderRadius:6,background:ev.color+"22",border:`1px solid ${ev.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:"var(--fm)",fontSize:10,fontWeight:700,color:ev.color}}>{String(ev.dia).padStart(2,"0")}</span></div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.label}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{ev.sub} · {moduloLabel(ev)}</div></div>
            </div>)}
            {!proximos.length&&<Empty text="Sin eventos"/>}
          </Card>
          <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:16}}>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:10}}>Leyenda</div>
            {TIPOS.map(t=><div key={t.v} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><div style={{width:10,height:10,borderRadius:3,background:t.c,flexShrink:0}}/><span style={{fontSize:11,color:"var(--gr3)"}}>{t.ico} {t.lbl}</span></div>)}
          </div>
        </div>
      </div>
    </>}

    {subTab===2&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Grabaciones y emisiones" sub="Vista operativa para producción y post.">
        {programacion.length?programacion.map(ev=><div key={ev.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:ev.color}}>{ev.label}</div>
            <div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.sub} · {ev.fecha?fmtD(ev.fecha):"Sin fecha"}</div>
          </div>
          <Badge label={TIPOS.find(t=>t.v===ev.tipo)?.lbl||"Evento"} color={ev.tipo==="grabacion"?"cyan":ev.tipo==="emision"?"green":ev.tipo==="entrega"?"orange":"purple"} sm/>
        </div>):<Empty text="Sin hitos de programación"/>}
      </Card>
      <Card title="Agenda del equipo">
        {agendaEquipo.length?agendaEquipo.slice(0,8).map(ev=><div key={ev.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:ev.color}}>{ev.label}</div>
            <div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.responsable||"Sin asignar"} · {ev.fecha?fmtD(ev.fecha):"Sin fecha"}</div>
          </div>
          <Badge label={ev.estado||"Pendiente"} color="purple" sm/>
        </div>):<Empty text="Sin tareas con fecha límite"/>}
      </Card>
      <Card title="Resumen por tipo">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {TIPOS.filter(t=>["grabacion","emision","entrega","estreno","tarea","cobranza"].includes(t.v)).map(t=><div key={t.v} style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:12,padding:14}}>
            <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t.lbl}</div>
            <div style={{fontFamily:"var(--fm)",fontSize:24,fontWeight:700,color:t.c}}>{evFiltrados.filter(ev=>ev.tipo===t.v).length}</div>
          </div>)}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:12}}>Esta vista está pensada para revisar rápido grabaciones, entregas y publicaciones sin navegar por cada módulo.</div>
      </Card>
    </div>}

    {subTab===3&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Documentos por cobrar" sub="Estado comercial y próximos vencimientos.">
        {cobranzaItems.length?cobranzaItems.map(doc=>{
          const late = doc.estadoCobranza==="Retrasado de pago";
          const badgeColor = doc.estadoCobranza==="Pagado" ? "green" : late ? "red" : doc.estadoCobranza==="No pagado" ? "orange" : "yellow";
          return <div key={doc.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>{doc.correlativo||doc.tipoDoc||"Invoice"}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{doc.entidad} · vence {fmtD(doc.fechaVencimiento)}</div>
              <div style={{fontSize:11,color:"var(--gr3)",marginTop:3}}>{fmtM(doc.total||0)}</div>
            </div>
            <Badge label={doc.estadoCobranza} color={badgeColor} sm/>
          </div>;
        }):<Empty text="Sin documentos con vencimiento"/>}
      </Card>
      <Card title="Contratos por vencer" sub="Control comercial complementario.">
        {contratosPorVencer.length?contratosPorVencer.map(ct=>{
          const cli=(clientes||[]).find(x=>x.id===ct.cliId)?.nom||"Sin cliente";
          return <div key={ct.id} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700}}>{ct.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{cli} · vigencia {fmtD(ct.vig)}</div>
            </div>
            <Badge label={`${daysUntil(ct.vig)} días`} color="yellow" sm/>
          </div>;
        }):<Empty text="Sin contratos por vencer"/>}
      </Card>
    </div>}
  </div>;
}

// ── PRESUPUESTOS ─────────────────────────────────────────────

function MPres({open,data,clientes,producciones,programas,piezas,contratos,listas,onClose,onSave,empresa,currentUser}){
  const pieceLine = () => ({id:uid(),desc:"Piezas mensuales",qty:1,precio:0,und:"pieza"});
  const empty={titulo:"",cliId:"",tipo:"produccion",refId:"",estado:"Pendiente",validez:"30",moneda:"CLP",iva:true,metodoPago:"",fechaPago:"",notasPago:"",obs:"",items:[],contratoId:"",autoFactura:false,modoDetalle:"items",detallePiezas:"Piezas mensuales",pieceLines:[pieceLine()],recurring:false,recMonths:"6",recStart:today()};
  const [f,setF]=useState({});
  const [draftRestored,setDraftRestored]=useState(false);
  const draftKeyArgs=[empresa?.id||"",currentUser?.id||""];
  useEffect(()=>{
    if (!open) return;
    if (data?.id) {
      setDraftRestored(false);
      setF({...data,items:data.items||[],pieceLines:(data.pieceLines||data.items||[]).filter(it=>it&&it.und==="pieza").map(it=>({id:it.id||uid(),desc:it.desc||"Piezas mensuales",qty:Number(it.qty||1),precio:Number(it.precio||0),und:"pieza"})) || [pieceLine()]});
      return;
    }
    const draft=loadBudgetDraft(...draftKeyArgs);
    if (draft) {
      setDraftRestored(true);
      setF({...empty,...draft,items:draft.items||[],pieceLines:(draft.pieceLines||draft.items||[]).filter(it=>it&&it.und==="pieza").map(it=>({id:it.id||uid(),desc:it.desc||"Piezas mensuales",qty:Number(it.qty||1),precio:Number(it.precio||0),und:"pieza"})) || [pieceLine()]});
      return;
    }
    setDraftRestored(false);
    setF({...empty});
  },[data,open,empresa?.id,currentUser?.id]);
  useEffect(()=>{
    if (!open || data?.id || !Object.keys(f||{}).length) return;
    saveBudgetDraft(...draftKeyArgs, f);
  },[f,open,data?.id,empresa?.id,currentUser?.id]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canContracts = hasAddon(empresa, "contratos");
  const canInvoices = hasAddon(empresa, "facturacion");
  const addItem=()=>setF(p=>({...p,items:[...(p.items||[]),{id:uid(),desc:"",qty:1,precio:0,und:"Unidad"}]}));
  const updItem=(i,k,v)=>setF(p=>({...p,items:(p.items||[]).map((it,j)=>j===i?{...it,[k]:v}:it)}));
  const delItem=i=>setF(p=>({...p,items:(p.items||[]).filter((_,j)=>j!==i)}));
  const addPieceLine=()=>setF(p=>({...p,pieceLines:[...(p.pieceLines||[]),pieceLine()]}));
  const updPieceLine=(i,k,v)=>setF(p=>({...p,pieceLines:(p.pieceLines||[]).map((it,j)=>j===i?{...it,[k]:v}:it)}));
  const delPieceLine=i=>setF(p=>({...p,pieceLines:(p.pieceLines||[]).filter((_,j)=>j!==i)}));
  const socialCampaign=(piezas||[]).find(x=>x.id===f.refId);
  const pieceItems = f.modoDetalle==="piezas"
    ? ((f.pieceLines||[]).length?(f.pieceLines||[]):[pieceLine()]).map((it,i)=>({
        ...it,
        id:it.id||uid(),
        desc:it.desc||`Piezas ${i+1}`,
        qty:Number(it.qty||0),
        precio:Number(it.precio||0),
        und:"pieza",
      }))
    : (f.items||[]);
  const subtotal=pieceItems.reduce((s,it)=>s+Number(it.qty||0)*Number(it.precio||0),0);
  const ivaVal=f.iva?Math.round(subtotal*0.19):f.honorarios?Math.round(subtotal*0.1525):0;
  const total=subtotal+ivaVal;
  const recurringMonths=Math.max(1,Number(f.recMonths||1));
  const projectedTotal=f.recurring?total*recurringMonths:total;
  const contratosCli = contractsForReference(contratos||[], f.cliId, f.tipo, f.refId);
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Presupuesto":"Nuevo Presupuesto"} sub="Cotización comercial" extraWide>
    {!data?.id&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--sur)"}}>
      <div style={{fontSize:11,color:"var(--gr2)"}}>
        {draftRestored?"Restauramos tu borrador automáticamente.":"Este formulario guarda un borrador automático para evitar pérdida de avance."}
      </div>
      <GBtn sm onClick={()=>{saveBudgetDraft(...draftKeyArgs,null);setDraftRestored(false);setF({...empty});}}>Descartar borrador</GBtn>
    </div>}
    <R2>
      <FG label="Título / Descripción *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Proyecto / Producción Q2 2025"/></FG>
      <FG label="N° Correlativo"><FI value={f.correlativo||""} onChange={e=>u("correlativo",e.target.value)} placeholder="PRES-2025-001"/></FG>
    </R2>
    <FG label="Cliente *"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Seleccionar cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <R2>
      <FG label="Tipo"><FSl value={f.tipo||"produccion"} onChange={e=>u("tipo",e.target.value)}>{(listas?.tiposPres||DEFAULT_LISTAS.tiposPres).map(o=><option key={o} value={o==="Proyecto"?"produccion":o==="Producción"?"programa":o==="Contenidos"?"contenido":"servicio"}>{o}</option>)}</FSl></FG>
      <FG label="Estado"><FSl value={f.estado||"Pendiente"} onChange={e=>u("estado",e.target.value)}>{(listas?.estadosPres||DEFAULT_LISTAS.estadosPres).map(o=><option key={o}>{o}</option>)}</FSl></FG>
    </R2>
    <R2>
      <FG label={f.tipo==="programa"?"Producción asociada":f.tipo==="contenido"?"Campaña asociada":"Proyecto asociado"}>
        <FSl value={f.refId||""} onChange={e=>{
          const value=e.target.value;
          if (f.tipo==="contenido") {
            const campaign=(piezas||[]).find(x=>x.id===value);
            setF(prev=>({
              ...prev,
              refId:value,
              cliId:prev.cliId || campaign?.cliId || "",
              pieceLines:prev.modoDetalle==="piezas" && !(prev.pieceLines||[]).length ? [{id:uid(),desc:`Piezas ${campaign?.mes || "mensuales"}`,qty:Number(campaign?.plannedPieces||1),precio:0,und:"pieza"}] : prev.pieceLines,
            }));
            return;
          }
          u("refId",value);
        }}>
          <option value="">— Sin referencia directa —</option>
          {f.tipo==="programa"
            ? (canPrograms ? (programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>) : [])
            : f.tipo==="contenido"
              ? (canSocial ? (piezas||[]).map(p=><option key={p.id} value={p.id}>📱 {p.nom}</option>) : [])
              : (producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}
        </FSl>
      </FG>
      {canContracts
        ? <FG label="Contrato asociado">
            <FSl value={f.contratoId||""} onChange={e=>u("contratoId",e.target.value)}>
              <option value="">— Sin contrato asociado —</option>
              {contratosCli.map(ct=><option key={ct.id} value={ct.id}>{ct.nom}</option>)}
            </FSl>
          </FG>
        : <FG label="Facturación posterior">
            <FSl value={f.autoFactura?"true":"false"} onChange={e=>u("autoFactura",e.target.value==="true")} disabled={!canInvoices}>
              <option value="false">Crear manualmente</option>
              <option value="true">Listo para facturar</option>
            </FSl>
          </FG>}
    </R2>
    <R3>
      <FG label="Validez (días)"><FI type="number" value={f.validez||"30"} onChange={e=>u("validez",e.target.value)} placeholder="30"/></FG>
      <FG label="Moneda"><FSl value={f.moneda||"CLP"} onChange={e=>u("moneda",e.target.value)}>{(listas?.monedas||DEFAULT_LISTAS.monedas).map(o=><option key={o}>{o}</option>)}</FSl></FG>
      <FG label="Impuesto"><FSl value={f.honorarios?"hon":f.iva?"iva":"none"} onChange={e=>{const v=e.target.value;u("iva",v==="iva");u("honorarios",v==="hon");}}>
        {(listas?.impuestos||DEFAULT_LISTAS.impuestos).map(o=>{
          const value=o==="IVA 19%"?"iva":o==="Boleta Honorarios 15,25%"?"hon":"none";
          return <option key={o} value={value}>{o}</option>;
        })}
      </FSl></FG>
    </R3>
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:f.recurring?12:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700}}>Servicio recurrente</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Usa esta opción cuando el presupuesto sea un fee mensual o una prestación continua.</div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
          <input type="checkbox" checked={!!f.recurring} onChange={e=>u("recurring",e.target.checked)}/>
          Activar mensualidad
        </label>
      </div>
      {f.recurring && <R2>
        <FG label="Inicio de recurrencia"><FI type="date" value={f.recStart||today()} onChange={e=>u("recStart",e.target.value)}/></FG>
        <FG label="Cantidad de meses"><FSl value={String(f.recMonths||"6")} onChange={e=>u("recMonths",e.target.value)}>
          {Array.from({length:24},(_,i)=>String(i+1)).map(m=><option key={m} value={m}>{m} mes{m==="1"?"":"es"}</option>)}
        </FSl></FG>
      </R2>}
    </div>
    {canSocial && f.tipo==="contenido" && <R2>
      <FG label="Modo de cálculo">
        <FSl value={f.modoDetalle||"items"} onChange={e=>u("modoDetalle",e.target.value)}>
          <option value="piezas">Precio por pieza × cantidad</option>
          <option value="items">Ítems personalizables</option>
        </FSl>
      </FG>
      <FG label="Campaña vinculada">
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"10px 12px",fontSize:12,color:"var(--gr3)"}}>
          {socialCampaign ? `${socialCampaign.nom} · ${socialCampaign.mes || ""} ${socialCampaign.ano || ""}`.trim() : "Selecciona una campaña para vincular el presupuesto."}
        </div>
      </FG>
    </R2>}
    <Sep/>
    {/* Items */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Ítems / Detalle Comercial</div>
      {canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas"
        ? <GBtn sm onClick={addPieceLine}>+ Agregar línea de piezas</GBtn>
        : <GBtn sm onClick={addItem}>+ Agregar Ítem</GBtn>}
    </div>
    {canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas"
      ? <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bdr)"}}><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600}}>Detalle</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Cantidad de piezas</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:140}}>Precio por pieza</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Total</th><th style={{width:40}}></th></tr></thead>
              <tbody>{pieceItems.map((it,i)=><tr key={it.id} style={{borderTop:"1px solid var(--bdr)"}}>
                <td style={{padding:"6px 12px"}}><input value={it.desc||""} onChange={e=>updPieceLine(i,"desc",e.target.value)} placeholder="Gestión mensual de contenidos" style={{...FS,padding:"6px 8px",fontSize:12}}/></td>
                <td style={{padding:"6px 8px"}}><input type="number" value={it.qty||""} onChange={e=>updPieceLine(i,"qty",e.target.value)} min="1" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
                <td style={{padding:"6px 8px"}}><input type="number" value={it.precio||""} onChange={e=>updPieceLine(i,"precio",e.target.value)} min="0" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
                <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:12,color:"var(--wh)",whiteSpace:"nowrap"}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),f.moneda||"CLP")}</td>
                <td style={{padding:"6px 8px",textAlign:"center"}}>{pieceItems.length>1&&<XBtn onClick={()=>delPieceLine(i)}/>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{marginTop:8,fontSize:12,color:"var(--gr2)"}}>
            {socialCampaign ? `La campaña tiene ${socialCampaign.plannedPieces || 0} pieza(s) mensuales planificadas.` : "Puedes cotizar por volumen mensual aunque todavía no haya piezas creadas."}
          </div>
        </div>
      : (f.items||[]).length>0&&<div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden",marginBottom:12}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"var(--bdr)"}}><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600}}>Descripción</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:80}}>Qty</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Precio Unit.</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Total</th><th style={{width:40}}></th></tr></thead>
        <tbody>{(f.items||[]).map((it,i)=><tr key={it.id} style={{borderTop:"1px solid var(--bdr)"}}>
          <td style={{padding:"6px 12px"}}><input value={it.desc||""} onChange={e=>updItem(i,"desc",e.target.value)} placeholder="Descripción del ítem" style={{...FS,padding:"6px 8px",fontSize:12}}/></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.qty||""} onChange={e=>updItem(i,"qty",e.target.value)} min="1" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.precio||""} onChange={e=>updItem(i,"precio",e.target.value)} min="0" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
          <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:12,color:"var(--wh)",whiteSpace:"nowrap"}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),f.moneda||"CLP")}</td>
          <td style={{padding:"6px 8px",textAlign:"center"}}><XBtn onClick={()=>delItem(i)}/></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {!(canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas") && !(f.items||[]).length&&<div style={{textAlign:"center",padding:14,color:"var(--gr2)",fontSize:12,border:"1px dashed var(--bdr2)",borderRadius:8,marginBottom:12}}>Sin ítems. Haz clic en "+ Agregar Ítem"</div>}
    {/* Totales */}
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>Subtotal Neto</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{fmtMoney(subtotal,f.moneda||"CLP")}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>IVA 19%</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{f.iva?fmtMoney(ivaVal,f.moneda||"CLP"):"—"}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span style={{fontSize:13,fontWeight:700}}>Total Final</span><span style={{fontFamily:"var(--fm)",fontSize:15,fontWeight:700,color:"var(--cy)"}}>{fmtMoney(total,f.moneda||"CLP")}</span></div>
      {f.recurring && <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:8,borderTop:"1px dashed var(--bdr2)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>Proyección {recurringMonths} mes{recurringMonths===1?"":"es"}</span><span style={{fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#00e08a"}}>{fmtMoney(projectedTotal,f.moneda||"CLP")}</span></div>}
    </div>
    <R2>
      <FG label="Método de Pago"><FI value={f.metodoPago||""} onChange={e=>u("metodoPago",e.target.value)} placeholder="Transferencia, cuotas..."/></FG>
      <FG label="Fecha de Pago"><FI type="date" value={f.fechaPago||""} onChange={e=>u("fechaPago",e.target.value)}/></FG>
    </R2>
    <FG label="Datos de Pago"><FTA value={f.notasPago||""} onChange={e=>u("notasPago",e.target.value)} placeholder="Banco, número de cuenta, RUT..."/></FG>
    <FG label="Observaciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Condiciones, notas adicionales..."/></FG>
    {canInvoices && <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div>
        <div style={{fontSize:12,fontWeight:700}}>Preparación para facturación</div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Si este presupuesto se acepta, quedará listo para crear una orden de factura desde su detalle.</div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
        <input type="checkbox" checked={!!f.autoFactura} onChange={e=>u("autoFactura",e.target.checked)}/>
        Marcar como listo para facturar
      </label>
    </div>}
    <MFoot onClose={onClose} onSave={()=>{
      if(!f.titulo?.trim()||!f.cliId)return;
      const normalizedItems = canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas"
        ? pieceItems
        : (f.items||[]);
      saveBudgetDraft(...draftKeyArgs,null);
      onSave({...f,items:normalizedItems,pieceLines:canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas" ? pieceItems : (f.pieceLines||[]),subtotal,ivaVal,total,projectedTotal});
    }}/>
  </Modal>;
}

// ── PDF GENERATOR — PRESUPUESTO ──────────────────────────────
function pdfEscape(text="") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g,"\\\\")
    .replace(/\(/g,"\\(")
    .replace(/\)/g,"\\)");
}

function pdfHexColor(hex="#000000") {
  const raw = String(hex||"#000000").replace("#","");
  const normalized = raw.length===3 ? raw.split("").map(ch=>ch+ch).join("") : raw.padEnd(6,"0").slice(0,6);
  const parts = normalized.match(/.{2}/g) || ["00","00","00"];
  return parts.map(p=>(parseInt(p,16)/255).toFixed(3)).join(" ");
}

function hexToRgb(hex="#000000") {
  const raw = String(hex||"#000000").replace("#","");
  const normalized = raw.length===3 ? raw.split("").map(ch=>ch+ch).join("") : raw.padEnd(6,"0").slice(0,6);
  const parts = normalized.match(/.{2}/g) || ["00","00","00"];
  const [r,g,b] = parts.map(p=>parseInt(p,16)/255);
  return rgb(r,g,b);
}

async function loadPdfImage(doc, logoUrl="") {
  if (!logoUrl) return null;
  try {
    const bytes = logoUrl.startsWith("data:")
      ? Uint8Array.from(atob(logoUrl.split(",")[1] || ""), c => c.charCodeAt(0))
      : new Uint8Array(await (await fetch(logoUrl)).arrayBuffer());
    if (logoUrl.includes("image/png") || logoUrl.toLowerCase().endsWith(".png")) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawWrappedText(page, text, x, y, maxWidth, font, size, color, lineGap=4) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;
  let line = "";
  let cursorY = y;
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + lineGap;
      line = word;
    } else {
      line = next;
    }
  });
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
  return cursorY - size - lineGap;
}

async function buildModernPdf({ fileName, title, badge, accent="#00d4e8", empresa, counterpartTitle, counterpartName, counterpartLines=[], metaLines=[], summaryRows=[], bodySections=[] }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accentColor = hexToRgb(accent);
  const textColor = hexToRgb("#0f172a");
  const muted = hexToRgb("#64748b");
  const light = hexToRgb("#e2e8f0");
  const panel = hexToRgb("#f8fafc");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f1f5f9");
  const border = hexToRgb("#cbd5e1");
  const drawRoundedBlock = (x, y, w, h, color) => {
    const r = 12;
    page.drawRectangle({ x:x+r, y, width:w-(r*2), height:h, color });
    page.drawRectangle({ x, y:y+r, width:w, height:h-(r*2), color });
    page.drawCircle({ x:x+r, y:y+r, size:r, color });
    page.drawCircle({ x:x+w-r, y:y+r, size:r, color });
    page.drawCircle({ x:x+r, y:y+h-r, size:r, color });
    page.drawCircle({ x:x+w-r, y:y+h-r, size:r, color });
  };
  const drawCard = (x, y, w, h, titleText, titleColor=white, headerFill=accentColor) => {
    drawRoundedBlock(x, y, w, h, panel);
    drawRoundedBlock(x, y+h-28, w, 28, headerFill);
    page.drawText(titleText, { x:x+14, y:y+h-18, size:10, font:bold, color:titleColor });
  };
  page.drawRectangle({ x:0, y:0, width, height, color:hexToRgb("#ffffff") });
  page.drawRectangle({ x:0, y:height-96, width, height:96, color:accentColor });

  const logo = await loadPdfImage(pdf, empresa?.logo || "");
  if (logo) {
    const dims = logo.scale(0.3);
    page.drawImage(logo, { x:36, y:height-90, width:dims.width, height:dims.height });
  } else {
    page.drawText(empresa?.nombre || "produ", { x:36, y:height-56, size:24, font:bold, color:white });
  }
  page.drawText(title, { x:width-300, y:height-54, size:22, font:bold, color:white });

  page.drawText(empresa?.nombre || "", { x:36, y:height-128, size:18, font:bold, color:textColor });
  const emisorLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let emisorY = height-150;
  emisorLines.forEach(line => {
    page.drawText(line, { x:36, y:emisorY, size:10, font, color:muted });
    emisorY -= 14;
  });

  drawCard(36, height-322, 258, 110, counterpartTitle);
  page.drawText(counterpartName || "—", { x:50, y:height-260, size:16, font:bold, color:textColor });
  let cpY = height-280;
  counterpartLines.filter(Boolean).forEach(line => {
    page.drawText(line, { x:50, y:cpY, size:10, font, color:muted });
    cpY -= 13;
  });

  drawCard(318, height-322, 258, 110, "Resumen");
  let metaY = height-250;
  metaLines.filter(Boolean).forEach(line => {
    page.drawText(line, { x:332, y:metaY, size:10, font, color:textColor });
    metaY -= 14;
  });

  let sectionY = height-352;
  bodySections.forEach(section => {
    const sectionRows = section.rows || [];
    const textExtra = section.text ? 42 : 0;
    const sectionHeight = Math.max(70, 44 + sectionRows.length * 28 + textExtra);
    drawCard(36, sectionY-sectionHeight, 540, sectionHeight, section.title, white, accentColor);
    let innerY = sectionY - 46;
    if (section.rows) {
      section.rows.forEach(row => {
        drawRoundedBlock(50, innerY-8, 512, 22, white);
        page.drawText(row.label, { x:60, y:innerY-1, size:10, font:row.bold?bold:font, color:textColor });
        page.drawText(row.value, { x:350, y:innerY-1, size:10, font:row.valueBold?bold:font, color:row.valueColor || textColor });
        innerY -= 28;
      });
    }
    if (section.text) {
      drawWrappedText(page, section.text, 54, innerY+2, 500, font, 10, muted, 5);
    }
    sectionY -= sectionHeight + 14;
  });

  drawCard(318, 40, 258, 124, "Totales");
  let totalY = 126;
  summaryRows.forEach(row => {
    page.drawText(row.label, { x:332, y:totalY, size:10, font:row.highlight?bold:font, color:row.highlight?textColor:muted });
    page.drawText(row.value, { x:468, y:totalY, size:11, font:row.highlight?bold:font, color:row.color || textColor });
    totalY -= 18;
  });
  page.drawText("Generado con Produ", { x:36, y:28, size:9, font, color:muted });
  const bytes = await pdf.save();
  return new File([bytes], fileName, { type:"application/pdf" });
}

function buildSimplePdfBlob(lines, accent="#00d4e8") {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const marginY = 50;
  const defaultGap = 16;
  const pages = [];
  let current = [];
  let y = pageHeight - marginY;
  const pushPage = () => {
    pages.push(current);
    current = [];
    y = pageHeight - marginY;
  };
  const ensureGap = gap => {
    if (y - gap < marginY) pushPage();
  };

  (lines||[]).forEach(line => {
    const text = String(line?.text ?? "");
    const chunks = text.split("\n");
    chunks.forEach((chunk, index) => {
      const size = line?.size || 12;
      const gap = index===chunks.length-1 ? (line?.gap || defaultGap) : defaultGap;
      ensureGap(gap);
      current.push({
        x: line?.x ?? marginX,
        y,
        size,
        font: line?.bold ? "F2" : "F1",
        color: line?.color || "#1f2937",
        text: chunk,
      });
      y -= gap;
    });
  });
  if (current.length || !pages.length) pages.push(current);

  const accentColor = pdfHexColor(accent);
  const objects = [];
  const addObject = value => {
    objects.push(value);
    return objects.length;
  };
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds = [];
  const contentIds = [];
  pages.forEach(pageLines => {
    const commands = ["BT"];
    let lastFont = "";
    let lastSize = "";
    let lastColor = "";
    pageLines.forEach(line => {
      if (line.font !== lastFont || String(line.size) !== lastSize) {
        commands.push(`/${line.font} ${line.size} Tf`);
        lastFont = line.font;
        lastSize = String(line.size);
      }
      const color = pdfHexColor(line.color);
      if (color !== lastColor) {
        commands.push(`${color} rg`);
        lastColor = color;
      }
      commands.push(`1 0 0 1 ${line.x} ${line.y} Tm (${pdfEscape(line.text)}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    pageIds.push(addObject(`<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pageIds.forEach((id, index) => {
    objects[id-1] = objects[id-1].replace("PAGES_ID", String(pagesId));
    objects[contentIds[index]-1] = objects[contentIds[index]-1].replace("ACCENT_COLOR", accentColor);
  });
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index+1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(off => {
    pdf += `${String(off).padStart(10,"0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type:"application/pdf" });
}

function presupuestoPdfFileName(pres = {}) {
  return `${(pres.correlativo || pres.titulo || "presupuesto").replace(/[^a-z0-9]+/gi,"_").replace(/^_+|_+$/g,"").toLowerCase() || "presupuesto"}.pdf`;
}

function facturaPdfFileName(fact = {}) {
  const prefix = fact.tipoDoc === "Invoice" ? "invoice" : "orden_factura";
  return `${prefix}_${String(fact.correlativo || "documento").replace(/[^a-z0-9]+/gi,"_").replace(/^_+|_+$/g,"").toLowerCase()}.pdf`;
}

async function buildBudgetPdfFile(pres, cliente, empresa) {
  const contacto = (cliente?.contactos||[])[0];
  const subtotal = Number(pres.subtotal||0);
  const ivaVal = Number(pres.ivaVal||0);
  const total = Number(pres.total||0);
  const accent = companyPrintColor(empresa);
  return buildModernPdf({
    fileName: presupuestoPdfFileName(pres),
    title: pres.correlativo ? `Presupuesto ${pres.correlativo}` : "Presupuesto",
    badge: pres.estado || "Pendiente",
    accent,
    empresa,
    counterpartTitle: "Cliente",
    counterpartName: cliente?.nom || "—",
    counterpartLines: [
      cliente?.rut ? `RUT: ${cliente.rut}` : "",
      cliente?.dir || "",
      contacto ? `Contacto: ${contacto.nom}${contacto.car ? ` · ${contacto.car}` : ""}` : "",
      contacto ? [contacto.ema, contacto.tel].filter(Boolean).join(" · ") : "",
    ],
    metaLines: [
      `Fecha de emisión: ${fmtD(today())}`,
      `Validez: ${pres.validez || 30} días`,
      `Moneda: ${pres.moneda || "CLP"}`,
      pres.metodoPago ? `Método de pago: ${pres.metodoPago}` : "",
    ],
    summaryRows: [
      { label:"Subtotal neto", value:fmtMoney(subtotal, pres.moneda || "CLP") },
      { label:pres.honorarios ? "Boleta honorarios 15,25%" : "IVA 19%", value:(pres.iva||pres.honorarios) ? fmtMoney(ivaVal, pres.moneda || "CLP") : "No aplica" },
      { label:"Total final", value:fmtMoney(total, pres.moneda || "CLP"), highlight:true, color:hexToRgb(accent) },
    ],
    bodySections: [
      {
        title:"Detalle comercial",
        rows:(pres.items||[]).length
          ? (pres.items||[]).map((it, idx)=>({
              label:`${idx+1}. ${it.desc || "Ítem sin descripción"}`,
              value:`${it.qty || 0} × ${fmtMoney(it.precio || 0, pres.moneda || "CLP")} = ${fmtMoney(Number(it.qty||0)*Number(it.precio||0), pres.moneda || "CLP")}`,
            }))
          : [{ label:"Sin ítems", value:"—" }],
      },
      ...(empresa?.bankInfo || pres.notasPago || pres.fechaPago ? [{
        title:"Datos de pago",
        text:[empresa?.bankInfo || "", pres.notasPago || "", pres.fechaPago ? `Fecha de pago esperada: ${fmtD(pres.fechaPago)}` : ""].filter(Boolean).join("\n\n"),
      }] : []),
      ...(pres.obs ? [{ title:"Observaciones", text:pres.obs }] : []),
    ],
  });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1200);
}

async function generarPDF(pres, cliente, empresa) {
  try {
    const file = await buildBudgetPdfFile(pres, cliente, empresa);
    downloadFile(file);
    return file;
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del presupuesto.");
    return null;
  }
}

async function enviarPresupuestoWhatsApp(pres, cliente, empresa) {
  const contacto = (cliente?.contactos||[])[0];
  if (!contacto?.tel) {
    alert("El cliente no tiene teléfono de contacto registrado.");
    return;
  }
  let file;
  try {
    file = await buildBudgetPdfFile(pres, cliente, empresa);
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del presupuesto.");
    return;
  }
  const msg = `Hola ${contacto.nom || ""}, te compartimos el presupuesto ${pres.correlativo || pres.titulo || ""}.`;
  const canShareFile = typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files:[file] });
  if (canShareFile) {
    await navigator.share({ files:[file], title:pres.titulo || "Presupuesto", text:msg });
    return;
  }
  downloadFile(file);
  const num = String(contacto.tel || "").replace(/[^0-9]/g, "");
  const waNum = num.startsWith("56") ? num : "56" + num;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg + " El PDF ya se descargó en tu dispositivo para adjuntarlo en este chat.")}`, "_blank");
}

// ── PDF GENERATOR — FACTURA ───────────────────────────────────
async function buildFactPdfFile(fact, entidad, ref, empresa) {
  const mn = Number(fact.montoNeto||0);
  const ivaV = fact.iva ? Math.round(mn*0.19) : 0;
  const total = Number(fact.total || (mn + ivaV));
  const accent = companyPrintColor(empresa);
  const docType = fact.tipoDoc || "Orden de Factura";
  return buildModernPdf({
    fileName: facturaPdfFileName(fact),
    title: fact.correlativo ? `${docType} ${fact.correlativo}` : docType,
    badge: fact.estado || "Pendiente",
    accent,
    empresa,
    counterpartTitle: fact.tipo === "auspiciador" ? "Auspiciador" : "Cliente",
    counterpartName: entidad?.nom || "—",
    counterpartLines: [
      entidad?.rut ? `RUT: ${entidad.rut}` : "",
      entidad?.dir || "",
      entidad?.con ? `Contacto: ${entidad.con}` : "",
      [entidad?.ema, entidad?.tel].filter(Boolean).join(" · "),
    ],
    metaLines: [
      `Fecha de emisión: ${fact.fechaEmision ? fmtD(fact.fechaEmision) : fmtD(today())}`,
      fact.fechaVencimiento ? `Vencimiento: ${fmtD(fact.fechaVencimiento)}` : "Sin vencimiento",
      fact.fechaPago ? `Pagada: ${fmtD(fact.fechaPago)}` : "",
      ref ? `Referencia: ${(fact.tipoRef === "produccion" ? "Proyecto" : fact.tipoRef === "contenido" ? "Campaña" : "Producción")} · ${ref.nom || ""}` : "Sin referencia directa",
    ],
    summaryRows: [
      { label:"Monto neto", value:fmtM(mn) },
      { label:docType === "Invoice" ? "Impuesto" : "IVA 19%", value:docType === "Invoice" ? "No tributario" : (fact.iva ? fmtM(ivaV) : "No aplica") },
      { label:"Total", value:fmtM(total), highlight:true, color:hexToRgb(accent) },
    ],
    bodySections: [
      {
        title:"Detalle del documento",
        rows:[
          { label:"Tipo de documento", value:docType, bold:true },
          { label:"Entidad", value:entidad?.nom || "—" },
          { label:"Referencia", value:ref ? ref.nom || "—" : "Sin referencia" },
        ],
      },
      ...(empresa?.bankInfo || fact.obs ? [{ title:"Datos de pago / información bancaria", text:[empresa?.bankInfo || "", fact.obs || ""].filter(Boolean).join("\n\n") }] : []),
      ...(fact.obs2 ? [{ title:"Observaciones", text:fact.obs2 }] : []),
      ...(docType === "Invoice" ? [{ title:"Nota", text:"Este documento es un comprobante no tributario para servicios y mantiene el registro interno del movimiento en Produ." }] : []),
    ],
  });
}

async function generarPDFFactura(fact, entidad, ref, empresa) {
  try {
    const file = await buildFactPdfFile(fact, entidad, ref, empresa);
    downloadFile(file);
    return file;
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del documento.");
    return null;
  }
}

// ── VIEW PRESUPUESTOS ─────────────────────────────────────────
function ViewPres({empresa,presupuestos,clientes,producciones,programas,piezas,contratos,navTo,openM,canDo:_cd,cSave,cDel,setPresupuestos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const fd=(presupuestos||[]).filter(x=>x.empId===empId).filter(p=>(p.titulo||"").toLowerCase().includes(q.toLowerCase())&&(!fe||p.estado===fe));
  const total=fd.reduce((s,p)=>s+Number(p.total||0),0);
  const aceptados=fd.filter(p=>p.estado==="Aceptado").reduce((s,p)=>s+Number(p.total||0),0);
  const setEstadoRapido=(evt,pres,estado)=>{evt.stopPropagation();cSave(presupuestos,setPresupuestos,{...pres,estado});};
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total"     value={fd.length}                                          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Aceptados" value={fd.filter(p=>p.estado==="Aceptado").length}          accent="#00e08a"   vc="#00e08a"/>
      <Stat label="Monto Total"   value={fmtM(total)}    sub="todos"     accent="var(--cy)"/>
      <Stat label="Monto Aceptado" value={fmtM(aceptados)} sub="aceptados" accent="#00e08a" vc="#00e08a"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar presupuesto..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","Enviado","En Revisión","Aceptado","Rechazado"]} placeholder="Todo estados"/>
      {_cd&&_cd("presupuestos")&&<Btn onClick={()=>openM("pres",{})}>+ Nuevo Presupuesto</Btn>}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Título</TH><TH>Cliente</TH><TH>Referencia</TH><TH>Estado</TH><TH>Ítems</TH><TH>Total</TH><TH>Contrato</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);return<tr key={p.id} onClick={()=>navTo("pres-det",p.id)}>
            <TD><div style={{fontWeight:700}}>{p.titulo}</div><div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{recurringSummary(p, p.cr || today())}</div></TD>
            <TD>{c?c.nom:"—"}</TD>
            <TD style={{fontSize:11}}>{budgetRefLabel(p,producciones,programas,piezas)}</TD>
            <TD><Badge label={p.estado||"Borrador"}/></TD>
            <TD mono style={{fontSize:11}}>{(p.items||[]).length}{p.recurring && <div style={{fontSize:10,color:"#00e08a",marginTop:4}}>{p.recMonths || 1} mes(es)</div>}</TD>
            <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtMoney(p.total||0,p.moneda||"CLP")}</TD>
            <TD style={{fontSize:11,color:"var(--gr2)"}}>{(contratos||[]).find(ct=>ct.id===p.contratoId)?.nom||"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>
              <GBtn sm onClick={e=>{e.stopPropagation();navTo("pres-det",p.id);}}>Ver</GBtn>
              <GBtn sm onClick={e=>{e.stopPropagation();const c=(clientes||[]).find(x=>x.id===p.cliId);generarPDF(p,c,empresa);}} title="Descargar PDF">⬇</GBtn>
              <GBtn sm onClick={async e=>{e.stopPropagation();const c=(clientes||[]).find(x=>x.id===p.cliId);await enviarPresupuestoWhatsApp(p,c,empresa);}} title="Enviar por WhatsApp">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </GBtn>
              {_cd&&_cd("presupuestos")&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Pendiente")} title="Marcar pendiente">⌛</GBtn>}
              {_cd&&_cd("presupuestos")&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Aceptado")} title="Marcar aceptado">✓</GBtn>}
              {_cd&&_cd("presupuestos")&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Rechazado")} title="Marcar rechazado">✕</GBtn>}
              {_cd&&_cd("presupuestos")&&<XBtn onClick={e=>{e.stopPropagation();cDel(presupuestos,setPresupuestos,p.id,null,"Presupuesto eliminado");}}/>}
            </div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin presupuestos" sub={_cd&&_cd("presupuestos")?"Crea el primero con el botón superior":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

function ViewPresDet({id,empresa,presupuestos,clientes,producciones,programas,piezas,contratos,facturas,navTo,openM,canDo:_cd,cSave,cDel,setPresupuestos,setProducciones,setProgramas,setMovimientos}){
  const empId=empresa?.id;
  const p=(presupuestos||[]).find(x=>x.id===id);if(!p) return <Empty text="No encontrado"/>;
  const c=(clientes||[]).find(x=>x.id===p.cliId);
  const contrato=(contratos||[]).find(ct=>ct.id===p.contratoId);
  const linkedInvoices=(facturas||[]).filter(f=>f.presupuestoId===p.id);
  const canPrograms = hasAddon(empresa, "television");
  const canContracts = hasAddon(empresa, "contratos");
  const canInvoices = hasAddon(empresa, "facturacion");
  const [convOpen,setConvOpen]=useState(false);
  const [convTipo,setConvTipo]=useState("produccion");
  const [convNom,setConvNom]=useState(p.titulo||"");
  const setEstadoPres = estado => cSave(presupuestos,setPresupuestos,{...p,estado});
  const convertir=async()=>{
    if(!convNom.trim()) return;
    const newId=uid();
    if(convTipo==="produccion"){
      const nuevo={id:newId,empId,nom:convNom,cliId:p.cliId,tip:"Contenido Audiovisual",est:"Pre-Producción",ini:today(),fin:"",des:p.titulo,crewIds:[]};
      await setProducciones([...(producciones||[]),nuevo]);
    } else {
      const nuevo={id:newId,empId,nom:convNom,tip:"Producción",can:"",est:"En Desarrollo",totalEp:"",fre:"Semanal",temporada:"",conductor:"",prodEjec:"",des:p.titulo,cliId:p.cliId||"",crewIds:[]};
      await setProgramas([...(programas||[]),nuevo]);
    }
    // Crear ingreso automático con el total del presupuesto
    if(p.total){
      const ingresoAuto={id:uid(),empId,eid:newId,et:convTipo==="produccion"?"pro":"pg",tipo:"ingreso",cat:"Producción",desc:"Ingreso desde presupuesto: "+p.titulo,monto:p.total,fecha:today()};
      await setMovimientos(prev=>[...(prev||[]),ingresoAuto]);
    }
    // Mark presupuesto as converted
    await cSave(presupuestos,setPresupuestos,{...p,convertido:convTipo,convertidoNom:convNom});
    setConvOpen(false);
    navTo(convTipo==="produccion"?"producciones":"programas");
  };
  return <div>
    <DetHeader title={p.titulo} tag="Presupuesto" badges={[<Badge key={0} label={p.estado||"Borrador"}/>]} meta={[c&&`Cliente: ${c.nom}`,p.cr&&`Creado: ${fmtD(p.cr)}`,`Válido: ${p.validez||30} días`].filter(Boolean)}
      actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={()=>generarPDF(p,c,empresa)}>⬇ Descargar PDF</Btn>
        <GBtn onClick={async()=>{await enviarPresupuestoWhatsApp(p,c,empresa);}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </span>
        </GBtn>
        {_cd&&_cd("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Pendiente")}>Pendiente</GBtn>}
        {_cd&&_cd("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Aceptado")}>Aceptado</GBtn>}
        {_cd&&_cd("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Rechazado")}>Rechazado</GBtn>}
        {_cd&&_cd("presupuestos")&&<GBtn onClick={()=>openM("pres",p)}>✏ Editar</GBtn>}
        {canInvoices&&<Btn onClick={()=>openM("fact",{presupuestoId:p.id,entidadId:p.cliId,tipo:"cliente",tipoRef:p.tipo,proId:p.refId||"",montoNeto:Number(p.subtotal||p.total||0),iva:!!p.iva,contratoId:p.contratoId||"",obs:p.notasPago||"",obs2:p.obs||"",recurring:!!p.recurring,recMonths:String(p.recMonths||"6"),recStart:p.recStart||today()})}>🧾 Crear orden de factura</Btn>}
        {p.estado==="Aceptado"&&!p.convertido&&<Btn onClick={()=>setConvOpen(true)} s={{background:"#00e08a",color:"var(--bg)"}}>→ Convertir en {convTipo==="programa"?"Producción":"Proyecto"}</Btn>}
        {_cd&&_cd("presupuestos")&&<DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(presupuestos,setPresupuestos,id,()=>navTo("presupuestos"),"Eliminado");}}>🗑</DBtn>}
      </div>}/>
    {p.convertido&&<div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#00e08a"}}>✓ Convertido en {p.convertido==="produccion"?"producción":"programa TV"}: <b>{p.convertidoNom}</b></div>}
    {(contrato || linkedInvoices.length) && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      {contrato && canContracts && <Card title="Contrato Asociado">
        <KV label="Contrato" value={contrato.nom}/>
        <KV label="Estado" value={<Badge label={contractVisualState(contrato)}/>}/>
        <KV label="Vigencia" value={contrato.vig?fmtD(contrato.vig):"—"}/>
      </Card>}
      {linkedInvoices.length>0 && canInvoices && <Card title="Facturación Relacionada" sub={`${linkedInvoices.length} orden(es)`}>
        {linkedInvoices.slice(0,3).map(f=><div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div>
            <div style={{fontSize:12,fontWeight:700}}>{f.correlativo||"Sin correlativo"}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{f.estado||"Pendiente"}</div>
          </div>
          <div style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{fmtM(f.total||0)}</div>
        </div>)}
      </Card>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Subtotal Neto" value={fmtMoney(p.subtotal||0,p.moneda||"CLP")}/>
      <Stat label={p.honorarios?"Boleta Hon. 15,25%":"IVA 19%"} value={p.iva||p.honorarios?fmtMoney(p.ivaVal||0,p.moneda||"CLP"):"No aplica"}/>
      <Stat label="Total Final"   value={fmtMoney(p.total||0,p.moneda||"CLP")} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label={p.recurring?"Proyección":"Ítems"} value={p.recurring?fmtMoney(p.projectedTotal || Number(p.total||0) * Math.max(1, Number(p.recMonths||1)),p.moneda||"CLP"):(p.items||[]).length}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Datos del Presupuesto">
        {[["Cliente",c?.nom||"—"],["Tipo",p.tipo||"—"],["Referencia",budgetRefLabel(p,producciones,programas,piezas)],["Estado",<Badge key={0} label={p.estado||"Borrador"}/>],["Moneda",p.moneda||"CLP"],["IVA",p.iva?"19% incluido":"No aplica"],["Validez",`${p.validez||30} días`],["Recurrencia",recurringSummary(p, p.cr || today())]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Información de Pago">
        {[["Método",p.metodoPago||"—"],["Fecha pago",p.fechaPago?fmtD(p.fechaPago):"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {p.notasPago&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{p.notasPago}</div></>}
      </Card>
    </div>
    {/* Items table */}
    <Card title="Detalle de Ítems" style={{marginBottom:16}}>
      {(p.items||[]).length>0?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Descripción</TH><TH>Cantidad</TH><TH>Precio Unit.</TH><TH>Total</TH></tr></thead>
        <tbody>{(p.items||[]).map(it=><tr key={it.id}><TD bold>{it.desc||"—"}</TD><TD mono>{it.qty||0}</TD><TD mono style={{fontSize:12}}>{fmtMoney(it.precio||0,p.moneda||"CLP")}</TD><TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),p.moneda||"CLP")}</TD></tr>)}</tbody>
      </table></div>:<Empty text="Sin ítems"/>}
      <div style={{marginTop:16,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>Subtotal Neto</span><span style={{fontFamily:"var(--fm)"}}>{fmtMoney(p.subtotal||0,p.moneda||"CLP")}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>IVA 19%</span><span style={{fontFamily:"var(--fm)"}}>{p.iva||p.honorarios?fmtMoney(p.ivaVal||0,p.moneda||"CLP"):"—"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span>Total Final</span><span style={{fontFamily:"var(--fm)",color:"var(--cy)"}}>{fmtMoney(p.total||0,p.moneda||"CLP")}</span></div>
      </div>
    </Card>
    {p.obs&&<Card title="Observaciones"><p style={{fontSize:12,color:"var(--gr3)"}}>{p.obs}</p></Card>}
    {/* Modal convertir */}
    <Modal open={convOpen} onClose={()=>setConvOpen(false)} title="Convertir presupuesto" sub="Crea el registro operativo correspondiente.">
      <FG label="Tipo de registro"><FSl value={convTipo} onChange={e=>setConvTipo(e.target.value)}><option value="produccion">📽 Nuevo Proyecto</option>{canPrograms&&<option value="programa">📺 Nueva Producción</option>}</FSl></FG>
      <FG label="Nombre del proyecto"><FI value={convNom} onChange={e=>setConvNom(e.target.value)} placeholder="Nombre del proyecto"/></FG>
      <div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#00e08a",marginBottom:16}}>Se creará {convTipo==="produccion"?"un proyecto":"una producción"} con los datos del cliente. Podrás editarlo desde el módulo correspondiente.</div>
      <MFoot onClose={()=>setConvOpen(false)} onSave={convertir} label="Crear Proyecto"/>
    </Modal>
  </div>;
}

// ── FACTURACIÓN ───────────────────────────────────────────────
function MFact({open,data,empresa,clientes,auspiciadores,producciones,programas,piezas,presupuestos,contratos,listas,onClose,onSave}){
  const [f,setF]=useState({});
  const canPrograms = hasAddon(empresa, "television");
  const canPres = hasAddon(empresa, "presupuestos");
  const canContracts = hasAddon(empresa, "contratos");
  useEffect(()=>{
    const base={correlativo:"",tipoDoc:"Invoice",tipo:"cliente",entidadId:"",proId:"",tipoRef:"",montoNeto:0,iva:false,estado:"Emitida",cobranzaEstado:"Pendiente de pago",fechaEmision:today(),fechaVencimiento:"",fechaPago:"",presupuestoId:"",contratoId:"",obs:"",obs2:"",recurring:false,recMonths:"6",recStart:today()};
    setF(data?.id?{...base,...data}:{...base,...(data||{})});
  },[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const applyPresupuesto=presId=>{
    const pres=(presupuestos||[]).find(p=>p.id===presId);
    if(!pres){u("presupuestoId","");return;}
    setF(prev=>({
      ...prev,
      presupuestoId:pres.id,
      entidadId:pres.cliId||prev.entidadId,
      tipo:"cliente",
      tipoRef:pres.tipo||prev.tipoRef,
      proId:pres.refId||prev.proId,
      montoNeto:Number(pres.subtotal||pres.total||0),
      iva:prev.tipoDoc==="Invoice" ? false : !!pres.iva,
      contratoId:pres.contratoId||prev.contratoId,
      obs:prev.obs||pres.notasPago||"",
      obs2:prev.obs2||pres.obs||"",
      estado:prev.estado || "Emitida",
      cobranzaEstado:prev.cobranzaEstado || "Pendiente de pago",
      recurring:typeof prev.recurring==="boolean" ? prev.recurring : !!pres.recurring,
      recMonths:prev.recMonths || String(pres.recMonths || "6"),
      recStart:prev.recStart || pres.recStart || prev.fechaEmision || today(),
    }));
  };
  const mn=Number(f.montoNeto||0);const ivaV=f.iva?Math.round(mn*0.19):0;const total=mn+ivaV;
  const recurringMonths=Math.max(1,Number(f.recMonths||1));
  const projectedTotal=f.recurring?total*recurringMonths:total;
  // Solo auspiciadores principales y secundarios para programas
  const ausValidos=(auspiciadores||[]).filter(a=>["Auspiciador Principal","Auspiciador Secundario"].includes(a.tip));
  const contratosEntidad=contractsForReference(contratos||[], f.entidadId, f.tipoRef, f.proId);
  return <Modal open={open} onClose={onClose} title={data?.id?`Editar ${f.tipoDoc||"Documento"}`:`Nuevo ${f.tipoDoc||"Documento"}`} sub="Registro de cobro y documento comercial">
    {canPres && <FG label="Presupuesto origen">
      <FSl value={f.presupuestoId||""} onChange={e=>applyPresupuesto(e.target.value)}>
        <option value="">— Sin presupuesto asociado —</option>
        {(presupuestos||[]).map(p=><option key={p.id} value={p.id}>{p.correlativo||p.titulo} · {fmtM(p.total||0)}</option>)}
      </FSl>
    </FG>}
    <R3>
      <FG label="Tipo de documento">
        <FSl value={f.recurring?"Invoice":(f.tipoDoc||"Invoice")} onChange={e=>setF(prev=>({...prev,tipoDoc:e.target.value,iva:e.target.value==="Invoice"?false:prev.iva}))} disabled={!!f.recurring}>
          {(listas?.tiposDocFact||DEFAULT_LISTAS.tiposDocFact).map(o=><option key={o}>{o}</option>)}
        </FSl>
      </FG>
      <FG label="Correlativo Interno"><FI value={f.correlativo||""} onChange={e=>u("correlativo",e.target.value)} placeholder="OC-2025-001"/></FG>
      <FG label="Estado del documento"><FSl value={f.estado||"Emitida"} onChange={e=>u("estado",e.target.value)}>{(listas?.estadosFact||DEFAULT_LISTAS.estadosFact).map(o=><option key={o}>{o}</option>)}</FSl></FG>
    </R3>
    <R2>
      <FG label="Tipo Entidad"><FSl value={f.tipo||"cliente"} onChange={e=>u("tipo",e.target.value)}>{(listas?.tiposEntidadFact||DEFAULT_LISTAS.tiposEntidadFact).map(o=><option key={o} value={o==="Auspiciador"?"auspiciador":"cliente"}>{o}</option>)}</FSl></FG>
      <FG label="Tipo Referencia"><FSl value={f.tipoRef||""} onChange={e=>u("tipoRef",e.target.value)}><option value="">Sin referencia</option><option value="produccion">Proyecto</option>{canPrograms&&<option value="programa">Producción</option>}{hasAddon(empresa,"social")&&<option value="contenido">Contenidos</option>}</FSl></FG>
    </R2>
    <FG label={f.tipo==="auspiciador"?"Auspiciador (Principal o Secundario) *":"Cliente *"}>
      <FSl value={f.entidadId||""} onChange={e=>u("entidadId",e.target.value)}>
        <option value="">— Seleccionar —</option>
        {f.tipo==="auspiciador"
          ?ausValidos.map(a=><option key={a.id} value={a.id}>{a.nom} · {a.tip}</option>)
          :(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
      </FSl>
    </FG>
    <R2>
      <FG label="Proyecto / Producción / Campaña">
        <FSl value={f.proId||""} onChange={e=>u("proId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          <optgroup label="Proyectos">{(producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
          {canPrograms&&<optgroup label="Producciones">{(programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>}
          {hasAddon(empresa,"social")&&<optgroup label="Campañas">{(piezas||[]).map(p=><option key={p.id} value={p.id}>📱 {p.nom}</option>)}</optgroup>}
        </FSl>
      </FG>
    </R2>
    {canContracts && <FG label="Contrato asociado">
      <FSl value={f.contratoId||""} onChange={e=>u("contratoId",e.target.value)}>
        <option value="">— Sin contrato asociado —</option>
        {contratosEntidad.map(ct=><option key={ct.id} value={ct.id}>{ct.nom}</option>)}
      </FSl>
    </FG>}
    <R3>
      <FG label="Monto Neto *"><FI type="number" value={f.montoNeto||""} onChange={e=>u("montoNeto",e.target.value)} placeholder="0" min="0"/></FG>
      <FG label={f.tipoDoc==="Invoice"?"Impuesto":"IVA 19%"}><FSl value={f.iva?"true":"false"} onChange={e=>u("iva",e.target.value==="true")} disabled={f.tipoDoc==="Invoice"}><option value="true">Incluir IVA</option><option value="false">{f.tipoDoc==="Invoice"?"No tributario":"Sin IVA"}</option></FSl></FG>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:"9px 12px"}}>
        <div style={{fontSize:10,color:"var(--gr2)",marginBottom:4,fontWeight:600}}>TOTAL</div>
        <div style={{fontFamily:"var(--fm)",fontSize:16,fontWeight:700,color:"var(--cy)"}}>{fmtM(total)}</div>
      </div>
    </R3>
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:f.recurring?12:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700}}>Facturación recurrente</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>La recurrencia siempre se crea desde un Invoice y luego se administra aparte del cobro.</div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
          <input type="checkbox" checked={!!f.recurring} onChange={e=>setF(prev=>({...prev,recurring:e.target.checked,tipoDoc:e.target.checked?"Invoice":prev.tipoDoc,iva:e.target.checked?false:prev.iva}))}/>
          Activar mensualidad
        </label>
      </div>
      {f.recurring && <R2>
        <FG label="Inicio de serie"><FI type="date" value={f.recStart||f.fechaEmision||today()} onChange={e=>{u("recStart",e.target.value); if(!f.fechaEmision) u("fechaEmision",e.target.value);}}/></FG>
        <FG label="Cantidad de meses"><FSl value={String(f.recMonths||"6")} onChange={e=>u("recMonths",e.target.value)}>
          {Array.from({length:24},(_,i)=>String(i+1)).map(m=><option key={m} value={m}>{m} mes{m==="1"?"":"es"}</option>)}
        </FSl></FG>
      </R2>}
      {f.recurring && <div style={{marginTop:8,fontSize:12,color:"var(--gr2)"}}>Proyección de la serie: <span style={{fontFamily:"var(--fm)",color:"#00e08a"}}>{fmtM(projectedTotal)}</span></div>}
    </div>
    <R2>
      <FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision||""} onChange={e=>u("fechaEmision",e.target.value)}/></FG>
      <FG label="Fecha Vencimiento"><FI type="date" value={f.fechaVencimiento||""} onChange={e=>u("fechaVencimiento",e.target.value)}/></FG>
    </R2>
    <FG label="Datos de Pago / Información Bancaria"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Banco: BancoEstado&#10;Cuenta Corriente: 123456789&#10;RUT: 78.118.348-2&#10;Email: pagos@empresa.cl"/></FG>
    <FG label="Observaciones adicionales"><FTA value={f.obs2||""} onChange={e=>u("obs2",e.target.value)} placeholder="Notas internas, condiciones..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.entidadId||!f.montoNeto)return;onSave({...f,tipoDoc:f.recurring?"Invoice":f.tipoDoc,cobranzaEstado:f.cobranzaEstado||"Pendiente de pago",fechaPago:cobranzaState(f)==="Pagado"?(f.fechaPago||today()):"",ivaVal:ivaV,total,projectedTotal});}}/>
  </Modal>;
}

function ViewFact({empresa,facturas,movimientos,clientes,auspiciadores,producciones,programas,piezas,presupuestos,contratos,openM,canDo:_cd,cSave,cDel,setFacturas,setMovimientos,saveFacturaDoc,ntf}){
  const empId=empresa?.id;
  const [tab,setTab]=useState(0);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [fc,setFc]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const canPres = hasAddon(empresa, "presupuestos");
  const canContracts = hasAddon(empresa, "contratos");
  const allDocs = (facturas||[]).filter(x=>x.empId===empId);
  const fd=(facturas||[]).filter(x=>x.empId===empId).filter(f=>{
    const ent=invoiceEntityName(f,clientes,auspiciadores);
    return(ent.toLowerCase().includes(q.toLowerCase())||(f.correlativo||"").toLowerCase().includes(q.toLowerCase()))&&(!fe||f.estado===fe);
  });
  const invoices = allDocs.filter(f=>f.tipoDoc==="Invoice");
  const cobranzaDocs = invoices.filter(f=>{
    const ent=invoiceEntityName(f,clientes,auspiciadores);
    return (ent.toLowerCase().includes(q.toLowerCase()) || (f.correlativo||"").toLowerCase().includes(q.toLowerCase())) && (!fc || cobranzaState(f)===fc);
  });
  const cuentasPorCobrar = invoices.filter(f=>cobranzaState(f)!=="Pagado");
  const pendiente=cuentasPorCobrar.reduce((s,f)=>s+Number(f.total||0),0);
  const pagado=invoices.filter(f=>cobranzaState(f)==="Pagado").reduce((s,f)=>s+Number(f.total||0),0);
  const vencidas=invoices.filter(f=>cobranzaState(f)==="Retrasado de pago").length;
  const emitidas=fd.filter(f=>f.estado==="Emitida").length;
  const recurrentes=fd.filter(f=>f.recurring).length;
  const seriesList = Object.values(allDocs.filter(f=>f.seriesId).reduce((acc,f)=>{
    const key=f.seriesId;
    const bucket=acc[key] || { id:key, docs:[] };
    bucket.docs.push(f);
    acc[key]=bucket;
    return acc;
  },{})).map(bucket=>{
    const docs=[...bucket.docs].sort((a,b)=>Number(a.seriesIndex||0)-Number(b.seriesIndex||0) || String(a.fechaEmision||"").localeCompare(String(b.fechaEmision||"")));
    const first=docs[0]||{};
    const entityName=invoiceEntityName(first,clientes,auspiciadores);
    const activeDocs=docs.filter(d=>d.recurringStatus!=="Pausada" && d.recurringStatus!=="Cancelada");
    const status=docs.some(d=>d.recurringStatus==="Pausada") ? "Pausada" : docs.some(d=>d.recurringStatus==="Cancelada") ? "Cancelada" : "Activa";
    return {
      ...bucket,
      docs,
      first,
      status,
      entityName,
      totalMonths:Math.max(...docs.map(d=>Number(d.seriesTotal || d.recMonths || docs.length)), docs.length),
      projected:docs.reduce((s,d)=>s+Number(d.total||0),0),
      nextDate:activeDocs.find(d=>!d.fechaPago && (d.estado==="Pendiente" || d.estado==="Emitida"))?.fechaEmision || docs.find(d=>d.fechaEmision)?.fechaEmision || "",
    };
  }).sort((a,b)=>String(a.nextDate||"9999-12-31").localeCompare(String(b.nextDate||"9999-12-31")));
  const persistSeries = async (nextFacts, removedIds=[])=>{
    await setFacturas(nextFacts);
    if(removedIds.length){
      await setMovimientos((Array.isArray(movimientos)?movimientos:[]).filter(m=>!removedIds.includes(m.facturaId)));
    }
  };
  const pauseSeries = async series => {
    const nextFacts = allDocs.map(doc=>doc.seriesId===series.id ? {...doc, recurringStatus: doc.recurringStatus==="Pausada" ? "Activa" : "Pausada"} : doc);
    await persistSeries(nextFacts);
    ntf?.(series.status==="Pausada" ? "Serie reactivada ✓" : "Serie pausada ✓");
  };
  const cutSeries = async series => {
    const cutoff = today();
    const keepDocs = allDocs.filter(doc=>doc.seriesId!==series.id || String(doc.fechaEmision||"")<=cutoff);
    const removed = allDocs.filter(doc=>doc.seriesId===series.id && String(doc.fechaEmision||"")>cutoff);
    const keptCount = keepDocs.filter(doc=>doc.seriesId===series.id).length;
    const normalized = keepDocs.map(doc=>doc.seriesId===series.id ? {...doc, recurringStatus:"Cancelada", recMonths:keptCount, seriesTotal:keptCount} : doc);
    await persistSeries(normalized, removed.map(doc=>doc.id));
    ntf?.(`Serie recortada ✓ (${removed.length} documento${removed.length===1?"":"s"} futuro${removed.length===1?"":"s"} eliminado${removed.length===1?"":"s"})`);
  };
  const regenerateSeries = async series => {
    const base = series.docs[0];
    if(!base) return;
    const targetTotal = Math.max(Number(base.seriesTotal || base.recMonths || series.totalMonths || series.docs.length), series.docs.length);
    const existingByIndex = new Map(series.docs.map(doc=>[Number(doc.seriesIndex||1),doc]));
    const newDocs = [];
    for(let idx=1; idx<=targetTotal; idx+=1){
      if(existingByIndex.has(idx)) continue;
      const fechaEmision = addMonths(base.recStart || base.fechaEmision || today(), idx-1);
      const fechaVencimiento = base.fechaVencimiento ? addMonths(base.fechaVencimiento, idx-1) : "";
      newDocs.push({
        ...base,
        id:uid(),
        cr:today(),
        estado:base.estado==="Anulada" ? "Borrador" : (base.estado || "Emitida"),
        cobranzaEstado:"Pendiente de pago",
        fechaPago:"",
        fechaEmision,
        fechaVencimiento,
        recurring:true,
        recurringStatus:"Activa",
        recStart:base.recStart || base.fechaEmision || today(),
        recMonths:targetTotal,
        seriesTotal:targetTotal,
        seriesIndex:idx,
        correlativo:base.correlativo
          ? `${base.correlativo.replace(/-\d{2}$/,"")}-${String(idx).padStart(2,"0")}`
          : "",
      });
    }
    const nextFacts = [...allDocs.map(doc=>doc.seriesId===series.id ? {...doc, recurringStatus:"Activa", recMonths:targetTotal, seriesTotal:targetTotal} : doc), ...newDocs];
    await persistSeries(nextFacts);
    ntf?.(newDocs.length ? `Serie regenerada ✓ (${newDocs.length} mes${newDocs.length===1?"":"es"} nuevo${newDocs.length===1?"":"s"})` : "La serie ya estaba completa ✓");
  };
  const billingMessage = (doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    const due = doc.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "sin vencimiento definido";
    return `Hola ${contact.nombre || ""}, te escribimos desde ${empresa?.nombre || "Produ"} por el invoice ${doc.correlativo || ""} por ${fmtM(doc.total || 0)}, con vencimiento ${due}. Quedamos atentos a tu confirmación de pago.\n\n${empresa?.bankInfo || ""}`.trim();
  };
  const statementMessage = (docs, entity, type) => {
    const contact = billingContact(entity, type);
    const lines = docs.map(doc=>`- ${doc.correlativo || "Invoice"} · ${fmtM(doc.total || 0)} · ${cobranzaState(doc)}${doc.fechaVencimiento ? ` · vence ${fmtD(doc.fechaVencimiento)}` : ""}`);
    return `Hola ${contact.nombre || ""}, te compartimos tu estado de cuenta con ${empresa?.nombre || "Produ"}.\n\n${lines.join("\n")}\n\nTotal pendiente: ${fmtM(docs.filter(doc=>cobranzaState(doc)!=="Pagado").reduce((s,doc)=>s+Number(doc.total||0),0))}\n\n${empresa?.bankInfo || ""}`.trim();
  };
  const sendBillingEmail = (doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.email) { alert("La entidad no tiene email de cobranza registrado."); return; }
    openMailto(contact.email, `Cobranza invoice ${doc.correlativo || ""}`, billingMessage(doc, entity));
  };
  const sendBillingWhatsApp = (doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.tel) { alert("La entidad no tiene teléfono registrado."); return; }
    openWhatsApp(contact.tel, billingMessage(doc, entity));
  };
  const sendStatementEmail = (docs, entity, type) => {
    const contact = billingContact(entity, type);
    if (!contact.email) { alert("La entidad no tiene email de cobranza registrado."); return; }
    openMailto(contact.email, `Estado de cuenta ${contact.entidad || ""}`.trim(), statementMessage(docs, entity, type));
  };
  const sendStatementWhatsApp = (docs, entity, type) => {
    const contact = billingContact(entity, type);
    if (!contact.tel) { alert("La entidad no tiene teléfono registrado."); return; }
    openWhatsApp(contact.tel, statementMessage(docs, entity, type));
  };
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Documentos emitidos" value={fd.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Cuentas por cobrar" value={fmtM(pendiente)} accent="#ffcc44" vc="#ffcc44" sub={`${cuentasPorCobrar.length} invoice(s)`}/>
      <Stat label="Cobrado" value={fmtM(pagado)} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Emitidos / Recurrentes" value={`${emitidas} / ${recurrentes}`} accent="#ff5566" vc="#ff5566" sub={`atrasadas: ${vencidas}`}/>
    </div>
    <Tabs tabs={["Emisión","Cobranza","Recurrencias"]} active={tab} onChange={idx=>{setTab(idx);setPg(1);}}/>
    {/* Nota importante */}
    <div style={{background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"var(--cy)"}}>
      ℹ En Producciones, la facturación solo incluye <b>Auspiciadores Principales y Secundarios</b>. No incluye canjes, colaboradores ni partners.
    </div>
    {tab===0 && <>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar invoice o entidad..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","Emitida","Anulada"]} placeholder="Todo estados"/>
      {_cd&&_cd("facturacion")&&<Btn onClick={()=>openM("fact",{tipoDoc:"Invoice"})}>+ Nuevo Invoice</Btn>}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Documento</TH><TH>Entidad</TH><TH>Referencia</TH><TH>Estado</TH><TH>Total</TH><TH>Origen</TH><TH>Contrato</TH><TH>Fechas</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const ref=f.tipoRef==="produccion"
              ? (producciones||[]).find(x=>x.id===f.proId)
              : (f.tipoRef==="contenido" ? (piezas||[]).find(x=>x.id===f.proId) : (programas||[]).find(x=>x.id===f.proId));
            const pres=(presupuestos||[]).find(x=>x.id===f.presupuestoId);
            const ct=(contratos||[]).find(x=>x.id===f.contratoId);
            return<tr key={f.id}>
              <TD><div style={{fontWeight:700}}>{f.correlativo||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.tipoDoc||"Invoice"}</div><div style={{fontSize:10,color:f.recurring?"#00e08a":"var(--gr2)",marginTop:4}}>{recurringSummary(f, f.fechaEmision || today())}</div></TD>
              <TD><div>{ent?.nom||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.tipo==="auspiciador"?"Auspiciador":"Cliente"}</div></TD>
              <TD style={{fontSize:11}}>{ref?`${f.tipoRef==="produccion"?"📽":f.tipoRef==="contenido"?"📱":"📺"} ${ref.nom}`:"—"}</TD>
              <TD><Badge label={f.estado||"Emitida"}/></TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)"}}>{canPres?(pres?.correlativo||pres?.titulo||"—"):"—"}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)"}}>{canContracts?(ct?.nom||"—"):"—"}</TD>
              <TD style={{fontSize:11}}>
                <div>{f.fechaEmision?fmtD(f.fechaEmision):"—"}</div>
                <div style={{color:"var(--gr2)"}}>{f.fechaVencimiento?`Vence ${fmtD(f.fechaVencimiento)}`:"Sin venc."}</div>
              </TD>
              <TD><div style={{display:"flex",gap:4}}>
                {_cd&&_cd("facturacion")&&<><GBtn sm onClick={()=>openM("fact",f)}>✏</GBtn><XBtn onClick={()=>cDel(facturas,setFacturas,f.id,null,"Eliminada")}/></>}
                <GBtn sm onClick={async()=>{
                  const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
                  const ref=f.tipoRef==="produccion"
                    ? (producciones||[]).find(x=>x.id===f.proId)
                    : (f.tipoRef==="contenido" ? (piezas||[]).find(x=>x.id===f.proId) : (programas||[]).find(x=>x.id===f.proId));
                  await generarPDFFactura(f,ent,ref,empresa);
                }}>⬇ PDF</GBtn>
              </div></TD>
            </tr>;
          })}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin órdenes de factura"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
    </>}
    {tab===1 && <Card title="Cobranza" sub="Cuentas por cobrar por invoice emitido">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar invoice o entidad..."/>
        <FilterSel value={fc} onChange={v=>{setFc(v);setPg(1);}} options={COBRANZA_STATES} placeholder="Todo cobro"/>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Invoice</TH><TH>Entidad</TH><TH>Vencimiento</TH><TH>Monto</TH><TH>Estado de cobro</TH><TH>Acciones</TH></tr></thead>
          <tbody>
            {cobranzaDocs.length ? cobranzaDocs.slice((pg-1)*PP,pg*PP).map(f=>{
              const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
              const cobro=cobranzaState(f);
              const entityDocs=invoices.filter(doc=>doc.tipo===f.tipo && doc.entidadId===f.entidadId);
              return <tr key={f.id}>
                <TD><div style={{fontWeight:700}}>{f.correlativo||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.recurring?recurringSummary(f, f.fechaEmision || today()):"Único"}</div></TD>
                <TD>{ent?.nom||"—"}</TD>
                <TD style={{fontSize:11,color:cobro==="Retrasado de pago"?"#ff5566":"var(--gr2)"}}>{f.fechaVencimiento?fmtD(f.fechaVencimiento):"Sin vencimiento"}</TD>
                <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
                <TD><Badge label={cobro} color={cobro==="Pagado"?"green":cobro==="Retrasado de pago"?"red":cobro==="No pagado"?"gray":"yellow"}/></TD>
                <TD>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {_cd&&_cd("facturacion")&&<FSl value={cobro} onChange={e=>saveFacturaDoc({...f,cobranzaEstado:e.target.value,fechaPago:e.target.value==="Pagado"?(f.fechaPago||today()):"",})} style={{minWidth:170}}>
                      {COBRANZA_STATES.map(st=><option key={st}>{st}</option>)}
                    </FSl>}
                    <GBtn sm onClick={()=>sendBillingEmail(f,ent)}>✉ Correo</GBtn>
                    <GBtn sm onClick={()=>sendBillingWhatsApp(f,ent)}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      WhatsApp
                    </GBtn>
                    <GBtn sm onClick={()=>sendStatementEmail(entityDocs,ent,f.tipo)}>Estado cta. correo</GBtn>
                    <GBtn sm onClick={()=>sendStatementWhatsApp(entityDocs,ent,f.tipo)}>Estado cta. WA</GBtn>
                  </div>
                </TD>
              </tr>;
            }) : <tr><td colSpan={6}><Empty text="Sin invoices emitidos" sub="Emite un invoice para empezar a gestionar su cobranza."/></td></tr>}
          </tbody>
        </table>
      </div>
      <Paginator page={pg} total={cobranzaDocs.length} perPage={PP} onChange={setPg}/>
    </Card>}
    {tab===2 && <Card title="Recurrencias" sub="Administra series activas sin mezclar cobro ni pago">
      {seriesList.length ? <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Serie</TH><TH>Entidad</TH><TH>Estado</TH><TH>Meses</TH><TH>Próximo</TH><TH>Proyección</TH><TH></TH></tr></thead>
          <tbody>
            {seriesList.map(series=><tr key={series.id}>
              <TD><div style={{fontWeight:700}}>{series.first.correlativo?.replace(/-\d{2}$/,"") || series.first.tipoDoc || "Serie"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{series.first.tipoDoc || "Documento"} · {series.first.tipoRef==="produccion"?"Proyecto":series.first.tipoRef==="contenido"?"Campaña":"Producción"}</div></TD>
              <TD>{series.entityName || "—"}</TD>
              <TD><Badge label={series.status}/></TD>
              <TD mono>{series.docs.length}/{series.totalMonths}</TD>
              <TD style={{fontSize:11}}>{series.nextDate ? fmtMonthPeriod(series.nextDate) : "Sin próximos"}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(series.projected)}</TD>
              <TD><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {_cd&&_cd("facturacion")&&series.status!=="Cancelada"&&<GBtn sm onClick={()=>pauseSeries(series)}>{series.status==="Pausada"?"▶ Reactivar":"⏸ Pausar"}</GBtn>}
                {_cd&&_cd("facturacion")&&<GBtn sm onClick={()=>regenerateSeries(series)}>↻ Regenerar</GBtn>}
                {_cd&&_cd("facturacion")&&series.status!=="Cancelada"&&<XBtn onClick={()=>{if(!confirm("¿Cancelar los meses futuros de esta recurrencia?")) return; cutSeries(series);}} title="Cancelar recurrencia"/>}
              </div></TD>
            </tr>)}
          </tbody>
        </table>
      </div> : <Empty text="Sin recurrencias activas" sub="Crea un documento recurrente desde el botón de nuevo documento."/>}
    </Card>}
  </div>;
}

// ── ACTIVOS ───────────────────────────────────────────────────
function MActivo({open,data,producciones,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",categoria:"",marca:"",modelo:"",serial:"",valorCompra:"",fechaCompra:"",estado:"Disponible",asignadoA:"",obs:""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const CATS=listas?.catActivos||DEFAULT_LISTAS.catActivos;
  const ESTADOS=listas?.estadosActivos||DEFAULT_LISTAS.estadosActivos;
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Activo":"Nuevo Activo"} sub="Equipamiento o bien de la productora">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Canon EOS R5"/></FG><FG label="Categoría"><FSl value={f.categoria||""} onChange={e=>u("categoria",e.target.value)}><option value="">Seleccionar...</option>{CATS.map(c=><option key={c}>{c}</option>)}</FSl></FG></R2>
    <R3><FG label="Marca"><FI value={f.marca||""} onChange={e=>u("marca",e.target.value)} placeholder="Canon, Sony..."/></FG><FG label="Modelo"><FI value={f.modelo||""} onChange={e=>u("modelo",e.target.value)} placeholder="EOS R5"/></FG><FG label="N° Serie"><FI value={f.serial||""} onChange={e=>u("serial",e.target.value)} placeholder="SN-00001"/></FG></R3>
    <R3><FG label="Valor Compra"><FI type="number" value={f.valorCompra||""} onChange={e=>u("valorCompra",e.target.value)} placeholder="0"/></FG><FG label="Fecha Compra"><FI type="date" value={f.fechaCompra||""} onChange={e=>u("fechaCompra",e.target.value)}/></FG><FG label="Estado"><FSl value={f.estado||"Disponible"} onChange={e=>u("estado",e.target.value)}>{ESTADOS.map(s=><option key={s}>{s}</option>)}</FSl></FG></R3>
    <FG label="Asignado a Proyecto"><FSl value={f.asignadoA||""} onChange={e=>u("asignadoA",e.target.value)}><option value="">— Sin asignar —</option>{(producciones||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>
    <FG label="Observaciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Condición, accesorios incluidos..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function ViewActivos({empresa,activos,producciones,listas,openM,canDo:_cd,cSave,cDel,setActivos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fc,setFc]=useState("");const [fe,setFe]=useState("");const [vista,setVista]=useState("list");const [pg,setPg]=useState(1);const PP=10;
  const CATS=listas?.catActivos||DEFAULT_LISTAS.catActivos;
  const ESTADOS=listas?.estadosActivos||DEFAULT_LISTAS.estadosActivos;
  const fd=(activos||[]).filter(x=>x.empId===empId).filter(a=>(a.nom.toLowerCase().includes(q.toLowerCase())||(a.marca||"").toLowerCase().includes(q.toLowerCase()))&&(!fc||a.categoria===fc)&&(!fe||a.estado===fe));
  const totalValor=fd.reduce((s,a)=>s+Number(a.valorCompra||0),0);
  const dispCount=fd.filter(a=>a.estado==="Disponible").length;
  const enUsoCount=fd.filter(a=>a.estado==="En Uso").length;
  const statColor=s=>({Disponible:"#00e08a","En Uso":"var(--cy)","En Mantención":"#ffcc44",Dañado:"#ff8844","Dado de Baja":"#ff5566"}[s]||"var(--gr2)");
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total Activos"  value={fd.length}          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Disponibles"    value={dispCount}           accent="#00e08a"   vc="#00e08a"/>
      <Stat label="En Uso"         value={enUsoCount}          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Valor Total"    value={fmtM(totalValor)}    accent="#ffcc44"   vc="#ffcc44"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar activo o marca..."/>
      <FilterSel value={fc} onChange={v=>{setFc(v);setPg(1);}} options={CATS} placeholder="Todas categorías"/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={ESTADOS} placeholder="Todo estados"/>
      <ViewModeToggle value={vista} onChange={setVista}/>
      {_cd&&_cd("activos")&&<Btn onClick={()=>openM("activo",{})}>+ Nuevo Activo</Btn>}
    </div>
    {/* Chips por estado */}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {ESTADOS.map(s=>{const cnt=(activos||[]).filter(a=>a.empId===empId&&a.estado===s).length;return<div key={s} onClick={()=>setFe(fe===s?"":s)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${fe===s?statColor(s):"var(--bdr2)"}`,background:fe===s?statColor(s)+"22":"transparent",cursor:"pointer",fontSize:11,fontWeight:600,color:fe===s?statColor(s):"var(--gr3)"}}><span style={{width:8,height:8,borderRadius:"50%",background:statColor(s),flexShrink:0}}/>{s} ({cnt})</div>;})}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(a=>{const pro=(producciones||[]).find(x=>x.id===a.asignadoA);return <div key={a.id} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,lineHeight:1.25}}>{a.nom}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{[a.marca,a.modelo].filter(Boolean).join(" · ")||"Sin marca/modelo"}</div>
            </div>
            <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:10,fontWeight:700,background:statColor(a.estado)+"22",color:statColor(a.estado),border:`1px solid ${statColor(a.estado)}40`}}>{a.estado||"—"}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            <Badge label={a.categoria||"Sin categoría"} color="gray" sm/>
            {a.serial&&<Badge label={`SN ${a.serial}`} color="cyan" sm/>}
          </div>
          <div style={{fontSize:11,color:"var(--gr2)",display:"grid",gap:5}}>
            <span>Asignado: {pro?pro.nom:"Sin asignar"}</span>
            <span>Compra: {a.fechaCompra?fmtD(a.fechaCompra):"—"}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"auto",paddingTop:10,borderTop:"1px solid var(--bdr)"}}>
            <span style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{a.valorCompra?fmtM(a.valorCompra):"—"}</span>
            <div style={{display:"flex",gap:4}}>{_cd&&_cd("activos")&&<><GBtn sm onClick={()=>openM("activo",a)}>✏</GBtn><XBtn onClick={()=>cDel(activos,setActivos,a.id,null,"Activo eliminado")}/></>}</div>
          </div>
        </div>;})}
      </div>
      {!fd.length&&<Empty text="Sin activos registrados" sub={_cd&&_cd("activos")?"Registra el primero con el botón superior":""}/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Categoría</TH><TH>Marca/Modelo</TH><TH>N° Serie</TH><TH>Estado</TH><TH>Asignado a</TH><TH>Valor</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(a=>{const pro=(producciones||[]).find(x=>x.id===a.asignadoA);return<tr key={a.id}>
            <TD bold>{a.nom}</TD>
            <TD><Badge label={a.categoria||"—"} color="gray" sm/></TD>
            <TD style={{fontSize:12}}>{[a.marca,a.modelo].filter(Boolean).join(" · ")||"—"}</TD>
            <TD mono style={{fontSize:11}}>{a.serial||"—"}</TD>
            <TD><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:statColor(a.estado)+"22",color:statColor(a.estado),border:`1px solid ${statColor(a.estado)}40`}}>{a.estado||"—"}</span></TD>
            <TD style={{fontSize:12}}>{pro?pro.nom:<span style={{color:"var(--gr)"}}>Sin asignar</span>}</TD>
            <TD mono style={{fontSize:12}}>{a.valorCompra?fmtM(a.valorCompra):"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>
              {_cd&&_cd("activos")&&<><GBtn sm onClick={()=>openM("activo",a)}>✏</GBtn><XBtn onClick={()=>cDel(activos,setActivos,a.id,null,"Activo eliminado")}/></>}
            </div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin activos registrados" sub={_cd&&_cd("activos")?"Registra el primero con el botón superior":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
    {/* Panel por categoría */}
    {CATS.filter(c=>(activos||[]).some(a=>a.empId===empId&&a.categoria===c)).length>0&&<div style={{marginTop:16}}>
      <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700,marginBottom:12}}>Por Categoría</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {CATS.filter(c=>(activos||[]).some(a=>a.empId===empId&&a.categoria===c)).map(c=>{
          const items=(activos||[]).filter(a=>a.empId===empId&&a.categoria===c);
          const val=items.reduce((s,a)=>s+Number(a.valorCompra||0),0);
          return <div key={c} onClick={()=>setFc(fc===c?"":c)} style={{background:"var(--card)",border:`1px solid ${fc===c?"var(--cy)":"var(--bdr)"}`,borderRadius:8,padding:"12px 14px",cursor:"pointer",transition:".1s"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:fc===c?"var(--cy)":"var(--wh)"}}>{items.length}</div>
            <div style={{fontSize:11,fontWeight:600,marginTop:2}}>{c}</div>
            {val>0&&<div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{fmtM(val)}</div>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}

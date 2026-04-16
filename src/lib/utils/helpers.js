export const DAY_MS = 24 * 60 * 60 * 1000;
const HASH_RE = /^[a-f0-9]{64}$/i;

export const uid = () => "_" + Math.random().toString(36).slice(2, 10);
export const today = () => new Date().toISOString().split("T")[0];
export const nowIso = () => new Date().toISOString();
export const REQUIRED_SYSTEM_USERS = [
  {
    email: "mgonzalezgalle@gmail.com",
    name: "Matías González Galle",
    passwordHash: "0e7dd2c74bc95f8332e2351e63750de2d993d1fa27a15f7ccd9e68654b296e30",
    role: "superadmin",
    empId: null,
    active: true,
    isCrew: false,
    crewRole: "",
  },
];

export function isPasswordHash(v = "") {
  return HASH_RE.test(String(v || ""));
}

export function normalizeEmailValue(v = "") {
  return String(v || "").trim().toLowerCase();
}

export function ensureRequiredSystemUsers(users = [], requiredUsers = REQUIRED_SYSTEM_USERS) {
  const base = Array.isArray(users) ? [...users] : [];
  const byEmail = new Map(base.filter(Boolean).map(u => [normalizeEmailValue(u.email), u]));
  requiredUsers.forEach(req => {
    const key = normalizeEmailValue(req.email);
    const existing = byEmail.get(key);
    const nextUser = existing
      ? {
          ...existing,
          name: existing.name || req.name,
          email: req.email,
          passwordHash: req.passwordHash,
          role: req.role,
          empId: req.empId,
          active: req.active,
          isCrew: req.isCrew,
          crewRole: req.crewRole,
        }
      : {
          id: uid(),
          ...req,
        };
    byEmail.set(key, nextUser);
  });
  return Array.from(byEmail.values());
}

function crewUserId(userId = "") {
  return userId || uid();
}

export function buildInternalCrewFromUser(user = {}, existing = {}) {
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

export function syncCrewWithUsers(allUsers = [], existingCrew = []) {
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

export function addMonths(dateStr = today(), months = 0) {
  const [year, month, day] = String(dateStr || today()).split("-").map(Number);
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  if (Number.isNaN(base.getTime())) return dateStr || today();
  base.setMonth(base.getMonth() + Number(months || 0));
  return base.toISOString().split("T")[0];
}

export const fmtM = n => "$" + Number(n || 0).toLocaleString("es-CL");

export function fmtMoney(n, currency = "CLP") {
  const value = Number(n || 0);
  if (currency === "UF") return `UF ${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (currency === "USD") return "US$" + value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === "EUR") return "€" + value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return fmtM(value);
}

export const fmtD = d => {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return d || "—";
  }
};

export const fmtDT = d => {
  try {
    return new Date(d || nowIso()).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d || "—";
  }
};

export function fmtMonthPeriod(d) {
  try {
    return new Date(`${d || today()}T12:00:00`).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  } catch {
    return d || "—";
  }
}

export const PRINT_COLORS = [
  { value: "#545454", label: "Gris ejecutivo" },
  { value: "#000000", label: "Negro" },
  { value: "#172554", label: "Azul institucional" },
];

export const DEFAULT_LISTAS = {
  tiposPro: ["Producción","Podcast","Contenido Audiovisual","Spot Publicitario","Documental","Web Series","Videoclip","Evento","Otro"],
  estadosPro: ["Pre-Producción","En Curso","Post-Producción","Finalizado","Pausado"],
  tiposPg: ["Producción","Podcast","Web Series","Talk Show","Documental","Otro"],
  estadosPg: ["Activo","En Desarrollo","Pausado","Finalizado"],
  freqsPg: ["Diario","Semanal","Quincenal","Mensual","Irregular"],
  estadosEp: ["Planificado","Grabado","En Edición","Programado","Publicado","Cancelado"],
  tiposAus: ["Auspiciador Principal","Auspiciador Secundario","Colaborador","Canje","Media Partner"],
  frecPagoAus: ["Mensual","Semestral","Anual","Único"],
  estadosAus: ["Activo","Negociación","Vencido","Cancelado"],
  tiposCt: ["Producción","Auspicio","Servicio","Licencia","Confidencialidad","Otro"],
  estadosCt: ["Borrador","En Revisión","Firmado","Vigente","Vencido"],
  catMov: ["General","Honorarios","Equipamiento","Locación","Post-Producción","Transporte","Alimentación","Marketing","Producción","Impuestos","Otros"],
  industriasCli: ["Retail","Tecnología","Salud","Educación","Entretenimiento","Gastronomía","Inmobiliaria","Servicios","Media","Gobierno","Banca","Energía","Otro"],
  estadosCamp: ["Planificada","Activa","Pausada","Cerrada"],
  plataformasContenido: ["Instagram","TikTok","Facebook","LinkedIn","YouTube","X","Multi-plataforma"],
  formatosPieza: ["Reel","Carrusel","Historia","TikTok","Post","Video","Story","Otro"],
  estadosPieza: ["Planificado","Guion / Idea","Producción","Edición","En revisión cliente","Correcciones","Aprobado","Programado","Publicado","Cancelado"],
  areasCrew: ["Producción","Técnica","Postprod.","Dirección","Arte","Sonido","Fotografía","Otro"],
  rolesCrew: ["Conductor","Conductora","Director","Productora General","Productor Ejecutivo","Director de Cámara","Camarógrafo","Sonidista","Iluminador","Editor","Colorista","Diseñador Gráfico","Asistente de Producción","Community Manager","Maquillaje","Vestuario","Otro"],
  estadosPres: ["Pendiente","Borrador","Enviado","En Revisión","Aceptado","Rechazado"],
  monedas: ["CLP","UF","USD","EUR"],
  impuestos: ["Sin impuesto","IVA 19%","Boleta Honorarios 15,25%"],
  tiposPres: ["Proyecto","Producción","Contenidos","Servicio"],
  estadosFact: ["Borrador","Emitida","Anulada"],
  tiposEntidadFact: ["Cliente","Auspiciador"],
  tiposDocFact: ["Factura Afecta","Factura Exenta","Boleta Afecta","Boleta Exenta","Nota de Crédito","Nota de Débito","Guía de Despacho","Orden de Factura","Invoice"],
  tiposDocPagar: ["Factura Afecta","Boleta de Honorarios","Factura Exenta"],
  catActivos: ["Cámara","Lente","Iluminación","Sonido","Estabilizador","Monitor","Storage","Computación","Transporte","Set Dressing","Drone","Accesorio","Otro"],
  estadosActivos: ["Disponible","Asignado","En Mantención","Baja"],
  prioridadesTarea: ["Alta","Media","Baja"],
  estadosTarea: ["Pendiente","En Progreso","En Revisión","Completada"],
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CAMPANA_ESTADOS = ["Planificada","Activa","Pausada","Cerrada"];
const PIEZA_ESTADOS = ["Planificado","Creado","En Edición","Entregado Cliente","Programado","Correcciones","Publicado","Cancelado"];

export function companyPrintColor(empresa = {}) {
  return PRINT_COLORS.find(opt => opt.value === empresa?.printColor)?.value || "#172554";
}

export const DEFAULT_PRINT_LAYOUTS = {
  budget: {
    accent: "#1f2f5f",
    stampWidth: 158,
    stampHeight: 84,
    companyTitleSize: 18,
    metaSize: 9,
    sectionTitleSize: 9.4,
    sectionBodySize: 8.6,
    detailTitleSize: 9,
    detailHeaderSize: 7.7,
    detailBodySize: 7.1,
    detailColWidth: 300,
    recurrenceColWidth: 78,
    qtyColWidth: 34,
    unitColWidth: 74,
    totalColWidth: 42,
    summaryLabelSize: 7.5,
    summaryValueSize: 10,
  },
  billing: {
    accent: "#1f2f5f",
    stampWidth: 170,
    stampHeight: 82,
    companyTitleSize: 17,
    metaSize: 8.7,
    sectionTitleSize: 9.2,
    sectionBodySize: 8.8,
    summaryLabelSize: 7.5,
    summaryValueSize: 10,
  },
};

export function normalizePrintLayouts(raw = {}) {
  const budget = { ...DEFAULT_PRINT_LAYOUTS.budget, ...(raw?.budget || {}) };
  const billing = { ...DEFAULT_PRINT_LAYOUTS.billing, ...(raw?.billing || {}) };
  return { budget, billing };
}

export function daysUntil(date) {
  if (!date) return null;
  const target = new Date(date + "T12:00:00");
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - new Date().getTime()) / DAY_MS);
}

export function hasAddon(empresa, addon) {
  return Array.isArray(empresa?.addons) && empresa.addons.includes(addon);
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

export function contractsForReference(contratos = [], cliId = "", refType = "", refId = "") {
  const base = (contratos || []).filter(ct => !cliId || ct.cliId === cliId);
  if (!refType || !refId) return base;
  return base.filter(ct => contractMatchesReference(ct, refType, refId));
}

export function contractVisualState(contract = {}) {
  const days = daysUntil(contract.vig);
  if (days === null) return contract.est || "Borrador";
  if (days < 0) return "Vencido";
  if (days <= Number(contract.alertaDias || 30)) return "Por vencer";
  return contract.est || "Borrador";
}

export function budgetRefLabel(item = {}, producciones = [], programas = [], piezas = []) {
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

export function invoiceEntityName(fact = {}, clientes = [], auspiciadores = []) {
  if (fact.tipo === "auspiciador") return (auspiciadores || []).find(x => x.id === fact.entidadId)?.nom || "—";
  return (clientes || []).find(x => x.id === fact.entidadId)?.nom || "—";
}

function normalizePaymentDetails(empresa = {}) {
  const details = empresa?.paymentDetails || {};
  return {
    holder: details.holder || empresa?.nombre || "",
    rut: details.rut || empresa?.rut || "",
    bank: details.bank || "",
    accountType: details.accountType || "",
    accountNumber: details.accountNumber || "",
    email: details.email || "",
    notes: details.notes || "",
  };
}

export function companyPaymentInfoText(empresa = {}, extra = {}) {
  const payment = normalizePaymentDetails(empresa);
  const blocks = [];
  const intro = extra?.intro === false ? "" : "Los pagos correspondientes a la presente propuesta deberán efectuarse mediante transferencia bancaria a la siguiente cuenta:";
  if (intro) blocks.push(intro);
  const details = [
    payment.holder ? `Titular: ${payment.holder}` : "",
    payment.rut ? `RUT: ${payment.rut}` : "",
    payment.bank ? `Banco: ${payment.bank}` : "",
    payment.accountType ? `Tipo de cuenta: ${payment.accountType}` : "",
    payment.accountNumber ? `Número de cuenta: ${payment.accountNumber}` : "",
    payment.email ? `Correo para envío de comprobante: ${payment.email}` : "",
  ].filter(Boolean).join("\n");
  if (details) blocks.push(details);
  const notes = [payment.notes || "", extra?.notes || "", extra?.dueDate ? `Fecha de pago esperada: ${fmtD(extra.dueDate)}` : ""].filter(Boolean).join("\n");
  if (notes) blocks.push(notes);
  return blocks.filter(Boolean).join("\n\n");
}

export function recurringSummary(item = {}, fallbackDate = today()) {
  if (!item?.recurring) return "Único";
  const count = Math.max(1, Number(item.recMonths || 1));
  const start = item.recStart || item.fechaEmision || fallbackDate;
  return `Mensual · ${count} mes${count === 1 ? "" : "es"} · desde ${fmtMonthPeriod(start)}`;
}

export const normalizeSocialPiece = (piece = {}, campaign = {}) => ({
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
  publishDate: piece.publishDate || "",
  publishedAt: piece.publishedAt || "",
  link: piece.link || piece.url || "",
  finalLink: piece.finalLink || "",
  comentarios: Array.isArray(piece.comentarios) ? piece.comentarios : [],
});

export const normalizeSocialCampaign = (item = {}) => {
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

export const normalizeSocialCampaigns = items => (Array.isArray(items) ? items.filter(Boolean).map(normalizeSocialCampaign) : []);
export const countCampaignPieces = campaign => (Array.isArray(campaign?.piezas) ? campaign.piezas.length : 0);

export function budgetPaymentMethodValue(item = {}) {
  return item?.metodoPago || item?.paymentMethod || item?.metodo || "";
}

export function budgetPaymentDateValue(item = {}) {
  return item?.fechaPago || item?.paymentDate || item?.fechaVencimiento || "";
}

export function budgetPaymentNotesValue(item = {}) {
  return item?.notasPago || item?.paymentNotes || item?.notas || "";
}

export function budgetObservationValue(item = {}) {
  return item?.obs || item?.observaciones || "";
}

export function cobranzaState(doc = {}) {
  if (doc.cobranzaEstado) return doc.cobranzaEstado;
  if (doc.estado === "Pagada") return "Pagado";
  if (doc.fechaVencimiento && String(doc.fechaVencimiento) < today()) return "Retrasado de pago";
  return "Pendiente de pago";
}

export function billingContact(entity = {}, type = "cliente") {
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

export function openMailto(to = "", subject = "", body = "") {
  window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
}

export function openWhatsApp(tel = "", body = "") {
  const num = String(tel || "").replace(/[^0-9]/g, "");
  if (!num) return;
  const waNum = num.startsWith("56") ? num : `56${num}`;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(body)}`, "_blank");
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function commentAttachmentFromFile(file) {
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

export function normalizeCommentAttachments(item = {}) {
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

export async function supportAttachmentFromFile(file) {
  return commentAttachmentFromFile(file);
}

export function supportThreadPreviewText(thread = null) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return messages[messages.length - 1]?.text || "Todavía no hay mensajes en esta conversación.";
}

export function buildSupportSettings(settings = {}, users = []) {
  const adminUsers = (Array.isArray(users) ? users : []).filter(u => ["admin", "superadmin"].includes(u?.role) && u.active !== false);
  const fallbackTeamIds = adminUsers.slice(0, 3).map(u => u.id);
  return {
    enabledByDefault: settings?.enabledByDefault !== false,
    teamIds: Array.isArray(settings?.teamIds) && settings.teamIds.length ? settings.teamIds : fallbackTeamIds,
    welcomeMessage: settings?.welcomeMessage || "Hola, somos el equipo de soporte de Produ. Cuéntanos en qué te podemos ayudar y te responderemos a la brevedad.",
    autoAckEnabled: settings?.autoAckEnabled !== false,
    autoAckMessage: settings?.autoAckMessage || "Recibimos tu mensaje correctamente. Un administrador revisará esta conversación muy pronto.",
    helpLinkLabel: settings?.helpLinkLabel || "Ayúdanos a mejorar el producto",
    helpLinkUrl: settings?.helpLinkUrl || "",
    helpSearchPlaceholder: settings?.helpSearchPlaceholder || "Buscar ayuda",
  };
}

export function normalizeSupportThreads(threads = [], empresas = [], users = [], settings = {}) {
  const normalizedSettings = buildSupportSettings(settings, users);
  const empMap = Object.fromEntries((empresas || []).map(emp => [emp.id, emp]));
  const userMap = Object.fromEntries((users || []).map(user => [user.id, user]));
  return (Array.isArray(threads) ? threads : [])
    .filter(Boolean)
    .map((thread, idx) => {
      const messages = (Array.isArray(thread.messages) ? thread.messages : [])
        .filter(Boolean)
        .map(msg => ({
          id: msg.id || uid(),
          authorType: msg.authorType || "tenant",
          authorId: msg.authorId || "",
          authorName: msg.authorName || (msg.authorId ? userMap[msg.authorId]?.name : "") || "Usuario",
          text: String(msg.text || ""),
          attachments: normalizeCommentAttachments({ attachments: msg.attachments || [] }),
          automated: msg.automated === true,
          createdAt: msg.createdAt || nowIso(),
        }));
      const assignedAdminIds = (Array.isArray(thread.assignedAdminIds) ? thread.assignedAdminIds : normalizedSettings.teamIds)
        .filter(id => userMap[id])
        .slice(0, 4);
      const updatedAt = thread.updatedAt || messages[messages.length - 1]?.createdAt || thread.createdAt || nowIso();
      return {
        id: thread.id || uid(),
        empId: thread.empId || "",
        status: thread.status || "open",
        createdAt: thread.createdAt || updatedAt,
        updatedAt,
        lastMessageAt: updatedAt,
        createdBy: thread.createdBy || "",
        assignedAdminIds,
        title: thread.title || `Soporte ${empMap[thread.empId]?.nombre || idx + 1}`,
        messages,
      };
    })
    .sort((a, b) => String(b.lastMessageAt || "").localeCompare(String(a.lastMessageAt || "")));
}

export function ensureSupportThread(threads = [], empId = "", empresa = null, users = [], settings = {}) {
  const normalized = normalizeSupportThreads(threads, empresa ? [empresa] : [], users, settings);
  const existing = normalized.find(thread => thread.empId === empId);
  if (existing) return { threads: normalized, thread: existing, created: false };
  const supportSettings = buildSupportSettings(settings, users);
  const ts = nowIso();
  const welcome = {
    id: uid(),
    authorType: "system",
    authorId: "",
    authorName: "Soporte Produ",
    text: supportSettings.welcomeMessage,
    attachments: [],
    automated: true,
    createdAt: ts,
  };
  const nextThread = {
    id: uid(),
    empId,
    status: "open",
    createdAt: ts,
    updatedAt: ts,
    lastMessageAt: ts,
    createdBy: "",
    assignedAdminIds: supportSettings.teamIds,
    title: `Soporte ${empresa?.nombre || "Tenant"}`,
    messages: [welcome],
  };
  return { threads: [nextThread, ...normalized], thread: nextThread, created: true };
}

export function companyBillingDiscountPct(empresa = {}) {
  const pct = Number(empresa?.billingDiscountPct || 0);
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export function companyReferralDiscountMonthsPending(empresa = {}) {
  const months = Number(empresa?.referralDiscountMonthsPending || 0);
  if (!Number.isFinite(months)) return 0;
  return Math.max(0, Math.floor(months));
}

export function companyReferralDiscountHistory(empresa = {}) {
  return Array.isArray(empresa?.referralDiscountHistory) ? empresa.referralDiscountHistory : [];
}

export function companyBillingBaseNet(empresa = {}) {
  const gross = Number(empresa?.billingMonthly || 0);
  return Math.max(0, Math.round(gross * (1 - companyBillingDiscountPct(empresa) / 100)));
}

export function companyBillingNet(empresa = {}) {
  if (companyReferralDiscountMonthsPending(empresa) > 0) return 0;
  return companyBillingBaseNet(empresa);
}

export function companyBillingStatus(empresa = {}) {
  return empresa?.billingStatus || "Pendiente";
}

export function companyPaymentDayLabel(empresa = {}) {
  const day = Number(empresa?.billingDueDay || 0);
  return day > 0 ? `Cada día ${day}` : "Sin definir";
}

export function companyIsUpToDate(empresa = {}) {
  return ["Al día", "Pagado"].includes(companyBillingStatus(empresa));
}

export function shouldConsumeReferralDiscountMonth(prevEmpresa = {}, patch = {}) {
  if (!Object.prototype.hasOwnProperty.call(patch, "billingLastPaidAt")) return false;
  const prevDate = String(prevEmpresa?.billingLastPaidAt || "");
  const nextDate = String(patch?.billingLastPaidAt || "");
  if (!nextDate || nextDate === prevDate) return false;
  return companyReferralDiscountMonthsPending(prevEmpresa) > 0;
}

function tenantOrdinal(tenantCode = "") {
  const match = String(tenantCode || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

export function nextTenantCode(empresas = []) {
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

export function normalizeEmpresasTenantCodes(empresas = []) {
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
    const addons = Array.isArray(emp?.addons) ? emp.addons : [];
    const withTasks = addons.includes("tareas") ? addons : [...addons, "tareas"];
    const withCrm = withTasks.includes("crm") ? withTasks : [...withTasks, "crm"];
    return {
      ...emp,
      addons: withCrm,
      migratedTasksAddon: true,
      migratedCrmAddon: true,
    };
  });
}

export function normalizeEmpresasModel(empresas = []) {
  return normalizeEmpresasAddons(normalizeEmpresasTenantCodes(empresas)).map(emp => ({
    ...emp,
    supportChatEnabled: emp?.supportChatEnabled === true,
    freshdeskEnabled: emp?.freshdeskEnabled === true,
    referralCode: buildReferralCode(emp),
    referralCredits: Number(emp?.referralCredits || 0),
    referralDiscountMonthsPending: Number(emp?.referralDiscountMonthsPending || 0),
    referralDiscountHistory: Array.isArray(emp?.referralDiscountHistory) ? emp.referralDiscountHistory : [],
  }));
}

export function companyGoogleCalendarEnabled(empresa = {}) {
  return !!empresa?.googleCalendarEnabled;
}

export function userGoogleCalendar(user = {}) {
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

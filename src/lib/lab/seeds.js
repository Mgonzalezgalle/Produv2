import { normalizeCrmStages, crmNormalizeOpportunity } from "../utils/crm";
import { buildSeedTreasuryData } from "../utils/treasury";

export const SEED_EMPRESAS = today => [
  { id: "emp1", tenantCode: "T-0001", nombre: "Play Media SpA", rut: "78.118.348-2", dir: "Av. Providencia 1234, Santiago", tel: "+56 2 2345 6789", ema: "contacto@playmedia.cl", logo: "", color: "#00d4e8", addons: ["television", "social", "presupuestos", "facturacion", "tesoreria", "activos", "contratos", "crew"], active: true, plan: "pro", googleCalendarEnabled: false, billingCurrency: "UF", billingMonthly: 12.9, billingDiscountPct: 10, billingDiscountNote: "Partner estratégico", billingStatus: "Al día", billingDueDay: 5, billingLastPaidAt: "2026-04-01", contractOwner: "Matías González", clientPortalUrl: "https://portal.produ.cl/playmedia", cr: today() },
  { id: "emp2", tenantCode: "T-0002", nombre: "González & Asociados", rut: "78.171.372-4", dir: "Las Condes 456, Santiago", tel: "+56 9 8765 4321", ema: "info@gonzalez.cl", logo: "", color: "#00e08a", addons: ["presupuestos"], active: true, plan: "starter", googleCalendarEnabled: false, billingCurrency: "UF", billingMonthly: 3.2, billingDiscountPct: 0, billingDiscountNote: "", billingStatus: "Pendiente", billingDueDay: 10, billingLastPaidAt: "2026-03-10", contractOwner: "Carla González", clientPortalUrl: "https://portal.produ.cl/gonzalez", cr: today() },
];

export const SEED_USERS = [
  { id: "u0", name: "Super Admin Produ", email: "super@produ.cl", passwordHash: "4e4c56e4a15f89f05c2f4c72613da2a18c9665d4f0d6acce16415eb06f9be776", role: "superadmin", empId: null, active: true },
  { id: "u1", name: "Admin Play Media", email: "admin@playmedia.cl", passwordHash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9", role: "admin", empId: "emp1", active: true },
  { id: "u2", name: "María Productora", email: "maria@playmedia.cl", passwordHash: "97f08b12c985e818cb86cd3d6f7c4dec65a586d95874ce54db426d20d383ab2a", role: "productor", empId: "emp1", active: true },
  { id: "u3", name: "Carlos Comercial", email: "carlos@playmedia.cl", passwordHash: "6144f27586e33c13fd0a75787389fb03e046b2fef1f22a2af0f4cf6e803172a7", role: "comercial", empId: "emp1", active: true },
  { id: "u4", name: "Admin González", email: "admin@gonzalez.cl", passwordHash: "f5a78f31ce940dbaa4ae5aebe2a6e500e3f2d1ef26d9e1963d2d0db50ae4522c", role: "admin", empId: "emp2", active: true },
];

export function buildSeedData(empId, { CRM_STAGE_SEED }) {
  return {
    clientes: empId === "emp1" ? [
      { id: "c1", empId, nom: "BancoSeguro S.A.", rut: "96.543.210-0", ind: "Servicios", dir: "Huérfanos 1234", not: "Cliente desde 2023", contactos: [{ id: "cc1", nom: "Andrea Morales", car: "Gerente Mktg", ema: "amorales@bancoseguro.cl", tel: "+56 9 8765 4321", not: "" }] },
      { id: "c2", empId, nom: "FoodTech Chile", rut: "77.123.456-7", ind: "Gastronomía", dir: "Providencia 456", not: "", contactos: [{ id: "cc2", nom: "Carlos Ibáñez", car: "CEO", ema: "carlos@foodtech.cl", tel: "+56 9 9876 5432", not: "" }] },
      { id: "c3", empId, nom: "EduFutura S.A.", rut: "65.432.100-1", ind: "Educación", dir: "Las Condes 789", not: "Contrato anual", contactos: [{ id: "cc3", nom: "Valentina Ríos", car: "Dir. Comunicaciones", ema: "v.rios@edufutura.cl", tel: "+56 9 1234 5678", not: "Contacto principal" }] },
    ] : [
      { id: "c10", empId, nom: "Cliente González 1", rut: "11.111.111-1", ind: "Tecnología", dir: "", not: "", contactos: [{ id: "cc10", nom: "Juan Pérez", car: "Gerente", ema: "juan@cliente.cl", tel: "+56 9 0000 0001", not: "" }] },
    ],
    producciones: empId === "emp1" ? [
      { id: "p1", empId, nom: "Podcast BancoSeguro", cliId: "c1", tip: "Podcast", est: "En Curso", ini: "2025-03-01", fin: "2025-06-30", des: "8 episodios sobre finanzas.", crewIds: [] },
      { id: "p2", empId, nom: "Spots FoodTech Q2", cliId: "c2", tip: "Spot Publicitario", est: "Post-Producción", ini: "2025-04-01", fin: "2025-05-15", des: "3 spots 30 seg.", crewIds: [] },
      { id: "p3", empId, nom: "Pack EduFutura", cliId: "c3", tip: "Contenido Audiovisual", est: "En Curso", ini: "2025-01-01", fin: "2025-12-31", des: "4 videos + reels/mes.", crewIds: [] },
    ] : [],
    programas: empId === "emp1" ? [
      { id: "pg1", empId, nom: "Chile Emprende", tip: "Producción", can: "Canal 24H", est: "Activo", totalEp: 24, fre: "Semanal", temporada: "T1 2025", conductor: "Roberto Gómez", prodEjec: "María González", des: "Emprendimiento e innovación.", cliId: "", crewIds: [] },
      { id: "pg2", empId, nom: "El Ágora", tip: "Podcast", can: "Spotify", est: "Activo", totalEp: 52, fre: "Semanal", temporada: "T1 2025", conductor: "Ana Ruiz", prodEjec: "Carlos Pérez", des: "Cultura y sociedad.", cliId: "", crewIds: [] },
    ] : [],
    piezas: empId === "emp1" ? [
      { id: "pz1", empId, nom: "Campaña BancoSeguro Abril", cliId: "c1", plataforma: "Instagram", mes: "Abril", ano: 2026, est: "Activa", ini: "2026-04-01", fin: "2026-04-30", des: "Campaña mensual para awareness y educación financiera.", crewIds: [], comentarios: [], piezas: [{ id: "pc1", nom: "Reel Lanzamiento BancoSeguro", formato: "Reel", plataforma: "Instagram", est: "Planificado", ini: "2026-04-03", fin: "2026-04-08", des: "Pieza de awareness para el lanzamiento de campaña." }, { id: "pc2", nom: "Carrusel Beneficios Cuenta", formato: "Carrusel", plataforma: "Instagram", est: "Creado", ini: "2026-04-05", fin: "2026-04-10", des: "Resumen visual de beneficios y CTA." }] },
      { id: "pz2", empId, nom: "Campaña FoodTech Abril", cliId: "c2", plataforma: "Instagram", mes: "Abril", ano: 2026, est: "Activa", ini: "2026-04-01", fin: "2026-04-30", des: "Parrilla de contenidos de producto y recetas para redes.", crewIds: [], comentarios: [], piezas: [{ id: "pc3", nom: "Carrusel Tips FoodTech", formato: "Carrusel", plataforma: "Instagram", est: "En Edición", ini: "2026-04-01", fin: "2026-04-05", des: "Serie mensual de tips de cocina y tecnologia." }, { id: "pc4", nom: "Historia Promo Semanal", formato: "Historia", plataforma: "Instagram", est: "Programado", ini: "2026-04-07", fin: "2026-04-07", des: "Recordatorio de promo para historias." }] },
      { id: "pz3", empId, nom: "Campaña EduFutura Abril", cliId: "c3", plataforma: "TikTok", mes: "Abril", ano: 2026, est: "Planificada", ini: "2026-04-01", fin: "2026-04-30", des: "Contenidos mensuales para admisión y engagement.", crewIds: [], comentarios: [], piezas: [{ id: "pc5", nom: "TikTok EduFutura Abril", formato: "TikTok", plataforma: "TikTok", est: "Correcciones", ini: "2026-04-02", fin: "2026-04-06", des: "Contenido para admision y engagement de estudiantes." }] },
    ] : [],
    episodios: empId === "emp1" ? [
      { id: "ep1", empId, pgId: "pg1", num: 1, titulo: "Los nuevos emprendedores", estado: "Publicado", fechaGrab: "2025-01-10", fechaEmision: "2025-01-15", invitado: "Pedro Vargas", locacion: "Estudio A", duracion: "45", notas: "", crewIds: [], comentarios: [] },
      { id: "ep2", empId, pgId: "pg1", num: 2, titulo: "Financiamiento pymes", estado: "Publicado", fechaGrab: "2025-01-17", fechaEmision: "2025-01-22", invitado: "Laura Méndez", locacion: "Estudio A", duracion: "42", notas: "", crewIds: [], comentarios: [] },
      { id: "ep3", empId, pgId: "pg1", num: 3, titulo: "Marketing digital", estado: "Grabado", fechaGrab: "2025-01-24", fechaEmision: "2025-01-29", invitado: "Andrés Solís", locacion: "Estudio B", duracion: "38", notas: "Pendiente color.", crewIds: [], comentarios: [] },
      { id: "ep4", empId, pgId: "pg1", num: 4, titulo: "E-commerce LATAM", estado: "En Edición", fechaGrab: "2025-01-31", fechaEmision: "2025-02-05", invitado: "Carmen Torres", locacion: "Estudio A", duracion: "50", notas: "", crewIds: [], comentarios: [] },
      { id: "ep5", empId, pgId: "pg1", num: 5, titulo: "Startups sociales", estado: "Planificado", fechaGrab: "2025-02-07", fechaEmision: "2025-02-12", invitado: "Por confirmar", locacion: "Estudio A", duracion: "45", notas: "", crewIds: [], comentarios: [] },
      { id: "ep6", empId, pgId: "pg2", num: 1, titulo: "¿Qué es ciudadanía?", estado: "Publicado", fechaGrab: "2025-02-03", fechaEmision: "2025-02-07", invitado: "Prof. I. Matta", locacion: "Estudio P", duracion: "62", notas: "", crewIds: [], comentarios: [] },
      { id: "ep7", empId, pgId: "pg2", num: 2, titulo: "Humanidades s.XXI", estado: "Planificado", fechaGrab: "2025-02-17", fechaEmision: "2025-02-21", invitado: "Por confirmar", locacion: "Estudio P", duracion: "60", notas: "", crewIds: [], comentarios: [] },
    ] : [],
    auspiciadores: empId === "emp1" ? [
      { id: "a1", empId, nom: "Banco Estado", tip: "Auspiciador Principal", con: "Pablo Muñoz", ema: "pmunoz@bce.cl", tel: "", pids: ["pg1"], mon: "2500000", vig: "2025-12-31", est: "Activo", frecPago: "Mensual", not: "Logo + menciones" },
      { id: "a2", empId, nom: "Entel", tip: "Auspiciador Secundario", con: "Lucía Torres", ema: "ltorres@entel.cl", tel: "", pids: ["pg1", "pg2"], mon: "1200000", vig: "2025-06-30", est: "Activo", frecPago: "Semestral", not: "Banner + mención" },
    ] : [],
    crmStages: normalizeCrmStages(CRM_STAGE_SEED),
    crmOpps: empId === "emp1" ? [
      crmNormalizeOpportunity({ id: "crm1", empId, nombre: "Campaña Invierno BancoSeguro", empresaMarca: "BancoSeguro S.A.", contacto: "Andrea Morales", email: "amorales@bancoseguro.cl", telefono: "+56 9 8765 4321", tipo_negocio: "cliente", stageId: "crm-st-4", status: "Activa", monto_estimado: 4200000, fecha_cierre_estimada: "2026-04-28", notas: "Campaña always-on con foco en educación financiera.", responsable: "u3", nextAction: "Enviar ajuste final de propuesta", nextActionDate: "2026-04-08" }, CRM_STAGE_SEED),
      crmNormalizeOpportunity({ id: "crm2", empId, nombre: "Patrocinio Chile Emprende T2", empresaMarca: "Entel", contacto: "Lucía Torres", email: "ltorres@entel.cl", telefono: "+56 9 7654 1234", tipo_negocio: "auspiciador", stageId: "crm-st-5", status: "En seguimiento", monto_estimado: 1800000, fecha_cierre_estimada: "2026-05-10", notas: "Interés en branded content y presencia editorial.", responsable: "u3", nextAction: "Confirmar reunión comercial", nextActionDate: "2026-04-09" }, CRM_STAGE_SEED),
    ] : [],
    crmActivities: empId === "emp1" ? [
      { id: "crma1", empId, opportunityId: "crm1", type: "created", text: "Oportunidad creada en CRM.", createdAt: "2026-04-01", byName: "Carlos Comercial" },
      { id: "crma2", empId, opportunityId: "crm1", type: "stage", text: "Etapa actualizada a Propuesta enviada.", createdAt: "2026-04-03", byName: "Carlos Comercial" },
      { id: "crma3", empId, opportunityId: "crm2", type: "created", text: "Lead ingresado desde gestión comercial.", createdAt: "2026-04-02", byName: "Carlos Comercial" },
    ] : [],
    contratos: empId === "emp1" ? [
      { id: "ct1", empId, nom: "Podcast BancoSeguro 2025", cliId: "c1", tip: "Producción", est: "Firmado", mon: "9000000", vig: "2025-06-30", arc: "", not: "8 episodios, 2 cuotas" },
      { id: "ct2", empId, nom: "EduFutura Anual 2025", cliId: "c3", tip: "Servicio", est: "Vigente", mon: "14400000", vig: "2025-12-31", arc: "", not: "12 meses" },
    ] : [],
    movimientos: empId === "emp1" ? [
      { id: "m1", empId, eid: "p1", et: "pro", tipo: "ingreso", mon: 4500000, des: "Cuota 1 BancoSeguro", cat: "General", fec: "2025-03-15" },
      { id: "m2", empId, eid: "p1", et: "pro", tipo: "ingreso", mon: 4500000, des: "Cuota 2 BancoSeguro", cat: "General", fec: "2025-04-15" },
      { id: "m3", empId, eid: "p1", et: "pro", tipo: "gasto", mon: 800000, des: "Arriendo estudio", cat: "Locación", fec: "2025-03-20" },
      { id: "m4", empId, eid: "p2", et: "pro", tipo: "ingreso", mon: 6000000, des: "Anticipo 50%", cat: "General", fec: "2025-04-05" },
      { id: "m5", empId, eid: "p2", et: "pro", tipo: "gasto", mon: 1200000, des: "Equipo cámara 4K", cat: "Equip.", fec: "2025-04-08" },
      { id: "m6", empId, eid: "p3", et: "pro", tipo: "ingreso", mon: 1200000, des: "Mensualidad Enero", cat: "General", fec: "2025-01-31" },
      { id: "m7", empId, eid: "p3", et: "pro", tipo: "ingreso", mon: 1200000, des: "Mensualidad Febrero", cat: "General", fec: "2025-02-28" },
      { id: "m8", empId, eid: "pg1", et: "pg", tipo: "ingreso", mon: 2500000, des: "Auspicio BCE Q1", cat: "General", fec: "2025-01-15" },
      { id: "m9", empId, eid: "pg1", et: "pg", tipo: "ingreso", mon: 1200000, des: "Auspicio Entel Q1", cat: "General", fec: "2025-01-20" },
      { id: "m10", empId, eid: "pg1", et: "pg", tipo: "gasto", mon: 600000, des: "Prod. eps 1-4", cat: "Honorarios", fec: "2025-01-30" },
      { id: "m11", empId, eid: "ep1", et: "ep", tipo: "gasto", mon: 180000, des: "Maquillaje ep.1", cat: "Producción", fec: "2025-01-10" },
      { id: "m12", empId, eid: "ep1", et: "ep", tipo: "gasto", mon: 120000, des: "Catering ep.1", cat: "Alimentación", fec: "2025-01-10" },
    ] : [],
    crew: empId === "emp1" ? [
      { id: "cr1", empId, nom: "Roberto Gómez", rol: "Conductor", area: "Producción", tel: "+56 9 1111 2222", ema: "roberto@playmedia.cl", dis: "Lun-Vie", tarifa: "$200.000/día", not: "Host Chile Emprende", active: true },
      { id: "cr2", empId, nom: "Felipe Mora", rol: "Director de Cámara", area: "Técnica", tel: "+56 9 3333 4444", ema: "felipe@playmedia.cl", dis: "Lun-Sáb", tarifa: "$150.000/día", not: "", active: true },
      { id: "cr3", empId, nom: "Carla Vega", rol: "Editora", area: "Postprod.", tel: "+56 9 4444 5555", ema: "carla@playmedia.cl", dis: "Mar-Vie", tarifa: "$120.000/día", not: "DaVinci Resolve", active: true },
      { id: "cr4", empId, nom: "Martín Díaz", rol: "Sonidista", area: "Técnica", tel: "+56 9 5555 6666", ema: "martin@playmedia.cl", dis: "Lun-Vie", tarifa: "$100.000/día", not: "", active: true },
    ] : [],
    eventos: [],
    presupuestos: [],
    facturas: [],
    ...buildSeedTreasuryData(empId),
    activos: [],
  };
}

import { useEffect, useMemo, useState } from "react";
import { contractsForReference } from "../lib/utils/helpers";

const FX_CURRENCIES = new Set(["UF", "USD", "EUR"]);

function isFxCurrency(currency = "CLP") {
  return FX_CURRENCIES.has(String(currency || "CLP").toUpperCase());
}

function normalizeExchangeRate(currency = "CLP", value = "") {
  if (!isFxCurrency(currency)) return 1;
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeStoredLine(it = {}, uid, defaultDesc = "") {
  return {
    ...it,
    id: it.id || uid(),
    desc: it.desc || defaultDesc,
    qty: Number(it.qty || 1),
    precio: Number(it.precioOrigen ?? it.precio ?? 0),
    precioOrigen: Number(it.precioOrigen ?? it.precio ?? 0),
    precioCLP: Number(it.precioCLP || 0),
    totalOrigen: Number(it.totalOrigen || 0),
    totalCLP: Number(it.totalCLP || 0),
  };
}

function budgetDraftKey(empresaId = "", userId = "") {
  return `produ:budgetDraft:${empresaId || "global"}:${userId || "anon"}`;
}

function loadBudgetDraft(empresaId = "", userId = "") {
  try {
    const raw = localStorage.getItem(budgetDraftKey(empresaId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBudgetDraft(empresaId = "", userId = "", draft = null) {
  try {
    if (!draft) {
      localStorage.removeItem(budgetDraftKey(empresaId, userId));
      return;
    }
    localStorage.setItem(budgetDraftKey(empresaId, userId), JSON.stringify(draft));
  } catch {}
}

export function useLabBudgetForm({
  open,
  data,
  empresa,
  currentUser,
  piezas,
  contratos,
  uid,
  today,
  hasAddon,
}) {
  const pieceLine = () => ({ id: uid(), desc: "Piezas mensuales", qty: 1, precio: 0, und: "pieza", recurrence: "monthly" });
  const empty = {
    titulo: "",
    cliId: "",
    tipo: "produccion",
    refId: "",
    estado: "Pendiente",
    validez: "30",
    moneda: "CLP",
    tipoCambio: "1",
    iva: true,
    metodoPago: "",
    fechaPago: "",
    notasPago: "",
    obs: "",
    items: [],
    contratoId: "",
    autoFactura: false,
    modoDetalle: "items",
    detallePiezas: "Piezas mensuales",
    pieceLines: [pieceLine()],
    recurring: false,
    recMonths: "6",
    recStart: today(),
  };

  const [f, setF] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKeyArgs = [empresa?.id || "", currentUser?.id || ""];

  useEffect(() => {
    if (!open) return;
    if (data?.id) {
      setDraftRestored(false);
      setF({
        ...data,
        tipoCambio: String(data.tipoCambio || (isFxCurrency(data.moneda) ? "" : "1")),
        items: (data.items || []).map((it) => ({ ...normalizeStoredLine(it, uid, ""), recurrence: it.recurrence || "once" })),
        pieceLines: (data.pieceLines || data.items || [])
          .filter((it) => it && it.und === "pieza")
          .map((it) => ({
            ...normalizeStoredLine(it, uid, "Piezas mensuales"),
            und: "pieza",
            recurrence: it.recurrence || "monthly",
          })) || [pieceLine()],
      });
      return;
    }
    const draft = loadBudgetDraft(...draftKeyArgs);
    if (draft) {
      setDraftRestored(true);
      setF({
        ...empty,
        ...draft,
        tipoCambio: String(draft.tipoCambio || (isFxCurrency(draft.moneda) ? "" : "1")),
        items: (draft.items || []).map((it) => ({ ...normalizeStoredLine(it, uid, ""), recurrence: it.recurrence || "once" })),
        pieceLines: (draft.pieceLines || draft.items || [])
          .filter((it) => it && it.und === "pieza")
          .map((it) => ({
            ...normalizeStoredLine(it, uid, "Piezas mensuales"),
            und: "pieza",
            recurrence: it.recurrence || "monthly",
          })) || [pieceLine()],
      });
      return;
    }
    setDraftRestored(false);
    setF({ ...empty });
  }, [data, open, empresa?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || data?.id || !Object.keys(f || {}).length) return;
    saveBudgetDraft(...draftKeyArgs, f);
  }, [f, open, data?.id, empresa?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canContracts = hasAddon(empresa, "contratos");
  const canInvoices = hasAddon(empresa, "facturacion");

  const addItem = () => setF((p) => ({ ...p, items: [...(p.items || []), { id: uid(), desc: "", qty: 1, precio: 0, precioOrigen: 0, precioCLP: 0, totalOrigen: 0, totalCLP: 0, und: "Unidad", recurrence: "once" }] }));
  const updItem = (i, k, v) => setF((p) => ({ ...p, items: (p.items || []).map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const delItem = (i) => setF((p) => ({ ...p, items: (p.items || []).filter((_, j) => j !== i) }));
  const addPieceLine = () => setF((p) => ({ ...p, pieceLines: [...(p.pieceLines || []), pieceLine()] }));
  const updPieceLine = (i, k, v) => setF((p) => ({ ...p, pieceLines: (p.pieceLines || []).map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const delPieceLine = (i) => setF((p) => ({ ...p, pieceLines: (p.pieceLines || []).filter((_, j) => j !== i) }));

  const socialCampaign = useMemo(() => (piezas || []).find((x) => x.id === f.refId), [f.refId, piezas]);
  const pieceItems = useMemo(() => (
    f.modoDetalle === "piezas"
      ? ((f.pieceLines || []).length ? (f.pieceLines || []) : [pieceLine()]).map((it, i) => ({
          ...it,
          id: it.id || uid(),
          desc: it.desc || `Piezas ${i + 1}`,
          qty: Number(it.qty || 0),
          precio: Number(it.precioOrigen ?? it.precio ?? 0),
          und: "pieza",
          recurrence: it.recurrence || "monthly",
        }))
      : (f.items || [])
  ), [f.items, f.modoDetalle, f.pieceLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const exchangeRate = normalizeExchangeRate(f.moneda, f.tipoCambio);
  const usesFx = isFxCurrency(f.moneda);
  const pieceItemsNormalized = useMemo(() => pieceItems.map((it) => {
    const qty = Number(it.qty || 0);
    const precioOrigen = Number(it.precioOrigen ?? it.precio ?? 0);
    const totalOrigen = qty * precioOrigen;
    const totalCLPRaw = totalOrigen * exchangeRate;
    return {
      ...it,
      precio: precioOrigen,
      precioOrigen,
      precioCLP: qty > 0 ? Math.round(totalCLPRaw / qty) : Math.round(precioOrigen * exchangeRate),
      totalOrigen,
      totalCLP: Math.round(totalCLPRaw),
      tipoCambio: exchangeRate,
    };
  }), [exchangeRate, pieceItems]);

  const subtotalOrigen = pieceItemsNormalized.reduce((s, it) => s + Number(it.totalOrigen || 0), 0);
  const subtotal = pieceItemsNormalized.reduce((s, it) => s + Number(it.totalCLP || 0), 0);
  const ivaVal = f.iva ? Math.round(subtotal * 0.19) : f.honorarios ? Math.round(subtotal * 0.1525) : 0;
  const total = subtotal + ivaVal;
  const ivaValOrigen = f.iva ? Math.round(subtotalOrigen * 0.19) : f.honorarios ? Math.round(subtotalOrigen * 0.1525) : 0;
  const totalOrigen = subtotalOrigen + ivaValOrigen;
  const recurringMonths = Math.max(1, Number(f.recMonths || 1));
  const projectedTotal = f.recurring ? total * recurringMonths : total;
  const projectedTotalOrigen = f.recurring ? totalOrigen * recurringMonths : totalOrigen;
  const contratosCli = contractsForReference(contratos || [], f.cliId, f.tipo, f.refId);

  const discardDraft = () => {
    saveBudgetDraft(...draftKeyArgs, null);
    setDraftRestored(false);
    setF({ ...empty });
  };

  const applyReference = (value) => {
    if (f.tipo === "contenido") {
      const campaign = (piezas || []).find((x) => x.id === value);
      setF((prev) => ({
        ...prev,
        refId: value,
        cliId: prev.cliId || campaign?.cliId || "",
        pieceLines: prev.modoDetalle === "piezas" && !(prev.pieceLines || []).length
          ? [{ id: uid(), desc: `Piezas ${campaign?.mes || "mensuales"}`, qty: Number(campaign?.plannedPieces || 1), precio: 0, und: "pieza" }]
          : prev.pieceLines,
      }));
      return;
    }
    u("refId", value);
  };

  const buildPayload = () => {
    const normalizedItems = canSocial && f.tipo === "contenido" && f.modoDetalle === "piezas"
      ? pieceItemsNormalized
      : pieceItemsNormalized;
    saveBudgetDraft(...draftKeyArgs, null);
    return {
      ...f,
      monedaOrigen: f.moneda || "CLP",
      monedaResultado: "CLP",
      tipoCambio: usesFx ? exchangeRate : 1,
      usesFx,
      items: normalizedItems.map((it) => ({
        ...it,
        precio: Number(it.precioCLP || 0),
        precioOrigen: Number(it.precioOrigen || 0),
        precioCLP: Number(it.precioCLP || 0),
        totalOrigen: Number(it.totalOrigen || 0),
        totalCLP: Number(it.totalCLP || 0),
      })),
      pieceLines: canSocial && f.tipo === "contenido" && f.modoDetalle === "piezas"
        ? pieceItemsNormalized.map((it) => ({
            ...it,
            precio: Number(it.precioCLP || 0),
            precioOrigen: Number(it.precioOrigen || 0),
            precioCLP: Number(it.precioCLP || 0),
            totalOrigen: Number(it.totalOrigen || 0),
            totalCLP: Number(it.totalCLP || 0),
          }))
        : (f.pieceLines || []),
      subtotalOrigen,
      subtotal,
      ivaValOrigen,
      ivaVal,
      totalOrigen,
      total,
      projectedTotalOrigen,
      projectedTotal,
    };
  };

  return {
    f,
    setF,
    u,
    canPrograms,
    canSocial,
    canContracts,
    canInvoices,
    addItem,
    updItem,
    delItem,
    addPieceLine,
    updPieceLine,
    delPieceLine,
    socialCampaign,
    pieceItems: pieceItemsNormalized,
    usesFx,
    exchangeRate,
    subtotalOrigen,
    subtotal,
    ivaValOrigen,
    ivaVal,
    totalOrigen,
    total,
    recurringMonths,
    projectedTotalOrigen,
    projectedTotal,
    contratosCli,
    draftRestored,
    discardDraft,
    applyReference,
    buildPayload,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { dbGet, dbSet, dbCloneFromProd } from "../lib/lab/labDb";

export { dbGet, dbSet, dbCloneFromProd };

function useDB(key, initial = null, options = {}) {
  const { enabled = true, deferInitialLoad = false } = options;
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const writingRef = useRef(false);
  const dataRef = useRef(data);
  const controlsRef = useRef(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let alive = true;
    if (!enabled || !key) {
      setData(initial);
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    if (deferInitialLoad) {
      setLoading(true);
      return () => {
        alive = false;
      };
    }
    setLoading(true);
    dbGet(key)
      .then(value => {
        if (!alive) return;
        setData(value == null ? initial : value);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setData(initial);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key, initial, enabled, deferInitialLoad]);

  const save = useCallback(async next => {
    const resolved = typeof next === "function" ? next(dataRef.current) : next;
    writingRef.current = true;
    setData(resolved);
    await dbSet(key, resolved);
    writingRef.current = false;
    return resolved;
  }, [key]);

  if (!controlsRef.current) {
    controlsRef.current = {
      hydrate(value) {
        setData(value == null ? initial : value);
        setLoading(false);
      },
      startLoading() {
        setLoading(true);
      },
    };
  }

  return [data, save, save, loading, writingRef, controlsRef.current];
}

function usePoll(key, setData, saveFn, writingRef, ms = 20000) {
  useEffect(() => {
    if (!key) return;
    let mounted = true;
    let busy = false;

    const tick = async () => {
      if (busy || !mounted) return;
      if (writingRef?.current) return;
      busy = true;
      try {
        const remote = await dbGet(key);
        if (!mounted) return;
        if (writingRef?.current) return;
        if (remote !== undefined && remote !== null) {
          setData(prev => {
            if (JSON.stringify(prev) === JSON.stringify(remote)) return prev;
            return remote;
          });
        } else if (saveFn) {
          await saveFn(prev => prev);
        }
      } catch {}
      finally {
        busy = false;
      }
    };

    tick();
    const id = setInterval(tick, ms);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [key, setData, saveFn, writingRef, ms]);
}

export function useGlobalLabData() {
  const [empresas, setEmpresasRaw, savEmpRef, , , empresasCtl] = useDB("produ:empresas", null, { deferInitialLoad: true });
  const [users, setUsersRaw, savUsrRef, , , usersCtl] = useDB("produ:users", null, { deferInitialLoad: true });
  const [printLayouts, setPrintLayoutsRaw, , , , printLayoutsCtl] = useDB("produ:printLayouts", null, { deferInitialLoad: true });
  const [, setThemeDB, , , , themeCtl] = useDB("produ:theme", null, { deferInitialLoad: true });

  useEffect(() => {
    let alive = true;
    const controls = [empresasCtl, usersCtl, printLayoutsCtl, themeCtl];
    controls.forEach(control => control.startLoading());
    Promise.all([
      dbGet("produ:empresas"),
      dbGet("produ:users"),
      dbGet("produ:printLayouts"),
      dbGet("produ:theme"),
    ])
      .then(([empresasValue, usersValue, printLayoutsValue, themeValue]) => {
        if (!alive) return;
        empresasCtl.hydrate(empresasValue);
        usersCtl.hydrate(usersValue);
        printLayoutsCtl.hydrate(printLayoutsValue);
        themeCtl.hydrate(themeValue);
      })
      .catch(() => {
        if (!alive) return;
        controls.forEach(control => control.hydrate(null));
      });
    return () => {
      alive = false;
    };
  }, [empresasCtl, usersCtl, printLayoutsCtl, themeCtl]);

  return {
    empresas,
    setEmpresasRaw,
    savEmpRef,
    users,
    setUsersRaw,
    savUsrRef,
    printLayouts,
    setPrintLayoutsRaw,
    setThemeDB,
  };
}

export function useTenantLabData(eId) {
  const tenantEnabled = !!eId && eId !== "__none__";
  const [listas, setListas, savLst, ldLst, listasWritingRef, listasCtl] = useDB(`produ:${eId}:listas`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [tareas, setTareas, savTar, ldTar, tareasWritingRef, tareasCtl] = useDB(`produ:${eId}:tareas`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [clientes, setClientes, savCli, ldCli, clientesWritingRef, clientesCtl] = useDB(`produ:${eId}:clientes`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [producciones, setProducciones, savPro, ldPro, produccionesWritingRef, produccionesCtl] = useDB(`produ:${eId}:producciones`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [programas, setProgramas, savPg, ldPg, programasWritingRef, programasCtl] = useDB(`produ:${eId}:programas`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [piezas, setPiezas, savPiezas, ldPiezas, piezasWritingRef, piezasCtl] = useDB(`produ:${eId}:piezas`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [episodios, setEpisodios, savEp, ldEp, episodiosWritingRef, episodiosCtl] = useDB(`produ:${eId}:episodios`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [auspiciadores, setAuspiciadores, savAus, ldAus, auspiciadoresWritingRef, auspiciadoresCtl] = useDB(`produ:${eId}:auspiciadores`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [crmOpps, setCrmOpps, savCrmOpps, ldCrmOpps, crmOppsWritingRef, crmOppsCtl] = useDB(`produ:${eId}:crmOpps`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [crmActivities, setCrmActivities, savCrmActivities, ldCrmActivities, crmActivitiesWritingRef, crmActivitiesCtl] = useDB(`produ:${eId}:crmActivities`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [crmStages, setCrmStages, savCrmStages, ldCrmStages, crmWritingRef, crmStagesCtl] = useDB(`produ:${eId}:crmStages`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [contratos, setContratos, savCt, ldCt, contratosWritingRef, contratosCtl] = useDB(`produ:${eId}:contratos`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [movimientos, setMovimientos, savMov, ldMov, movimientosWritingRef, movimientosCtl] = useDB(`produ:${eId}:movimientos`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [crew, setCrew, savCrew, ldCrew, crewWritingRef, crewCtl] = useDB(`produ:${eId}:crew`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [eventos, setEventos, savEv, ldEv, eventosWritingRef, eventosCtl] = useDB(`produ:${eId}:eventos`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [presupuestos, setPresupuestos, savPres, ldPres, presupuestosWritingRef, presupuestosCtl] = useDB(`produ:${eId}:presupuestos`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [facturas, setFacturas, savFact, ldFact, facturasWritingRef, facturasCtl] = useDB(`produ:${eId}:facturas`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryProviders, setTreasuryProviders, savTreasuryProviders, ldTreasuryProviders, treasuryProvidersWritingRef, treasuryProvidersCtl] = useDB(`produ:${eId}:treasuryProviders`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryPayables, setTreasuryPayables, savTreasuryPayables, ldTreasuryPayables, treasuryPayablesWritingRef, treasuryPayablesCtl] = useDB(`produ:${eId}:treasuryPayables`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryPurchaseOrders, setTreasuryPurchaseOrders, savTreasuryPurchaseOrders, ldTreasuryPurchaseOrders, treasuryPurchaseOrdersWritingRef, treasuryPurchaseOrdersCtl] = useDB(`produ:${eId}:treasuryPurchaseOrders`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryIssuedOrders, setTreasuryIssuedOrders, savTreasuryIssuedOrders, ldTreasuryIssuedOrders, treasuryIssuedOrdersWritingRef, treasuryIssuedOrdersCtl] = useDB(`produ:${eId}:treasuryIssuedOrders`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryReceipts, setTreasuryReceipts, savTreasuryReceipts, ldTreasuryReceipts, treasuryReceiptsWritingRef, treasuryReceiptsCtl] = useDB(`produ:${eId}:treasuryReceipts`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [treasuryDisbursements, setTreasuryDisbursements, savTreasuryDisbursements, ldTreasuryDisbursements, treasuryDisbursementsWritingRef, treasuryDisbursementsCtl] = useDB(`produ:${eId}:treasuryDisbursements`, null, { enabled: tenantEnabled, deferInitialLoad: true });
  const [activos, setActivos, savAct, ldAct, activosWritingRef, activosCtl] = useDB(`produ:${eId}:activos`, null, { enabled: tenantEnabled, deferInitialLoad: true });

  useEffect(() => {
    let alive = true;
    if (!tenantEnabled) return;
    const controls = [
      listasCtl,
      tareasCtl,
      clientesCtl,
      produccionesCtl,
      programasCtl,
      piezasCtl,
      episodiosCtl,
      auspiciadoresCtl,
      crmOppsCtl,
      crmActivitiesCtl,
      crmStagesCtl,
      contratosCtl,
      movimientosCtl,
      crewCtl,
      eventosCtl,
      presupuestosCtl,
      facturasCtl,
      treasuryProvidersCtl,
      treasuryPayablesCtl,
      treasuryPurchaseOrdersCtl,
      treasuryIssuedOrdersCtl,
      treasuryReceiptsCtl,
      treasuryDisbursementsCtl,
      activosCtl,
    ];
    controls.forEach(control => control.startLoading());
    Promise.all([
      dbGet(`produ:${eId}:listas`),
      dbGet(`produ:${eId}:tareas`),
      dbGet(`produ:${eId}:clientes`),
      dbGet(`produ:${eId}:producciones`),
      dbGet(`produ:${eId}:programas`),
      dbGet(`produ:${eId}:piezas`),
      dbGet(`produ:${eId}:episodios`),
      dbGet(`produ:${eId}:auspiciadores`),
      dbGet(`produ:${eId}:crmOpps`),
      dbGet(`produ:${eId}:crmActivities`),
      dbGet(`produ:${eId}:crmStages`),
      dbGet(`produ:${eId}:contratos`),
      dbGet(`produ:${eId}:movimientos`),
      dbGet(`produ:${eId}:crew`),
      dbGet(`produ:${eId}:eventos`),
      dbGet(`produ:${eId}:presupuestos`),
      dbGet(`produ:${eId}:facturas`),
      dbGet(`produ:${eId}:treasuryProviders`),
      dbGet(`produ:${eId}:treasuryPayables`),
      dbGet(`produ:${eId}:treasuryPurchaseOrders`),
      dbGet(`produ:${eId}:treasuryIssuedOrders`),
      dbGet(`produ:${eId}:treasuryReceipts`),
      dbGet(`produ:${eId}:treasuryDisbursements`),
      dbGet(`produ:${eId}:activos`),
    ])
      .then(values => {
        if (!alive) return;
        values.forEach((value, index) => controls[index].hydrate(value));
      })
      .catch(() => {
        if (!alive) return;
        controls.forEach(control => control.hydrate(null));
      });
    return () => {
      alive = false;
    };
  }, [
    tenantEnabled,
    eId,
    listasCtl,
    tareasCtl,
    clientesCtl,
    produccionesCtl,
    programasCtl,
    piezasCtl,
    episodiosCtl,
    auspiciadoresCtl,
    crmOppsCtl,
    crmActivitiesCtl,
    crmStagesCtl,
    contratosCtl,
    movimientosCtl,
    crewCtl,
    eventosCtl,
    presupuestosCtl,
    facturasCtl,
    treasuryProvidersCtl,
    treasuryPayablesCtl,
    treasuryPurchaseOrdersCtl,
    treasuryIssuedOrdersCtl,
    treasuryReceiptsCtl,
    treasuryDisbursementsCtl,
    activosCtl,
  ]);

  usePoll(tenantEnabled ? `produ:${eId}:clientes` : "", setClientes, savCli, clientesWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:producciones` : "", setProducciones, savPro, produccionesWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:programas` : "", setProgramas, savPg, programasWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:piezas` : "", setPiezas, savPiezas, piezasWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:episodios` : "", setEpisodios, savEp, episodiosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:auspiciadores` : "", setAuspiciadores, savAus, auspiciadoresWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:crmOpps` : "", setCrmOpps, savCrmOpps, crmOppsWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:crmActivities` : "", setCrmActivities, savCrmActivities, crmActivitiesWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:crmStages` : "", setCrmStages, savCrmStages, crmWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:contratos` : "", setContratos, savCt, contratosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:movimientos` : "", setMovimientos, savMov, movimientosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:eventos` : "", setEventos, savEv, eventosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:presupuestos` : "", setPresupuestos, savPres, presupuestosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:facturas` : "", setFacturas, savFact, facturasWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryProviders` : "", setTreasuryProviders, savTreasuryProviders, treasuryProvidersWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryPayables` : "", setTreasuryPayables, savTreasuryPayables, treasuryPayablesWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryPurchaseOrders` : "", setTreasuryPurchaseOrders, savTreasuryPurchaseOrders, treasuryPurchaseOrdersWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryIssuedOrders` : "", setTreasuryIssuedOrders, savTreasuryIssuedOrders, treasuryIssuedOrdersWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryReceipts` : "", setTreasuryReceipts, savTreasuryReceipts, treasuryReceiptsWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:treasuryDisbursements` : "", setTreasuryDisbursements, savTreasuryDisbursements, treasuryDisbursementsWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:activos` : "", setActivos, savAct, activosWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:crew` : "", setCrew, savCrew, crewWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:listas` : "", setListas, savLst, listasWritingRef);
  usePoll(tenantEnabled ? `produ:${eId}:tareas` : "", setTareas, savTar, tareasWritingRef);

  return {
    listas, setListas, savLst, ldLst,
    tareas, setTareas, savTar, ldTar,
    clientes, setClientes, savCli, ldCli,
    producciones, setProducciones, savPro, ldPro,
    programas, setProgramas, savPg, ldPg,
    piezas, setPiezas, savPiezas, ldPiezas,
    episodios, setEpisodios, savEp, ldEp,
    auspiciadores, setAuspiciadores, savAus, ldAus,
    crmOpps, setCrmOpps, savCrmOpps, ldCrmOpps,
    crmActivities, setCrmActivities, savCrmActivities, ldCrmActivities,
    crmStages, setCrmStages, savCrmStages, ldCrmStages,
    contratos, setContratos, savCt, ldCt,
    movimientos, setMovimientos, savMov, ldMov,
    crew, setCrew, savCrew, ldCrew,
    eventos, setEventos, savEv, ldEv,
    presupuestos, setPresupuestos, savPres, ldPres,
    facturas, setFacturas, savFact, ldFact,
    treasuryProviders, setTreasuryProviders, savTreasuryProviders, ldTreasuryProviders,
    treasuryPayables, setTreasuryPayables, savTreasuryPayables, ldTreasuryPayables,
    treasuryPurchaseOrders, setTreasuryPurchaseOrders, savTreasuryPurchaseOrders, ldTreasuryPurchaseOrders,
    treasuryIssuedOrders, setTreasuryIssuedOrders, savTreasuryIssuedOrders, ldTreasuryIssuedOrders,
    treasuryReceipts, setTreasuryReceipts, savTreasuryReceipts, ldTreasuryReceipts,
    treasuryDisbursements, setTreasuryDisbursements, savTreasuryDisbursements, ldTreasuryDisbursements,
    activos, setActivos, savAct, ldAct,
  };
}

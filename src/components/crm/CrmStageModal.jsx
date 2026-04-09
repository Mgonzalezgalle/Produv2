import React from "react";
import { Btn, DBtn, FI, GBtn, Modal } from "../../lib/ui/components";

export function CrmStageModal({
  open,
  onClose,
  localStages,
  scopedStages,
  setLocalStages,
  setStagesChanged,
  removeStage,
  saveStageConfig,
  createStage,
}) {
  return (
    <Modal open={open} onClose={onClose} title="Etapas del pipeline" sub="Edita el flujo comercial del CRM">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(localStages || []).map((stage, idx) => (
          <div
            key={stage.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto auto auto",
              gap: 8,
              alignItems: "center",
              padding: 10,
              border: "1px solid var(--bdr2)",
              borderRadius: 10,
              background: "var(--sur)",
            }}
          >
            <FI
              value={stage.name}
              onChange={e => {
                setLocalStages(localStages.map(item => item.id === stage.id ? { ...item, name: e.target.value } : item));
                setStagesChanged(true);
              }}
            />
            <label style={{ fontSize: 11, color: "var(--gr3)", display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={!!stage.convertToClient}
                onChange={e => {
                  setLocalStages(localStages.map(item => item.id === stage.id ? { ...item, convertToClient: e.target.checked } : item));
                  setStagesChanged(true);
                }}
              />
              Cliente
            </label>
            <GBtn
              sm
              onClick={() => {
                if (idx > 0) {
                  setLocalStages(localStages.map((item, i) => i === idx - 1 ? { ...stage, order: i + 1 } : i === idx ? { ...localStages[idx - 1], order: i + 1 } : { ...item, order: i + 1 }));
                  setStagesChanged(true);
                }
              }}
            >
              ↑
            </GBtn>
            <GBtn
              sm
              onClick={() => {
                if (idx < localStages.length - 1) {
                  setLocalStages(localStages.map((item, i) => i === idx + 1 ? { ...stage, order: i + 1 } : i === idx ? { ...localStages[idx + 1], order: i + 1 } : { ...item, order: i + 1 }));
                  setStagesChanged(true);
                }
              }}
            >
              ↓
            </GBtn>
            <DBtn sm onClick={() => removeStage(stage.id)}>Eliminar</DBtn>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 8 }}>
        <GBtn
          onClick={() => {
            setLocalStages([...(localStages || []), createStage((localStages || []).length + 1)]);
            setStagesChanged(true);
          }}
        >
          + Agregar etapa
        </GBtn>
        <div style={{ display: "flex", gap: 8 }}>
          <GBtn onClick={onClose}>Cerrar</GBtn>
          <Btn
            onClick={async () => {
              await saveStageConfig(localStages || scopedStages);
              setStagesChanged(false);
              onClose();
            }}
          >
            Guardar
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

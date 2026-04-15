import React from "react";
import { Btn, GBtn, Modal } from "../../lib/ui/components";

export function ConfirmActionDialog({
  open,
  title = "Confirmar acción",
  message = "",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div style={{ fontSize: 13, color: "var(--gr3)", lineHeight: 1.6, marginBottom: 18 }}>
        {message}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <GBtn onClick={onClose}>{cancelLabel}</GBtn>
        <Btn
          onClick={onConfirm}
          style={{ background: "linear-gradient(135deg,#ff6b6b,#e03131)", borderColor: "#ff8787" }}
        >
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

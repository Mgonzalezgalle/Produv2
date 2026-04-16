export function requestConfirm({
  title = "Confirmar acción",
  message = "",
  confirmLabel = "Confirmar",
} = {}) {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (typeof window.__produRequestConfirm === "function") {
    return Promise.resolve(window.__produRequestConfirm({ title, message, confirmLabel }));
  }
  return Promise.resolve(window.confirm(message || title));
}

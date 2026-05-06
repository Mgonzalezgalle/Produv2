export function getUserFacingErrorMessage(error, fallback = "No pudimos completar esta acción.") {
  const rawMessage = String(
    error?.userMessage
    || error?.displayMessage
    || error?.message
    || error?.error_description
    || error?.error
    || "",
  ).trim();

  if (!rawMessage) return fallback;

  const normalized = rawMessage.toLowerCase();
  if (normalized.includes("failed to fetch") || normalized.includes("networkerror") || normalized.includes("load failed")) {
    return "No pudimos comunicarnos con el servicio remoto. Revisa tu conexión e inténtalo nuevamente.";
  }
  if (normalized.includes("permission") || normalized.includes("forbidden") || normalized.includes("not authorized") || normalized.includes("unauthorized")) {
    return "No tienes permisos suficientes para completar esta acción.";
  }
  if (normalized.includes("timeout")) {
    return "La operación tardó demasiado. Inténtalo nuevamente en unos segundos.";
  }

  return rawMessage;
}

export function notifyUserFacingError(ntf, error, fallback, type = "warn") {
  const message = getUserFacingErrorMessage(error, fallback);
  if (typeof ntf === "function") ntf(message, type);
  return message;
}

export function alertUserFacingError(error, fallback) {
  const message = getUserFacingErrorMessage(error, fallback);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
  return message;
}

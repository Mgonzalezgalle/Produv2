export const LAB_NS = "produ-lab";
export const PROD_NS = "produ";
export const LAB_DATA_MODES = {
  ISOLATED: "isolated",
  RELEASE: "release",
};

function normalizeLabDataMode(value = "") {
  const next = String(value || "").trim().toLowerCase();
  return next === LAB_DATA_MODES.RELEASE ? LAB_DATA_MODES.RELEASE : LAB_DATA_MODES.ISOLATED;
}

function readLabDataMode() {
  try {
    const configured = import.meta.env?.VITE_LAB_DATA_MODE;
    if (configured == null || String(configured).trim() === "") {
      return LAB_DATA_MODES.RELEASE;
    }
    return normalizeLabDataMode(configured);
  } catch {
    return LAB_DATA_MODES.RELEASE;
  }
}

export const LAB_DATA_CONFIG = {
  mode: readLabDataMode(),
  releaseMode: readLabDataMode() === LAB_DATA_MODES.RELEASE,
};

function activeDataNamespace() {
  return LAB_DATA_CONFIG.releaseMode ? PROD_NS : LAB_NS;
}

export function labStorageKey(key = "") {
  const targetNs = activeDataNamespace();
  return String(key || "").startsWith(`${PROD_NS}:`)
    ? key.replace(`${PROD_NS}:`, `${targetNs}:`)
    : `${targetNs}:${key}`;
}

export function prodStorageKey(key = "") {
  return String(key || "").startsWith(`${LAB_NS}:`)
    ? key.replace(`${LAB_NS}:`, `${PROD_NS}:`)
    : key;
}

export function localLabKey(key = "") {
  return `${activeDataNamespace()}:${key}`;
}

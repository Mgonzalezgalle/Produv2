import { useEffect } from "react";

function freshdeskFirstName(user) {
  const fullName = String(user?.name || user?.nom || "").trim();
  return fullName ? fullName.split(/\s+/)[0] : "";
}

function applyFreshdeskIdentity({ user, empresa }) {
  if (!user || !window.fcWidget) return false;
  const email = String(user.email || user.ema || "").trim();
  const externalId = String(user.id || "").trim();
  const firstName = freshdeskFirstName(user);
  try {
    if (externalId && typeof window.fcWidget.setExternalId === "function") window.fcWidget.setExternalId(externalId);
    if (firstName && window.fcWidget.user?.setFirstName) window.fcWidget.user.setFirstName(firstName);
    if (email && window.fcWidget.user?.setEmail) window.fcWidget.user.setEmail(email);
    if (window.fcWidget.user?.setProperties) {
      window.fcWidget.user.setProperties({
        cf_plan: String(empresa?.plan || "Starter"),
        cf_status: empresa?.active === false ? "Inactive" : "Active",
      });
    }
    return true;
  } catch {
    return false;
  }
}

function shouldShowFreshdesk({ user, empresa }) {
  return !!(
    user &&
    user.role !== "superadmin" &&
    empresa?.id &&
    empresa?.active !== false &&
    (empresa?.freshdeskEnabled === true || empresa?.supportChatEnabled === true)
  );
}

function syncFreshdeskVisibility(visible) {
  try {
    if (visible) document.body.setAttribute("data-freshdesk-visible", "true");
    else document.body.removeAttribute("data-freshdesk-visible");
  } catch {}
  if (!window.fcWidget) return false;
  try {
    if (visible) window.fcWidget.show?.();
    else window.fcWidget.hide?.();
    return true;
  } catch {
    return false;
  }
}

export function useLabFreshdeskWidget({ user, empresa }) {
  useEffect(() => {
    syncFreshdeskVisibility(false);
    const visible = shouldShowFreshdesk({ user, empresa });
    let cancelled = false;
    let retryTimer = null;
    let attempts = 0;
    const syncFreshdesk = () => {
      if (cancelled) return;
      attempts += 1;
      const visibilityApplied = syncFreshdeskVisibility(visible);
      const identityApplied = visible ? applyFreshdeskIdentity({ user, empresa }) : true;
      if ((!visibilityApplied || !identityApplied) && attempts < 20) retryTimer = window.setTimeout(syncFreshdesk, 500);
    };
    syncFreshdesk();
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      syncFreshdeskVisibility(false);
    };
  }, [
    user?.id,
    user?.email,
    user?.ema,
    user?.name,
    user?.nom,
    user?.role,
    empresa?.id,
    empresa?.plan,
    empresa?.active,
    empresa?.freshdeskEnabled,
    empresa?.supportChatEnabled,
  ]);
}

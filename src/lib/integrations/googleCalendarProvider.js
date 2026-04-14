import { getGoogleCalendarConfig, getGoogleCalendarProviderSnapshot } from "./googleCalendarConfig";
import { userGoogleCalendar } from "../utils/helpers";

export function buildGoogleCalendarConnectionDraft({ user = {}, empresa = {} } = {}) {
  const config = getGoogleCalendarConfig();
  const calendarState = userGoogleCalendar(user);
  return {
    provider: "google",
    config: getGoogleCalendarProviderSnapshot(),
    tenantId: String(empresa?.id || user?.empId || "").trim(),
    userId: String(user?.id || "").trim(),
    userEmail: String(calendarState.email || user?.email || "").trim(),
    calendarId: String(calendarState.calendarId || "primary").trim(),
    calendarName: String(calendarState.calendarName || "Calendario principal").trim(),
    autoSync: calendarState.autoSync === true,
    connectionMode: config.mode,
    ready: config.ready,
  };
}

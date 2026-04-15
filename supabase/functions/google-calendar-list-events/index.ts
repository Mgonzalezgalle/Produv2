type Payload = {
  calendarId?: string;
  refreshToken?: string;
  timeMin?: string;
  timeMax?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getGoogleAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

  if (!clientId || !clientSecret) {
    return {
      ok: false,
      error: "missing_google_configuration",
      message: "Faltan secretos de Google para leer eventos.",
      status: 503,
    };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const message = await tokenRes.text();
    return {
      ok: false,
      error: "refresh_token_exchange_failed",
      message: message || "No pudimos obtener un access token desde Google.",
      status: 502,
    };
  }

  const data = await tokenRes.json();
  return { ok: true, accessToken: String(data?.access_token || "").trim() };
}

async function listCalendars(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const message = await res.text();
    return {
      ok: false,
      error: "google_calendar_list_failed",
      message: message || "No pudimos leer la lista de calendarios de Google.",
      status: 502,
    };
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return {
    ok: true,
    items: items.filter((item) => item?.hidden !== true && item?.selected !== false && String(item?.accessRole || "").trim() !== "none"),
  };
}

async function listEventsForCalendar(accessToken: string, calendarId: string, timeMin?: string, timeMax?: string) {
  const encodedId = encodeURIComponent(String(calendarId || "primary").trim() || "primary");
  const listUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events`);
  listUrl.searchParams.set("singleEvents", "true");
  listUrl.searchParams.set("orderBy", "startTime");
  if (timeMin) listUrl.searchParams.set("timeMin", String(timeMin));
  if (timeMax) listUrl.searchParams.set("timeMax", String(timeMax));

  const listRes = await fetch(listUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!listRes.ok) {
    const message = await listRes.text();
    return {
      ok: false,
      error: "google_event_list_failed",
      message: message || "Google rechazó la lectura de eventos.",
      status: 502,
    };
  }

  const data = await listRes.json();
  return {
    ok: true,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const payload = await req.json() as Payload;
  const refreshToken = String(payload?.refreshToken || "").trim();
  if (!refreshToken) {
    return json({ ok: false, error: "missing_refresh_token", message: "Falta el refresh token de Google Calendar." }, 400);
  }

  const access = await getGoogleAccessToken(refreshToken);
  if (!access.ok) {
    return json({ ok: false, source: "degraded", provider: "google", error: access.error, message: access.message }, access.status || 502);
  }

  const requestedCalendarId = String(payload?.calendarId || "all").trim() || "all";
  const loadAllCalendars = requestedCalendarId === "all";

  if (!loadAllCalendars) {
    const listRes = await listEventsForCalendar(access.accessToken, requestedCalendarId, payload?.timeMin, payload?.timeMax);
    if (!listRes.ok) {
      return json({
        ok: false,
        source: "degraded",
        provider: "google",
        error: listRes.error,
        message: listRes.message,
      }, listRes.status || 502);
    }

    return json({
      ok: true,
      source: "remote",
      provider: "google",
      items: listRes.items.map((item) => ({
        ...item,
        _produCalendarId: requestedCalendarId,
      })),
    });
  }

  const calendars = await listCalendars(access.accessToken);
  if (!calendars.ok) {
    const fallbackCalendarId = String(payload?.calendarId || "primary").trim() === "all"
      ? "primary"
      : String(payload?.calendarId || "primary").trim() || "primary";
    const fallbackList = await listEventsForCalendar(access.accessToken, fallbackCalendarId, payload?.timeMin, payload?.timeMax);
    if (!fallbackList.ok) {
      return json({
        ok: false,
        source: "degraded",
        provider: "google",
        error: fallbackList.error || calendars.error,
        message: fallbackList.message || calendars.message,
      }, fallbackList.status || calendars.status || 502);
    }

    return json({
      ok: true,
      source: "remote",
      provider: "google",
      degraded: true,
      warning: calendars.message || "No pudimos enumerar todos los calendarios visibles; usamos el calendario base.",
      items: fallbackList.items.map((item) => ({
        ...item,
        _produCalendarId: fallbackCalendarId,
        _produCalendarName: fallbackCalendarId === "primary" ? "Calendario principal" : fallbackCalendarId,
      })),
    });
  }

  const calendarItems = Array.isArray(calendars.items) ? calendars.items : [];
  const responses = await Promise.all(calendarItems.map(async (calendar) => {
    const result = await listEventsForCalendar(access.accessToken, String(calendar?.id || "primary").trim() || "primary", payload?.timeMin, payload?.timeMax);
    return {
      calendarId: String(calendar?.id || "primary").trim() || "primary",
      calendarName: String(calendar?.summary || "Calendario").trim() || "Calendario",
      result,
    };
  }));

  const failedResponse = responses.find((item) => !item.result?.ok);
  if (failedResponse) {
    return json({
      ok: false,
      source: "degraded",
      provider: "google",
      error: failedResponse.result?.error || "google_event_list_failed",
      message: failedResponse.result?.message || `No pudimos leer eventos de ${failedResponse.calendarName}.`,
    }, failedResponse.result?.status || 502);
  }

  const items = responses.flatMap((entry) => (entry.result?.items || []).map((item) => ({
    ...item,
    _produCalendarId: entry.calendarId,
    _produCalendarName: entry.calendarName,
  })));

  return json({
    ok: true,
    source: "remote",
    provider: "google",
    items,
  });
});

type Payload = {
  calendarId?: string;
  refreshToken?: string;
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
  attendees?: string[];
  addMeet?: boolean;
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
      message: "Faltan secretos de Google para crear eventos.",
      status: 503,
    };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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
  return {
    ok: true,
    accessToken: String(data?.access_token || "").trim(),
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
  const summary = String(payload?.summary || "").trim();
  const startDateTime = String(payload?.startDateTime || "").trim();
  const endDateTime = String(payload?.endDateTime || "").trim();
  const attendees = Array.isArray(payload?.attendees)
    ? payload.attendees.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const addMeet = payload?.addMeet === true;

  if (!refreshToken) return json({ ok: false, error: "missing_refresh_token", message: "Falta el refresh token de Google Calendar." }, 400);
  if (!summary) return json({ ok: false, error: "missing_summary", message: "Falta el título del evento." }, 400);
  if (!startDateTime || !endDateTime) return json({ ok: false, error: "missing_date_range", message: "Faltan fechas del evento." }, 400);

  const access = await getGoogleAccessToken(refreshToken);
  if (!access.ok) return json({ ok: false, source: "degraded", provider: "google", error: access.error, message: access.message }, access.status || 502);

  const calendarId = encodeURIComponent(String(payload?.calendarId || "primary").trim() || "primary");
  const createUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
  if (addMeet) createUrl.searchParams.set("conferenceDataVersion", "1");

  const createRes = await fetch(createUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description: String(payload?.description || "").trim(),
      attendees: attendees.map((email) => ({ email })),
      ...(addMeet ? {
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      } : {}),
      start: {
        dateTime: startDateTime,
        timeZone: String(payload?.timeZone || "America/Santiago").trim(),
      },
      end: {
        dateTime: endDateTime,
        timeZone: String(payload?.timeZone || "America/Santiago").trim(),
      },
    }),
  });

  if (!createRes.ok) {
    const message = await createRes.text();
    return json({
      ok: false,
      source: "degraded",
      provider: "google",
      error: "google_event_create_failed",
      message: message || "Google rechazó la creación del evento.",
    }, 502);
  }

  const event = await createRes.json();
  return json({
    ok: true,
    source: "remote",
    provider: "google",
    event,
  });
});

type Payload = {
  code?: string;
  state?: string;
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

function safeParseState(value = "") {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function appendRedirectParams(redirectTo = "", params: Record<string, string>) {
  const target = new URL(redirectTo);
  Object.entries(params).forEach(([key, value]) => {
    target.searchParams.set(key, value);
  });
  return target.toString();
}

async function exchangeGoogleCalendarCode(code: string, state: Record<string, unknown>) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || "";

  if (!clientId || !clientSecret || !redirectUri) {
    return {
      ok: false,
      source: "degraded",
      provider: "google",
      error: "missing_google_configuration",
      message: "Faltan secretos para completar OAuth de Google Calendar.",
      status: 503,
    };
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const tokenError = await tokenRes.text();
    return {
      ok: false,
      source: "degraded",
      provider: "google",
      error: "token_exchange_failed",
      message: tokenError || "No pudimos cambiar el code por tokens.",
      status: 502,
    };
  }

  const tokenData = await tokenRes.json();
  const accessToken = String(tokenData.access_token || "");
  const refreshToken = String(tokenData.refresh_token || "");
  const expiresIn = Number(tokenData.expires_in || 0);

  const calendarListRes = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  let primaryCalendar = null;
  if (calendarListRes.ok) {
    const calendarData = await calendarListRes.json();
    const items = Array.isArray(calendarData?.items) ? calendarData.items : [];
    primaryCalendar = items.find((item) => item?.primary) || items[0] || null;
  }

  return {
    ok: true,
    source: "remote",
    provider: "google",
    connection: {
      tenantId: String(state?.tenantId || "").trim(),
      userId: String(state?.userId || "").trim(),
      userEmail: String(state?.userEmail || "").trim(),
      redirectTo: String(state?.redirectTo || "").trim(),
      accessToken,
      refreshToken,
      expiresIn,
      scope: String(tokenData.scope || "").trim(),
      tokenType: String(tokenData.token_type || "Bearer").trim(),
      calendarId: String(primaryCalendar?.id || "primary").trim(),
      calendarName: String(primaryCalendar?.summary || "Calendario principal").trim(),
      connectedAt: new Date().toISOString(),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") || "").trim();
    const rawState = String(url.searchParams.get("state") || "");
    const state = safeParseState(rawState);
    const redirectTo = String(state?.redirectTo || "").trim();

    if (!code) {
      if (redirectTo) {
        return Response.redirect(appendRedirectParams(redirectTo, {
          google_calendar_status: "error",
          google_calendar_message: "No recibimos el código OAuth de Google.",
        }), 302);
      }
      return json({ ok: false, error: "missing_code" }, 400);
    }

    const result = await exchangeGoogleCalendarCode(code, state);
    if (!result.ok) {
      if (redirectTo) {
        return Response.redirect(appendRedirectParams(redirectTo, {
          google_calendar_status: "error",
          google_calendar_message: String(result.message || "No pudimos completar la conexión con Google Calendar."),
        }), 302);
      }
      return json(result, result.status || 502);
    }

    if (redirectTo) {
      return Response.redirect(appendRedirectParams(redirectTo, {
        google_calendar_status: "connected",
        google_calendar_connection: JSON.stringify(result.connection || {}),
      }), 302);
    }

    return json(result);
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const payload = await req.json() as Payload;
  const code = String(payload.code || "").trim();
  if (!code) {
    return json({ ok: false, error: "missing_code" }, 400);
  }

  const state = safeParseState(String(payload.state || ""));
  const result = await exchangeGoogleCalendarCode(code, state);
  return json(result, result.ok ? 200 : result.status || 502);
});

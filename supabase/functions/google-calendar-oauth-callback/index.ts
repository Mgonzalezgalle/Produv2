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

function html(body = "", status = 200) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function safeOrigin(value = "") {
  try {
    return new URL(value).origin;
  } catch {
    return "*";
  }
}

function buildPopupResponse({ redirectTo = "", payload = {}, close = true }) {
  const origin = safeOrigin(redirectTo);
  const serializedPayload = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const safeRedirectTo = JSON.stringify(String(redirectTo || ""));
  return html(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Google Calendar</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 24px; color: #0f172a;">
    <p>Completando conexión con Google Calendar...</p>
    <script>
      (function () {
        const payload = ${serializedPayload};
        const targetOrigin = ${JSON.stringify(origin)};
        const redirectTo = ${safeRedirectTo};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);
          } else if (redirectTo) {
            const target = new URL(redirectTo);
            target.searchParams.set("google_calendar_status", String(payload?.status || "error"));
            if (payload?.message) target.searchParams.set("google_calendar_message", String(payload.message));
            window.location.replace(target.toString());
            return;
          }
        } catch (error) {
          console.error(error);
        }
        ${close ? "window.close();" : ""}
      })();
    </script>
  </body>
</html>`);
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
        return buildPopupResponse({
          redirectTo,
          payload: {
            type: "produ_google_calendar_oauth",
            status: "error",
            message: String(result.message || "No pudimos completar la conexión con Google Calendar."),
          },
          close: false,
        });
      }
      return json(result, result.status || 502);
    }

    if (redirectTo) {
      return buildPopupResponse({
        redirectTo,
        payload: {
          type: "produ_google_calendar_oauth",
          status: "connected",
          connection: result.connection || {},
        },
      });
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

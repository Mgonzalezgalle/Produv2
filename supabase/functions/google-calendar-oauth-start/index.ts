type Payload = {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  redirectTo?: string;
  scopes?: string[];
  prompt?: string;
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

function normalizeScopes(value: unknown) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || "";
  const defaultScopes = (Deno.env.get("GOOGLE_CALENDAR_SCOPES") || "https://www.googleapis.com/auth/calendar.events")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!clientId || !redirectUri) {
    return json({
      ok: false,
      source: "degraded",
      provider: "google",
      error: "missing_google_configuration",
      message: "Faltan secretos de Google Calendar para iniciar OAuth.",
    }, 503);
  }

  const payload = await req.json() as Payload;
  const scopes = normalizeScopes(payload.scopes).length ? normalizeScopes(payload.scopes) : defaultScopes;
  const state = JSON.stringify({
    tenantId: String(payload.tenantId || "").trim(),
    userId: String(payload.userId || "").trim(),
    userEmail: String(payload.userEmail || "").trim(),
    redirectTo: String(payload.redirectTo || "").trim(),
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("prompt", String(payload.prompt || "consent").trim() || "consent");
  authUrl.searchParams.set("state", state);

  return json({
    ok: true,
    source: "remote",
    provider: "google",
    authUrl: authUrl.toString(),
    state,
    redirectUri,
    scopes,
  });
});

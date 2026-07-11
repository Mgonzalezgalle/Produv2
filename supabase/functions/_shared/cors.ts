export type CorsHeaders = Record<string, string>;

const BASE_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

export const corsHeaders: CorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": BASE_ALLOWED_HEADERS,
};

export const mercadoPagoCorsHeaders: CorsHeaders = buildCorsHeaders({
  extraAllowedHeaders: ["x-signature"],
});

// Diio sends custom signature headers with capitalized names. Keep the exact
// casing used by the webhook provider instead of forcing it into the base set.
export const diioWebhookCorsHeaders: CorsHeaders = buildCorsHeaders({
  extraAllowedHeaders: ["DO-Signature", "DO-Timestamp"],
});

export function buildCorsHeaders(options: {
  origin?: string;
  allowedHeaders?: string;
  extraAllowedHeaders?: string[];
} = {}): CorsHeaders {
  const allowedHeaders = String(options.allowedHeaders || BASE_ALLOWED_HEADERS).trim();
  const extraAllowedHeaders = (options.extraAllowedHeaders || [])
    .map((header) => String(header || "").trim())
    .filter(Boolean);
  return {
    "Access-Control-Allow-Origin": String(options.origin || "*"),
    "Access-Control-Allow-Headers": [allowedHeaders, ...extraAllowedHeaders].filter(Boolean).join(", "),
  };
}

export function handleCors(req: Request, headers: CorsHeaders = corsHeaders) {
  if (req.method !== "OPTIONS") return null;
  return new Response("ok", { headers });
}
